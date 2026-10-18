import { query } from '../../config/db.js';
import { toCamel, toCamelList } from '../../utils/case.js';
import { parsePagination, buildOrderBy } from '../../utils/pagination.js';
import { NotFoundError, ConflictError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import type { ApprovalStatus } from '../../enums/approval-status.enum.js';

export interface UpsertProfileDto {
  shopName: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  whatsappNumber: string;
  email?: string;
  drugLicenseNumber: string;
  gstin?: string;
}

export interface ListRetailersQuery {
  page?: number;
  pageSize?: number;
  approvalStatus?: ApprovalStatus;
  q?: string;
  sort?: string;
}

/**
 * Retrieves the current retailer's profile and approval status.
 * Returns null profile when not yet submitted.
 */
export async function getMine(userId: string) {
  const result = await query(
    `SELECT * FROM retailer_profiles WHERE user_id = $1`,
    [userId]
  );

  if (result.rowCount === 0) {
    return {
      profile: null,
      approvalStatus: null,
    };
  }

  const row = result.rows[0];
  return {
    profile: toCamel(row),
    approvalStatus: row.approval_status as ApprovalStatus,
  };
}

/**
 * Creates or updates the retailer profile for the current authenticated user.
 * Re-submitting transitions status back to PENDING and clears previous rejection reasons.
 * Fails with 409 INVALID_STATE_TRANSITION if profile is already APPROVED.
 */
export async function upsertMine(userId: string, dto: UpsertProfileDto) {
  // Check if profile exists and if it's already APPROVED
  const existing = await query(
    `SELECT approval_status FROM retailer_profiles WHERE user_id = $1`,
    [userId]
  );

  if (existing.rowCount && existing.rows[0].approval_status === 'APPROVED') {
    throw new ConflictError({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
      message: 'Approved profiles cannot be edited directly. Please contact support.',
    });
  }

  const normalizedLicense = dto.drugLicenseNumber.trim().toUpperCase();
  const normalizedGstin = dto.gstin?.trim() ? dto.gstin.trim().toUpperCase() : null;
  const emailValue = dto.email?.trim() ? dto.email.trim() : null;

  try {
    const result = await query(
      `INSERT INTO retailer_profiles (
         user_id,
         shop_name,
         address_line,
         city,
         state,
         pincode,
         whatsapp_number,
         email,
         drug_license_number,
         gstin,
         approval_status,
         rejection_reason,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', NULL, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         shop_name = EXCLUDED.shop_name,
         address_line = EXCLUDED.address_line,
         city = EXCLUDED.city,
         state = EXCLUDED.state,
         pincode = EXCLUDED.pincode,
         whatsapp_number = EXCLUDED.whatsapp_number,
         email = EXCLUDED.email,
         drug_license_number = EXCLUDED.drug_license_number,
         gstin = EXCLUDED.gstin,
         approval_status = 'PENDING',
         rejection_reason = NULL,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        dto.shopName.trim(),
        dto.addressLine.trim(),
        dto.city.trim(),
        dto.state.trim(),
        dto.pincode.trim(),
        dto.whatsappNumber.trim(),
        emailValue,
        normalizedLicense,
        normalizedGstin,
      ]
    );

    const row = result.rows[0];
    return {
      profile: toCamel(row),
      approvalStatus: row.approval_status as ApprovalStatus,
    };
  } catch (err: unknown) {
    const pgErr = err as { code?: string; constraint?: string; detail?: string; message?: string };
    if (pgErr.code === '23505') {
      const constraint = pgErr.constraint || '';
      const detail = pgErr.detail || '';
      if (constraint.includes('drug_license_number') || detail.includes('drug_license_number')) {
        throw new ConflictError({
          code: ERROR_CODES.DUPLICATE_RESOURCE,
          message: 'Drug license number is already registered with another account',
          errors: [{ field: 'drugLicenseNumber', code: 'DUPLICATE', message: 'Drug license number is already in use' }],
          cause: err,
        });
      }
      if (constraint.includes('gstin') || detail.includes('gstin')) {
        throw new ConflictError({
          code: ERROR_CODES.DUPLICATE_RESOURCE,
          message: 'GSTIN is already registered with another account',
          errors: [{ field: 'gstin', code: 'DUPLICATE', message: 'GSTIN is already in use' }],
          cause: err,
        });
      }
      throw new ConflictError({
        code: ERROR_CODES.DUPLICATE_RESOURCE,
        message: 'A retailer profile with this identifier already exists',
        cause: err,
      });
    }
    throw err;
  }
}

/**
 * Lists retailer applications with status filtering, search text, and pagination.
 */
export async function listRetailers(queryParams: ListRetailersQuery) {
  const { page, pageSize, offset } = parsePagination(queryParams);
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (queryParams.approvalStatus) {
    params.push(queryParams.approvalStatus);
    conditions.push(`rp.approval_status = $${params.length}`);
  }

  if (queryParams.q) {
    params.push(`%${queryParams.q.trim()}%`);
    const qIndex = params.length;
    conditions.push(`(
      rp.shop_name ILIKE $${qIndex} OR
      rp.drug_license_number ILIKE $${qIndex} OR
      rp.whatsapp_number ILIKE $${qIndex} OR
      u.username ILIKE $${qIndex}
    )`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const orderByClause = buildOrderBy(queryParams.sort, {
    allowedColumns: ['shopName', 'createdAt', 'updatedAt', 'approvalStatus'],
    defaultColumn: 'created_at',
    defaultDirection: 'DESC',
    columnMap: {
      shopName: 'rp.shop_name',
      createdAt: 'rp.created_at',
      updatedAt: 'rp.updated_at',
      approvalStatus: 'rp.approval_status',
    },
  });

  const sql = `
    SELECT rp.*, u.username, u.phone AS user_phone, u.is_active AS user_is_active,
           COUNT(*) OVER() AS total_count
    FROM retailer_profiles rp
    JOIN users u ON rp.user_id = u.id
    ${whereClause}
    ${orderByClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  params.push(pageSize, offset);

  const result = await query(sql, params);
  const totalItems = result.rows.length ? parseInt(result.rows[0].total_count, 10) : 0;
  const rows = toCamelList(
    result.rows.map(({ total_count, ...row }) => row)
  );

  return { rows, totalItems };
}

/**
 * Retrieves a single retailer profile by userId, including linked user metadata.
 */
export async function getRetailerById(userId: string) {
  const result = await query(
    `SELECT rp.*, u.username, u.phone AS user_phone, u.is_active AS user_is_active
     FROM retailer_profiles rp
     JOIN users u ON rp.user_id = u.id
     WHERE rp.user_id = $1`,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Retailer profile not found',
    });
  }

  return toCamel(result.rows[0]);
}

/**
 * Approves or rejects a pending retailer profile.
 * Only PENDING applications can be reviewed.
 */
export async function reviewRetailer(
  adminId: string,
  userId: string,
  decision: 'APPROVE' | 'REJECT',
  reason?: string
) {
  const newStatus: ApprovalStatus = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
  const rejectionReason = decision === 'REJECT' ? reason?.trim() || null : null;

  const result = await query(
    `UPDATE retailer_profiles
     SET approval_status = $1,
         rejection_reason = $2,
         reviewed_by = $3,
         reviewed_at = NOW(),
         updated_at = NOW()
     WHERE user_id = $4 AND approval_status = 'PENDING'
     RETURNING *`,
    [newStatus, rejectionReason, adminId, userId]
  );

  if (result.rowCount === 0) {
    // Check if profile exists to deliver accurate error code
    const existing = await query(
      `SELECT approval_status FROM retailer_profiles WHERE user_id = $1`,
      [userId]
    );

    if (existing.rowCount === 0) {
      throw new NotFoundError({
        code: ERROR_CODES.NOT_FOUND,
        message: 'Retailer profile not found',
      });
    }

    throw new ConflictError({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
      message: `Only PENDING applications can be reviewed. Current status: ${existing.rows[0].approval_status}`,
    });
  }

  return toCamel(result.rows[0]);
}
