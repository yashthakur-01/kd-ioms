import { query } from '../../config/db.js';
import { ConflictError, NotFoundError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';
import { toCamel } from '../../utils/case.js';
import { normalizeName } from '../../utils/normalize.js';
import { mapDbError } from '../../utils/db-error-map.js';

export interface ListSaltsQuery {
  page?: number;
  pageSize?: number;
  q?: string;
  isActive?: boolean;
  sort?: string;
}

export interface CreateSaltInput {
  saltName: string;
  confirmSimilar?: boolean;
}

export interface UpdateSaltInput {
  saltName?: string;
  isActive?: boolean;
}

export interface ActorUser {
  userId: string;
  username: string;
  role: string;
}

export async function listSalts(params: ListSaltsQuery) {
  const page = params.page && params.page > 0 ? Number(params.page) : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? Number(params.pageSize) : 20;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (params.q) {
    conditions.push(`LOWER(s.salt_name) ILIKE '%' || LOWER($${paramIdx}) || '%'`);
    values.push(params.q);
    paramIdx++;
  }

  if (params.isActive !== undefined) {
    conditions.push(`s.is_active = $${paramIdx}`);
    values.push(params.isActive);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Allowed sorts
  let orderBy = 's.salt_name ASC';
  if (params.sort) {
    const [field, dir] = params.sort.split(':');
    const direction = dir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    if (field === 'saltName') {
      orderBy = `s.salt_name ${direction}`;
    } else if (field === 'createdAt') {
      orderBy = `s.created_at ${direction}`;
    } else if (field === 'medicineCount') {
      orderBy = `medicine_count ${direction}, s.salt_name ASC`;
    }
  }

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM salts s
    ${whereClause}
  `;

  const dataSql = `
    SELECT 
      s.salt_id,
      s.salt_name,
      s.is_active,
      s.created_at,
      s.updated_at,
      COUNT(m.medicine_id) FILTER (WHERE m.is_active = TRUE)::int AS medicine_count
    FROM salts s
    LEFT JOIN medicines m ON s.salt_id = ANY(m.salt_ids)
    ${whereClause}
    GROUP BY s.salt_id
    ORDER BY ${orderBy}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;

  const [countRes, dataRes] = await Promise.all([
    query<{ total: number }>(countSql, values),
    query(dataSql, [...values, pageSize, offset]),
  ]);

  const totalItems = countRes.rows[0]?.total ?? 0;
  const rows = dataRes.rows.map((row) => ({
    saltId: row.salt_id,
    saltName: row.salt_name,
    isActive: row.is_active,
    medicineCount: Number(row.medicine_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return { rows, totalItems };
}

export async function suggestSalts(q: string) {
  const sql = `
    SELECT 
      salt_id, 
      salt_name, 
      is_active,
      ROUND(similarity(LOWER(salt_name), LOWER($1))::numeric, 2)::float AS similarity
    FROM salts
    WHERE is_active = TRUE
      AND (
        similarity(LOWER(salt_name), LOWER($1)) > 0.3
        OR LOWER(salt_name) % LOWER($1)
        OR LOWER(salt_name) ILIKE '%' || LOWER($1) || '%'
      )
    ORDER BY similarity DESC, salt_name ASC
    LIMIT 10;
  `;

  const { rows } = await query(sql, [q]);
  return rows.map((r) => ({
    saltId: r.salt_id,
    saltName: r.salt_name,
    similarity: Number(r.similarity),
    isActive: r.is_active,
  }));
}

export async function createSalt(input: CreateSaltInput, actor: ActorUser) {
  const name = normalizeName(input.saltName);

  // 1. Exact case-insensitive check
  const exactCheck = await query<{ salt_id: number }>(
    'SELECT salt_id FROM salts WHERE LOWER(TRIM(salt_name)) = LOWER($1)',
    [name]
  );

  if (exactCheck.rows.length > 0) {
    throw new ConflictError({
      code: ERROR_CODES.DUPLICATE_RESOURCE,
      message: 'A salt with this name already exists',
      errors: [{ field: 'saltName', code: 'DUPLICATE', message: 'A salt with this name already exists' }],
    });
  }

  // 2. Similarity check using pg_trgm unless explicitly confirmed
  if (!input.confirmSimilar) {
    const similarSql = `
      SELECT 
        salt_id, 
        salt_name, 
        ROUND(similarity(LOWER(salt_name), LOWER($1))::numeric, 2)::float AS score
      FROM salts
      WHERE similarity(LOWER(salt_name), LOWER($1)) > 0.5
      ORDER BY score DESC
      LIMIT 5;
    `;

    const { rows: similarRows } = await query<{ salt_id: number; salt_name: string; score: number }>(
      similarSql,
      [name]
    );

    if (similarRows.length > 0) {
      throw new ConflictError({
        code: ERROR_CODES.SALT_SIMILAR_EXISTS,
        message: 'Similar salts already exist',
        errors: [
          {
            field: 'saltName',
            code: 'SIMILAR_EXISTS',
            message: 'Similar salts already exist. Confirm to proceed.',
            details: {
              matches: similarRows.map((r) => ({
                saltId: r.salt_id,
                saltName: r.salt_name,
                score: Number(r.score),
              })),
            },
          },
        ],
      });
    }
  }

  // 3. Insert record
  try {
    const insertSql = `
      INSERT INTO salts (salt_name, created_by)
      VALUES ($1, $2)
      RETURNING salt_id, salt_name, is_active, created_at, updated_at;
    `;
    const { rows } = await query(insertSql, [name, actor.userId]);
    return toCamel(rows[0]);
  } catch (err) {
    throw mapDbError(err);
  }
}

export async function updateSalt(saltId: number, input: UpdateSaltInput, _actor: ActorUser) {
  // 1. Existence check
  const checkRes = await query<{ salt_id: number; salt_name: string; is_active: boolean }>(
    'SELECT salt_id, salt_name, is_active FROM salts WHERE salt_id = $1',
    [saltId]
  );

  const existing = checkRes.rows[0];
  if (!existing) {
    throw new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: 'Salt not found',
    });
  }

  // 2. Deactivation check
  if (input.isActive === false && existing.is_active) {
    const inUseRes = await query<{ cnt: number }>(
      'SELECT COUNT(*)::int AS cnt FROM medicines WHERE is_active = TRUE AND $1 = ANY(salt_ids)',
      [saltId]
    );
    const count = inUseRes.rows[0]?.cnt ?? 0;
    if (count > 0) {
      throw new ConflictError({
        code: ERROR_CODES.SALT_IN_USE,
        message: 'Cannot deactivate salt that is linked to active medicines',
        errors: [
          {
            field: 'isActive',
            code: 'SALT_IN_USE',
            message: `Cannot deactivate salt linked to ${count} active medicine(s)`,
          },
        ],
      });
    }
  }

  // 3. Name check & normalization
  let normalizedName: string | undefined = undefined;
  if (input.saltName !== undefined) {
    normalizedName = normalizeName(input.saltName);
    if (normalizedName.toLowerCase() !== existing.salt_name.toLowerCase()) {
      const dupCheck = await query<{ salt_id: number }>(
        'SELECT salt_id FROM salts WHERE LOWER(TRIM(salt_name)) = LOWER($1) AND salt_id != $2',
        [normalizedName, saltId]
      );
      if (dupCheck.rows.length > 0) {
        throw new ConflictError({
          code: ERROR_CODES.DUPLICATE_RESOURCE,
          message: 'A salt with this name already exists',
          errors: [{ field: 'saltName', code: 'DUPLICATE', message: 'A salt with this name already exists' }],
        });
      }
    }
  }

  // 4. Update row
  try {
    const updateSql = `
      UPDATE salts
      SET salt_name = COALESCE($1, salt_name),
          is_active = COALESCE($2, is_active),
          updated_at = NOW()
      WHERE salt_id = $3
      RETURNING salt_id, salt_name, is_active, created_at, updated_at;
    `;
    const { rows } = await query(updateSql, [
      normalizedName ?? null,
      input.isActive !== undefined ? input.isActive : null,
      saltId,
    ]);
    return toCamel(rows[0]);
  } catch (err) {
    throw mapDbError(err);
  }
}
