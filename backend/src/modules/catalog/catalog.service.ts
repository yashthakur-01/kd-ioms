import { query } from '../../config/db.js';
import { NotFoundError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';

export interface ListCatalogQuery {
  q?: string;
  saltId?: number;
  inStock?: boolean;
  sort?: 'name' | '-name' | 'price' | '-price';
  page?: number;
  pageSize?: number;
}

export interface CatalogSalt {
  saltId: number;
  saltName: string;
}

export interface CatalogItem {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  saltsText: string;
  salts: CatalogSalt[];
  gstRate: string;
  maxMrp: string | null;
  maxPriceInclGst: string | null;
  availableQty: number;
  inStock: boolean;
}

export interface OutOfStockAlertItem {
  medicineId: number;
  name: string;
  company: string;
  packSize: string;
  saltsText: string;
  gstRate: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  maxMrp: string | null;
}

interface RawCatalogRow {
  medicine_id: number;
  name: string;
  company: string;
  pack_size: string;
  salts_text: string;
  salt_ids: number[] | null;
  gst_rate: string | number;
  max_mrp: string | number | null;
  max_price_incl_gst: string | number | null;
  available_qty: number;
  in_stock: boolean;
}

interface RawAlertRow {
  medicine_id: number;
  name: string;
  company: string;
  pack_size: string;
  salts_text: string;
  gst_rate: string | number;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  max_mrp: string | number | null;
}

/**
 * Hydrates salt names for a set of salt IDs
 */
async function getSaltNamesMap(saltIds: number[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (!saltIds.length) return map;

  const { rows } = await query<{ salt_id: number; salt_name: string }>(
    'SELECT salt_id, salt_name FROM salts WHERE salt_id = ANY($1)',
    [saltIds]
  );

  for (const r of rows) {
    map.set(r.salt_id, r.salt_name);
  }
  return map;
}

function mapCatalogRow(row: RawCatalogRow, saltNamesMap: Map<number, string>): CatalogItem {
  const saltIds = row.salt_ids || [];
  const salts: CatalogSalt[] = saltIds.map((id) => ({
    saltId: id,
    saltName: saltNamesMap.get(id) || '',
  }));

  const gstNumeric = typeof row.gst_rate === 'number' ? row.gst_rate : parseFloat(row.gst_rate);
  const maxMrpNumeric = row.max_mrp != null ? (typeof row.max_mrp === 'number' ? row.max_mrp : parseFloat(row.max_mrp)) : null;
  const maxPriceNumeric = row.max_price_incl_gst != null ? (typeof row.max_price_incl_gst === 'number' ? row.max_price_incl_gst : parseFloat(row.max_price_incl_gst)) : null;

  return {
    medicineId: row.medicine_id,
    name: row.name,
    company: row.company,
    packSize: row.pack_size,
    saltsText: row.salts_text || '',
    salts,
    gstRate: Number.isFinite(gstNumeric) ? gstNumeric.toFixed(2) : '12.00',
    maxMrp: maxMrpNumeric != null && Number.isFinite(maxMrpNumeric) ? maxMrpNumeric.toFixed(2) : null,
    maxPriceInclGst: maxPriceNumeric != null && Number.isFinite(maxPriceNumeric) ? maxPriceNumeric.toFixed(2) : null,
    availableQty: row.available_qty,
    inStock: row.in_stock,
  };
}

/**
 * Lists catalog items with debounced search, salt filtering, in-stock toggle, and sorting
 */
export async function getCatalog(
  filters: ListCatalogQuery
): Promise<{ rows: CatalogItem[]; totalItems: number }> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.q) {
    params.push(`%${filters.q}%`);
    const idx = params.length;
    conditions.push(`(name ILIKE $${idx} OR company ILIKE $${idx} OR salts_text ILIKE $${idx})`);
  }

  if (filters.saltId) {
    params.push(filters.saltId);
    const idx = params.length;
    conditions.push(`$${idx} = ANY(salt_ids)`);
  }

  if (filters.inStock === true) {
    conditions.push('available_qty > 0');
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  let orderClause = 'ORDER BY name ASC';
  if (filters.sort === '-name') {
    orderClause = 'ORDER BY name DESC';
  } else if (filters.sort === 'price') {
    orderClause = 'ORDER BY max_price_incl_gst ASC NULLS LAST, name ASC';
  } else if (filters.sort === '-price') {
    orderClause = 'ORDER BY max_price_incl_gst DESC NULLS LAST, name ASC';
  }

  // 1. Get total count
  const countSql = `SELECT COUNT(*)::INT AS total FROM v_catalog ${whereClause}`;
  const countResult = await query<{ total: number }>(countSql, params);
  const totalItems = countResult.rows[0]?.total || 0;

  // 2. Fetch paginated records
  const queryParams = [...params, pageSize, offset];
  const listSql = `
    SELECT
      medicine_id,
      name,
      company,
      pack_size,
      salts_text,
      salt_ids,
      gst_rate,
      max_mrp,
      max_price_incl_gst,
      available_qty,
      in_stock
    FROM v_catalog
    ${whereClause}
    ${orderClause}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const { rows } = await query<RawCatalogRow>(listSql, queryParams);

  // 3. Collect unique salt IDs
  const allSaltIds = new Set<number>();
  for (const r of rows) {
    if (r.salt_ids && Array.isArray(r.salt_ids)) {
      for (const id of r.salt_ids) {
        allSaltIds.add(id);
      }
    }
  }

  const saltNamesMap = await getSaltNamesMap([...allSaltIds]);

  return {
    rows: rows.map((r) => mapCatalogRow(r, saltNamesMap)),
    totalItems,
  };
}

/**
 * Retrieves a single catalog item by ID with full information masking (no batch numbers or purchase rates)
 */
export async function getCatalogItem(medicineId: number): Promise<CatalogItem> {
  const sql = `
    SELECT
      medicine_id,
      name,
      company,
      pack_size,
      salts_text,
      salt_ids,
      gst_rate,
      max_mrp,
      max_price_incl_gst,
      available_qty,
      in_stock
    FROM v_catalog
    WHERE medicine_id = $1
  `;

  const { rows } = await query<RawCatalogRow>(sql, [medicineId]);
  if (!rows.length) {
    throw new NotFoundError({
      code: ERROR_CODES.NOT_FOUND,
      message: `Medicine with ID ${medicineId} not found in catalog`,
    });
  }

  const row = rows[0];
  const saltIds = row.salt_ids || [];
  const saltNamesMap = await getSaltNamesMap(saltIds);

  return mapCatalogRow(row, saltNamesMap);
}

/**
 * Retrieves out-of-stock active medicines for the Admin alerts queue
 */
export async function getOutOfStockAlerts(pagination: {
  page?: number;
  pageSize?: number;
}): Promise<{ rows: OutOfStockAlertItem[]; totalItems: number }> {
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.min(50, Math.max(1, pagination.pageSize || 20));
  const offset = (page - 1) * pageSize;

  const countSql = `
    SELECT COUNT(*)::INT AS total 
    FROM v_medicine_availability 
    WHERE available_qty = 0
  `;
  const countResult = await query<{ total: number }>(countSql);
  const totalItems = countResult.rows[0]?.total || 0;

  const listSql = `
    SELECT
      medicine_id,
      name,
      company,
      pack_size,
      salts_text,
      gst_rate,
      on_hand_qty,
      reserved_qty,
      available_qty,
      max_mrp
    FROM v_medicine_availability
    WHERE available_qty = 0
    ORDER BY name ASC
    LIMIT $1 OFFSET $2
  `;

  const { rows } = await query<RawAlertRow>(listSql, [pageSize, offset]);

  const items: OutOfStockAlertItem[] = rows.map((r) => {
    const gstNumeric = typeof r.gst_rate === 'number' ? r.gst_rate : parseFloat(r.gst_rate);
    const maxMrpNumeric = r.max_mrp != null ? (typeof r.max_mrp === 'number' ? r.max_mrp : parseFloat(r.max_mrp)) : null;

    return {
      medicineId: r.medicine_id,
      name: r.name,
      company: r.company,
      packSize: r.pack_size,
      saltsText: r.salts_text || '',
      gstRate: Number.isFinite(gstNumeric) ? gstNumeric.toFixed(2) : '12.00',
      onHandQty: r.on_hand_qty,
      reservedQty: r.reserved_qty,
      availableQty: r.available_qty,
      maxMrp: maxMrpNumeric != null && Number.isFinite(maxMrpNumeric) ? maxMrpNumeric.toFixed(2) : null,
    };
  });

  return {
    rows: items,
    totalItems,
  };
}
