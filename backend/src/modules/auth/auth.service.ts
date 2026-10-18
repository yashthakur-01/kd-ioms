import { query, withTransaction } from '../../config/db.js';
import {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  newRefreshToken,
  hashRefreshToken,
} from '../../utils/crypto.js';
import { signAccessToken } from '../../utils/tokens.js';
import { AppError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import type { UserRole } from '../../enums/user-role.enum.js';
import { logger } from '../../config/logger.js';

export interface LoginParams {
  username: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface RefreshParams {
  refreshToken: string;
  ip?: string;
  userAgent?: string;
}

export interface ChangePasswordParams {
  userId: string;
  currentPassword: string;
  newPassword: string;
  currentRefreshToken?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Authenticates user credentials, enforces account lockout after 5 consecutive failures,
 * issues rotating session refresh token, and signs a 15-minute access token.
 */
export async function login({ username, password, ip = 'unknown', userAgent = 'unknown' }: LoginParams) {
  const result = await query(
    `SELECT id, username, password_hash, role, phone, is_active, must_change_password, failed_login_count, locked_until
     FROM users
     WHERE LOWER(username) = LOWER($1)`,
    [username]
  );

  const user = result.rows[0];

  // 1. Account Lockout Check
  if (user && user.locked_until && new Date() < new Date(user.locked_until)) {
    throw new AppError({
      code: ERROR_CODES.AUTH_ACCOUNT_LOCKED,
      httpStatus: 403,
      message: 'Account is temporarily locked due to consecutive failed login attempts',
      details: { lockedUntil: user.locked_until },
    });
  }

  // 2. Uniform timing check if user does not exist
  if (!user) {
    await verifyDummyPassword(password);
    throw new AppError({
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      httpStatus: 401,
      message: 'Invalid username or password',
    });
  }

  // 3. Password Verification
  const isPasswordValid = await verifyPassword(password, user.password_hash);

  if (!isPasswordValid) {
    const newCount = (user.failed_login_count || 0) + 1;
    if (newCount >= 5) {
      await query(
        "UPDATE users SET failed_login_count = $1, locked_until = NOW() + INTERVAL '15 minutes' WHERE id = $2",
        [newCount, user.id]
      );
      throw new AppError({
        code: ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        httpStatus: 403,
        message: 'Account has been locked for 15 minutes due to 5 failed login attempts',
      });
    }

    await query('UPDATE users SET failed_login_count = $1 WHERE id = $2', [newCount, user.id]);
    throw new AppError({
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      httpStatus: 401,
      message: 'Invalid username or password',
    });
  }

  // 4. Inactive Account Check
  if (!user.is_active) {
    throw new AppError({
      code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
      httpStatus: 403,
      message: 'Your account has been deactivated. Please contact support.',
    });
  }

  // 5. Reset lockout counter on success
  await query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [user.id]);

  // 6. Session Creation & Token Issuance
  const rawRefreshToken = newRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);

  await query(
    `INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
    [user.id, tokenHash, userAgent, ip]
  );

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role as UserRole,
    phone: user.phone,
    mustChangePassword: user.must_change_password,
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    expiresIn: 900,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      phone: user.phone,
      mustChangePassword: user.must_change_password,
    },
  };
}

/**
 * Rotates an existing refresh token atomically. Detects token reuse/replay and revokes
 * all active user sessions upon replay detection.
 */
export async function refresh({ refreshToken, ip = 'unknown', userAgent = 'unknown' }: RefreshParams) {
  if (!refreshToken) {
    throw new AppError({
      code: ERROR_CODES.AUTH_REFRESH_INVALID,
      httpStatus: 401,
      message: 'Refresh token is required',
    });
  }

  const tokenHash = hashRefreshToken(refreshToken);

  const sessionResult = await query(
    `SELECT id, user_id, is_revoked, expires_at
     FROM auth_sessions
     WHERE refresh_token_hash = $1`,
    [tokenHash]
  );

  if (sessionResult.rows.length === 0) {
    throw new AppError({
      code: ERROR_CODES.AUTH_REFRESH_INVALID,
      httpStatus: 401,
      message: 'Invalid refresh token',
    });
  }

  const session = sessionResult.rows[0];

  // Token Reuse / Replay Detection: Revoke all active sessions for this user!
  if (session.is_revoked) {
    logger.warn({ userId: session.user_id }, 'Refresh token replay detected. Revoking session family.');
    await query('UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1', [
      session.user_id,
    ]);
    throw new AppError({
      code: ERROR_CODES.AUTH_REFRESH_INVALID,
      httpStatus: 401,
      message: 'Invalid refresh token: token replay detected',
    });
  }

  // Expiration Check
  if (new Date() > new Date(session.expires_at)) {
    throw new AppError({
      code: ERROR_CODES.AUTH_REFRESH_INVALID,
      httpStatus: 401,
      message: 'Refresh token has expired',
    });
  }

  // Load User to ensure active status
  const userResult = await query(
    'SELECT id, username, role, phone, is_active, must_change_password FROM users WHERE id = $1',
    [session.user_id]
  );

  if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
    throw new AppError({
      code: ERROR_CODES.AUTH_ACCOUNT_INACTIVE,
      httpStatus: 403,
      message: 'User account is inactive or not found',
    });
  }

  const user = userResult.rows[0];
  const newRawRefreshToken = newRefreshToken();
  const newTokenHash = hashRefreshToken(newRawRefreshToken);

  // Atomically revoke current session and issue replacement session
  await withTransaction(async (client) => {
    await client.query('UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE id = $1', [
      session.id,
    ]);

    await client.query(
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [user.id, newTokenHash, userAgent, ip]
    );
  });

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role as UserRole,
    phone: user.phone,
    mustChangePassword: user.must_change_password,
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    expiresIn: 900,
  };
}

/**
 * Revokes the session associated with the provided refresh token.
 */
export async function logout({ refreshToken }: { refreshToken?: string }) {
  if (refreshToken) {
    const tokenHash = hashRefreshToken(refreshToken);
    await query(
      'UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE refresh_token_hash = $1',
      [tokenHash]
    );
  }
}

/**
 * Updates password, revokes competing active sessions, and rotates the current session.
 */
export async function changePassword({
  userId,
  currentPassword,
  newPassword,
  currentRefreshToken,
  ip = 'unknown',
  userAgent = 'unknown',
}: ChangePasswordParams) {
  const userResult = await query('SELECT id, username, role, phone, password_hash FROM users WHERE id = $1', [
    userId,
  ]);

  if (userResult.rows.length === 0) {
    throw new AppError({
      code: ERROR_CODES.AUTH_TOKEN_INVALID,
      httpStatus: 401,
      message: 'User account not found',
    });
  }

  const user = userResult.rows[0];

  const isValid = await verifyPassword(currentPassword, user.password_hash);
  if (!isValid) {
    throw new AppError({
      code: ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      httpStatus: 401,
      message: 'Current password is incorrect',
    });
  }

  const newHash = await hashPassword(newPassword);
  const newRawRefreshToken = newRefreshToken();
  const newTokenHash = hashRefreshToken(newRawRefreshToken);

  await withTransaction(async (client) => {
    // 1. Update user password and clear must_change_password
    await client.query(
      'UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    // 2. Revoke other sessions
    if (currentRefreshToken) {
      const currentHash = hashRefreshToken(currentRefreshToken);
      await client.query(
        'UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1 AND refresh_token_hash != $2',
        [userId, currentHash]
      );
      // Revoke old current session
      await client.query(
        'UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE refresh_token_hash = $1',
        [currentHash]
      );
    } else {
      await client.query(
        'UPDATE auth_sessions SET is_revoked = true, updated_at = NOW() WHERE user_id = $1',
        [userId]
      );
    }

    // 3. Insert newly rotated session for the current device
    await client.query(
      `INSERT INTO auth_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [userId, newTokenHash, userAgent, ip]
    );
  });

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    role: user.role as UserRole,
    phone: user.phone,
    mustChangePassword: false,
  });

  return {
    accessToken,
    refreshToken: newRawRefreshToken,
    expiresIn: 900,
  };
}

/**
 * Returns the profile of the authenticated user.
 */
export async function getMe(userId: string) {
  const result = await query(
    'SELECT id, username, role, phone, must_change_password FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    throw new AppError({
      code: ERROR_CODES.NOT_FOUND,
      httpStatus: 404,
      message: 'User profile not found',
    });
  }

  const user = result.rows[0];
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    phone: user.phone,
    mustChangePassword: user.must_change_password,
  };
}
