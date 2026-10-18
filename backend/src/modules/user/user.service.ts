import { query, withTransaction } from '../../config/db.js';
import { hashPassword, generateTemporaryPassword } from '../../utils/crypto.js';
import { toCamel, toCamelList } from '../../utils/case.js';
import { parsePagination, buildOrderBy } from '../../utils/pagination.js';
import { NotFoundError, ForbiddenError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import type { UserRole } from '../../enums/user-role.enum.js';
import type { AuthenticatedUser } from '../../types/express.js';

export interface CreateUserDto {
  username: string;
  role: 'RETAILER' | 'DELIVERY';
  phone: string;
  temporaryPassword?: string;
}

export interface ListUsersQuery {
  page?: number;
  pageSize?: number;
  role?: UserRole;
  isActive?: boolean;
  q?: string;
  sort?: string;
}

export interface UpdateUserDto {
  phone?: string;
  isActive?: boolean;
}

/**
 * Creates a new RETAILER or DELIVERY user account with mandatory password change flag.
 * Generates memorable temporary password if not explicitly supplied.
 */
export async function createUser({ username, role, phone, temporaryPassword }: CreateUserDto, _actorId: string) {
  const plainPassword = temporaryPassword || generateTemporaryPassword();
  const passwordHash = await hashPassword(plainPassword);

  const result = await query(
    `INSERT INTO users (username, password_hash, role, phone, is_active, must_change_password)
     VALUES ($1, $2, $3, $4, true, true)
     RETURNING id, username, role, phone, is_active, must_change_password, created_at, updated_at`,
    [username.toLowerCase().trim(), passwordHash, role, phone]
  );

  const user = toCamel(result.rows[0]);

  return {
    user,
    temporaryPassword: plainPassword,
  };
}

/**
 * Lists users with filtering by role, active state, search text, and pagination.
 */
export async function listUsers(queryParams: ListUsersQuery) {
  const { page, pageSize, offset } = parsePagination(queryParams);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (queryParams.role) {
    params.push(queryParams.role);
    conditions.push(`role = $${params.length}`);
  }

  if (queryParams.isActive !== undefined) {
    params.push(queryParams.isActive);
    conditions.push(`is_active = $${params.length}`);
  }

  if (queryParams.q) {
    params.push(`%${queryParams.q.trim()}%`);
    conditions.push(`(username ILIKE $${params.length} OR phone ILIKE $${params.length})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Count total matching items
  const countResult = await query(`SELECT COUNT(*) AS total FROM users ${whereClause}`, params);
  const totalItems = parseInt(countResult.rows[0]?.total || '0', 10);

  // Sorting
  const sortMap: Record<string, string> = {
    createdAt: 'created_at',
    username: 'username',
    role: 'role',
    isActive: 'is_active',
  };
  const orderBy = buildOrderBy(queryParams.sort, sortMap, 'created_at DESC');

  // Query records
  const queryParamsWithPaging = [...params, pageSize, offset];
  const listResult = await query(
    `SELECT id, username, role, phone, is_active, must_change_password, created_at, updated_at
     FROM users
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    queryParamsWithPaging
  );

  return {
    rows: toCamelList(listResult.rows),
    totalItems,
  };
}

/**
 * Fetches user profile by ID without exposing password hash.
 */
export async function getUserById(userId: string) {
  const result = await query(
    `SELECT id, username, role, phone, is_active, must_change_password, created_at, updated_at
     FROM users
     WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: `User with id ${userId} was not found`,
    });
  }

  return toCamel(result.rows[0]);
}

/**
 * Updates user attributes (phone, is_active). Prevents admin from self-deactivating.
 * If user is deactivated, immediately revokes all active auth sessions.
 */
export async function updateUser(userId: string, { phone, isActive }: UpdateUserDto, actor: AuthenticatedUser) {
  // Prevent self-deactivation
  if (isActive === false && userId === actor.userId) {
    throw new ForbiddenError({
      code: ERROR_CODES.FORBIDDEN,
      message: 'Admins cannot deactivate their own account',
    });
  }

  const existing = await getUserById(userId);

  const updatedPhone = phone !== undefined ? phone : existing.phone;
  const updatedIsActive = isActive !== undefined ? isActive : existing.isActive;

  const result = await query(
    `UPDATE users
     SET phone = $1, is_active = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, username, role, phone, is_active, must_change_password, created_at, updated_at`,
    [updatedPhone, updatedIsActive, userId]
  );

  // If user was deactivated, revoke all active sessions immediately
  if (isActive === false) {
    await query('UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1', [userId]);
  }

  return toCamel(result.rows[0]);
}

/**
 * Resets user credentials, generating a memorable temporary password,
 * forcing must_change_password, clearing lockouts, and revoking all sessions.
 */
export async function resetPassword(userId: string, _actor: AuthenticatedUser) {
  await getUserById(userId);

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await withTransaction(async (client) => {
    await client.query(
      `UPDATE users
       SET password_hash = $1, must_change_password = true, failed_login_count = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $2`,
      [passwordHash, userId]
    );

    await client.query('UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1', [
      userId,
    ]);
  });

  return {
    temporaryPassword,
  };
}
