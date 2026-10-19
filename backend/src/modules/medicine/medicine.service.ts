import { query } from '../../config/db.js';
import { ConflictError, NotFoundError, ValidationError, BusinessRuleError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { normalizeName } from '../../utils/normalize.js';
import { mapDbError } from '../../utils/db-error-map.js';

export interface CreateMedicineInput {
  name: string;
  company: string;
  packSize?: string;
  gstRate: number;
  saltIds: number[];
}

export interface UpdateMedicineInput {
  name?: string;
  company?: string;
  packSize?: string;
  gstRate?: number;
  saltIds?: number[];
  isActive?: boolean;
}

export interface ListMedicinesQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  saltId?: number;
  company?: string;
  isActive?: boolean;
  sort?: string;
}

export interface ActorUser {
  userId: string;
  username: string;
  role: string;
}

interface SaltRow {
  salt_id: number;
  salt_name: string;
  is_active: boolean;
}

interface MedicineRow {
  medicine_id: number;
  name: string;
  company: string;
  pack_size: string;
  gst_rate: string | number;
  salt_ids: number[];
  salts_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Validates that all supplied salt IDs exist and are active.
 * Throws a ValidationError targeting the specific saltIds.<index> path if invalid.
 */
export async function validateSaltIds(saltIds: number[]): Promise<Map<number, string>> {
  const saltMap = new Map<number, string>();
  if (!saltIds || saltIds.length === 0) {
    return saltMap;
  }

  const { rows } = await query<SaltRow>(
    'SELECT salt_id, salt_name, is_active FROM salts WHERE salt_id = ANY($1)',
    [saltIds]
  );

  const existingMap = new Map<number, SaltRow>();
  for (const r of rows) {
    existingMap.set(r.salt_id, r);
  }

  const errors: Array<{ field: string; code: string; message: string }> = [];
  saltIds.forEach((id, index) => {
    const salt = existingMap.get(id);
    if (!salt || !salt.is_active) {
      errors.push({
        field: `saltIds.${index}`,
        code: 'INVALID_SALT',
        message: `Salt ID ${id} does not exist or is inactive`,
      });
    } else {
      saltMap.set(salt.salt_id, salt.salt_name);
    }
  });

  if (errors.length > 0) {
    throw new ValidationError({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'One or more salt IDs are invalid or inactive',
      errors,
    });
  }

  return saltMap;
}

function mapMedicineRecord(row: MedicineRow, saltNamesMap?: Map<number, string>) {
  const saltIds = row.salt_ids || [];
  const salts = saltIds.map((id) => ({
    saltId: id,
    saltName: saltNamesMap?.get(id) || '',
  }));

  const gstNumeric = typeof row.gst_rate === 'number' ? row.gst_rate : parseFloat(row.gst_rate);

  return {
    medicineId: row.medicine_id,
    name: row.name,
    company: row.company,
    packSize: row.pack_size,
    gstRate: Number.isFinite(gstNumeric) ? gstNumeric.toFixed(2) : '12.00',
    saltIds,
    saltsText: row.salts_text,
    salts,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createMedicine(input: CreateMedicineInput, actor: ActorUser) {
  const name = normalizeName(input.name);
  const company = normalizeName(input.company);
  const packSize = normalizeName(input.packSize || '');
  const saltIds = input.saltIds || [];

  // 1. Validate salt IDs
  const saltNamesMap = await validateSaltIds(saltIds);

  // 2. Case-insensitive duplicate identity check
  const dupCheck = await query<{ medicine_id: number }>(
    `SELECT medicine_id FROM medicines 
     WHERE LOWER(TRIM(name)) = LOWER($1) 
       AND LOWER(TRIM(company)) = LOWER($2) 
       AND LOWER(TRIM(pack_size)) = LOWER($3)`,
    [name, company, packSize]
  );

  if (dupCheck.rows.length > 0) {
    throw new ConflictError({
      code: ERROR_CODES.DUPLICATE_RESOURCE,
      message: 'A medicine with this name, company, and pack size already exists',
      errors: [{ field: 'name', code: 'DUPLICATE', message: 'A medicine with this name, company, and pack size already exists' }],
    });
  }

  // 3. Insert medicine record (DB trigger trg_medicines_salts_text builds salts_text automatically)
  try {
    const insertSql = `
      INSERT INTO medicines (name, company, pack_size, gst_rate, salt_ids, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING medicine_id, name, company, pack_size, gst_rate, salt_ids, salts_text, is_active, created_at, updated_at;
    `;
    const { rows } = await query<MedicineRow>(insertSql, [
      name,
      company,
      packSize,
      input.gstRate,
      saltIds,
      actor.userId,
    ]);

    return mapMedicineRecord(rows[0], saltNamesMap);
  } catch (err) {
    throw mapDbError(err);
  }
}

export async function listMedicines(params: ListMedicinesQuery) {
  const page = params.page && params.page > 0 ? Number(params.page) : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? Number(params.pageSize) : 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.q) {
    conditions.push(
      `(LOWER(name) ILIKE '%' || LOWER($${paramIdx}) || '%' OR LOWER(company) ILIKE '%' || LOWER($${paramIdx}) || '%' OR LOWER(salts_text) ILIKE '%' || LOWER($${paramIdx}) || '%')`
    );
    values.push(params.q);
    paramIdx++;
  }

  if (params.saltId !== undefined) {
    conditions.push(`$${paramIdx} = ANY(salt_ids)`);
    values.push(params.saltId);
    paramIdx++;
  }

  if (params.company) {
    conditions.push(`LOWER(company) ILIKE '%' || LOWER($${paramIdx}) || '%'`);
    values.push(params.company);
    paramIdx++;
  }

  if (params.isActive !== undefined) {
    conditions.push(`is_active = $${paramIdx}`);
    values.push(params.isActive);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Order sorting
  let orderBy = 'name ASC';
  if (params.sort) {
    const [field, dir] = params.sort.split(':');
    const direction = dir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    if (field === 'name') {
      orderBy = `name ${direction}`;
    } else if (field === 'company') {
      orderBy = `company ${direction}`;
    } else if (field === 'createdAt') {
      orderBy = `created_at ${direction}`;
    }
  }

  const countSql = `SELECT COUNT(*)::int AS total FROM medicines ${whereClause}`;
  const dataSql = `
    SELECT medicine_id, name, company, pack_size, gst_rate, salt_ids, salts_text, is_active, created_at, updated_at
    FROM medicines
    ${whereClause}
    ORDER BY ${orderBy}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const [countRes, dataRes] = await Promise.all([
    query<{ total: number }>(countSql, values),
    query<MedicineRow>(dataSql, [...values, pageSize, offset]),
  ]);

  const totalItems = countRes.rows[0]?.total ?? 0;

  // Batch load all salt names needed for the page
  const allSaltIds = new Set<number>();
  dataRes.rows.forEach((r) => (r.salt_ids || []).forEach((id) => allSaltIds.add(id)));

  const saltMap = new Map<number, string>();
  if (allSaltIds.size > 0) {
    const saltRes = await query<{ salt_id: number; salt_name: string }>(
      'SELECT salt_id, salt_name FROM salts WHERE salt_id = ANY($1)',
      [Array.from(allSaltIds)]
    );
    saltRes.rows.forEach((s) => saltMap.set(s.salt_id, s.salt_name));
  }

  const rows = dataRes.rows.map((row) => mapMedicineRecord(row, saltMap));

  return { rows, totalItems };
}

export async function searchMedicines(q: string) {
  const sql = `
    SELECT 
      m.medicine_id, m.name, m.company, m.pack_size, m.gst_rate, m.salt_ids, m.salts_text, m.is_active,
      m.created_at, m.updated_at,
      ROUND(GREATEST(
        similarity(LOWER(m.name), LOWER($1)),
        similarity(LOWER(m.salts_text), LOWER($1))
      )::numeric, 2)::float AS score
    FROM medicines m
    WHERE m.is_active = TRUE
      AND (
        LOWER(m.name) % LOWER($1) OR similarity(LOWER(m.name), LOWER($1)) > 0.2
        OR LOWER(m.salts_text) % LOWER($1) OR similarity(LOWER(m.salts_text), LOWER($1)) > 0.2
        OR LOWER(m.name) ILIKE '%' || LOWER($1) || '%'
        OR LOWER(m.salts_text) ILIKE '%' || LOWER($1) || '%'
      )
    ORDER BY score DESC, m.name ASC
    LIMIT 15;
  `;

  const { rows } = await query<MedicineRow & { score: number }>(sql, [q]);

  const allSaltIds = new Set<number>();
  rows.forEach((r) => (r.salt_ids || []).forEach((id) => allSaltIds.add(id)));

  const saltMap = new Map<number, string>();
  if (allSaltIds.size > 0) {
    const saltRes = await query<{ salt_id: number; salt_name: string }>(
      'SELECT salt_id, salt_name FROM salts WHERE salt_id = ANY($1)',
      [Array.from(allSaltIds)]
    );
    saltRes.rows.forEach((s) => saltMap.set(s.salt_id, s.salt_name));
  }

  return rows.map((r) => ({
    ...mapMedicineRecord(r, saltMap),
    score: Number(r.score || 0),
  }));
}

export async function getMedicineById(medicineId: number) {
  const medicineRes = await query<MedicineRow>(
    `SELECT medicine_id, name, company, pack_size, gst_rate, salt_ids, salts_text, is_active, created_at, updated_at
     FROM medicines
     WHERE medicine_id = $1`,
    [medicineId]
  );

  const row = medicineRes.rows[0];
  if (!row) {
    throw new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Medicine not found',
    });
  }

  // Stock aggregates
  const batchRes = await query<{ on_hand: number; active_batch_count: number }>(
    `SELECT 
       COALESCE(SUM(quantity_on_hand), 0)::int AS on_hand,
       COUNT(*)::int AS active_batch_count
     FROM batches
     WHERE medicine_id = $1 AND status = 'ACTIVE' AND expiry_date >= today_ist()`,
    [medicineId]
  );

  const onHand = batchRes.rows[0]?.on_hand ?? 0;
  const activeBatchCount = batchRes.rows[0]?.active_batch_count ?? 0;

  // Salt details
  const saltMap = new Map<number, string>();
  if (row.salt_ids && row.salt_ids.length > 0) {
    const saltRes = await query<{ salt_id: number; salt_name: string }>(
      'SELECT salt_id, salt_name FROM salts WHERE salt_id = ANY($1)',
      [row.salt_ids]
    );
    saltRes.rows.forEach((s) => saltMap.set(s.salt_id, s.salt_name));
  }

  return {
    ...mapMedicineRecord(row, saltMap),
    onHand,
    activeBatchCount,
  };
}

export async function updateMedicine(medicineId: number, input: UpdateMedicineInput, _actor: ActorUser) {
  // 1. Existing check
  const checkRes = await query<MedicineRow>(
    `SELECT medicine_id, name, company, pack_size, gst_rate, salt_ids, salts_text, is_active
     FROM medicines WHERE medicine_id = $1`,
    [medicineId]
  );

  const existing = checkRes.rows[0];
  if (!existing) {
    throw new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Medicine not found',
    });
  }

  // 2. GST rate price ceiling guard
  if (input.gstRate !== undefined) {
    const existingGst = typeof existing.gst_rate === 'number' ? existing.gst_rate : parseFloat(existing.gst_rate);
    if (input.gstRate !== existingGst) {
      const ceilingViolations = await query<{ batch_id: number; batch_number: string; mrp: string; selling_price: string }>(
        `SELECT batch_id, batch_number, mrp, selling_price
         FROM batches
         WHERE medicine_id = $1
           AND status = 'ACTIVE'
           AND ROUND(selling_price * (1.0 + ($2 / 100.0)), 2) > mrp
         LIMIT 1`,
        [medicineId, input.gstRate]
      );

      if (ceilingViolations.rows.length > 0) {
        const violator = ceilingViolations.rows[0];
        throw new BusinessRuleError({
          code: ERROR_CODES.PRICE_EXCEEDS_MRP,
          message: `Cannot update GST rate: batch '${violator.batch_number}' selling price with new GST exceeds MRP`,
          errors: [
            {
              field: 'gstRate',
              code: 'PRICE_EXCEEDS_MRP',
              message: `Batch '${violator.batch_number}' effective selling price exceeds MRP (${violator.mrp}) at ${input.gstRate}% GST`,
            },
          ],
        });
      }
    }
  }

  // 3. Salt IDs validation if supplied
  let saltMap: Map<number, string> | undefined;
  if (input.saltIds !== undefined) {
    saltMap = await validateSaltIds(input.saltIds);
  }

  // 4. Duplicate identity check if identity fields are updated
  const newName = input.name !== undefined ? normalizeName(input.name) : existing.name;
  const newCompany = input.company !== undefined ? normalizeName(input.company) : existing.company;
  const newPackSize = input.packSize !== undefined ? normalizeName(input.packSize) : existing.pack_size;

  if (
    newName.toLowerCase() !== existing.name.toLowerCase() ||
    newCompany.toLowerCase() !== existing.company.toLowerCase() ||
    newPackSize.toLowerCase() !== existing.pack_size.toLowerCase()
  ) {
    const dupCheck = await query<{ medicine_id: number }>(
      `SELECT medicine_id FROM medicines 
       WHERE LOWER(TRIM(name)) = LOWER($1) 
         AND LOWER(TRIM(company)) = LOWER($2) 
         AND LOWER(TRIM(pack_size)) = LOWER($3)
         AND medicine_id != $4`,
      [newName, newCompany, newPackSize, medicineId]
    );

    if (dupCheck.rows.length > 0) {
      throw new ConflictError({
        code: ERROR_CODES.DUPLICATE_RESOURCE,
        message: 'A medicine with this name, company, and pack size already exists',
        errors: [{ field: 'name', code: 'DUPLICATE', message: 'A medicine with this name, company, and pack size already exists' }],
      });
    }
  }

  // 5. Build dynamic update
  const setClauses: string[] = [];
  const updateValues: unknown[] = [];
  let idx = 1;

  if (input.name !== undefined) {
    setClauses.push(`name = $${idx++}`);
    updateValues.push(newName);
  }
  if (input.company !== undefined) {
    setClauses.push(`company = $${idx++}`);
    updateValues.push(newCompany);
  }
  if (input.packSize !== undefined) {
    setClauses.push(`pack_size = $${idx++}`);
    updateValues.push(newPackSize);
  }
  if (input.gstRate !== undefined) {
    setClauses.push(`gst_rate = $${idx++}`);
    updateValues.push(input.gstRate);
  }
  if (input.saltIds !== undefined) {
    setClauses.push(`salt_ids = $${idx++}`);
    updateValues.push(input.saltIds);
  }
  if (input.isActive !== undefined) {
    setClauses.push(`is_active = $${idx++}`);
    updateValues.push(input.isActive);
  }

  setClauses.push('updated_at = NOW()');
  updateValues.push(medicineId);

  const updateSql = `
    UPDATE medicines
    SET ${setClauses.join(', ')}
    WHERE medicine_id = $${idx}
    RETURNING medicine_id, name, company, pack_size, gst_rate, salt_ids, salts_text, is_active, created_at, updated_at;
  `;

  try {
    const { rows } = await query<MedicineRow>(updateSql, updateValues);
    const updated = rows[0];

    // Load salt map if not already loaded
    if (!saltMap && updated.salt_ids && updated.salt_ids.length > 0) {
      saltMap = new Map();
      const saltRes = await query<{ salt_id: number; salt_name: string }>(
        'SELECT salt_id, salt_name FROM salts WHERE salt_id = ANY($1)',
        [updated.salt_ids]
      );
      saltRes.rows.forEach((s) => saltMap!.set(s.salt_id, s.salt_name));
    }

    return mapMedicineRecord(updated, saltMap);
  } catch (err) {
    throw mapDbError(err);
  }
}
