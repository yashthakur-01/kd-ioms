import { pool, query } from '../../config/db.js';

export interface BusinessProfile {
  name: string;
  address: string;
  gstin: string;
  drugLicenseNumber: string;
  phone: string;
  email: string;
  logoPath?: string | null;
}

export interface AppSettingsResponse {
  expiryAlertDays: number;
  businessProfile: BusinessProfile;
}

export interface PatchSettingsDto {
  expiryAlertDays?: number;
  businessProfile?: Partial<BusinessProfile>;
}

interface SettingsCache {
  data: AppSettingsResponse;
  cachedAt: number;
}

let settingsCache: SettingsCache | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function invalidateSettingsCache(): void {
  settingsCache = null;
}

export function getCachedSettingsState(): { isCached: boolean; cachedAt: number | null } {
  if (settingsCache && Date.now() - settingsCache.cachedAt < CACHE_TTL_MS) {
    return { isCached: true, cachedAt: settingsCache.cachedAt };
  }
  return { isCached: false, cachedAt: null };
}

export async function getSettings(): Promise<AppSettingsResponse> {
  const now = Date.now();
  if (settingsCache && now - settingsCache.cachedAt < CACHE_TTL_MS) {
    return settingsCache.data;
  }

  const { rows } = await query<{ key: string; value: any }>(
    `SELECT key, value FROM app_settings WHERE key IN ('expiry_alert_days', 'business_profile')`
  );

  let expiryAlertDays = 60;
  let businessProfile: BusinessProfile = {
    name: 'Kandarp Drugs',
    address: 'Ahmedabad, Gujarat',
    gstin: '24AAAAA0000A1Z5',
    drugLicenseNumber: 'GJ-AHM-123456',
    phone: '+919876543210',
    email: 'info@kandarpdrugs.com',
    logoPath: null,
  };

  for (const row of rows) {
    if (row.key === 'expiry_alert_days' && row.value) {
      if (typeof row.value.days === 'number') {
        expiryAlertDays = row.value.days;
      }
    } else if (row.key === 'business_profile' && row.value) {
      businessProfile = {
        name: row.value.name ?? businessProfile.name,
        address: row.value.address ?? businessProfile.address,
        gstin: row.value.gstin ?? businessProfile.gstin,
        drugLicenseNumber: row.value.drugLicenseNumber ?? businessProfile.drugLicenseNumber,
        phone: row.value.phone ?? businessProfile.phone,
        email: row.value.email ?? businessProfile.email,
        logoPath: row.value.logoPath ?? businessProfile.logoPath,
      };
    }
  }

  const result: AppSettingsResponse = {
    expiryAlertDays,
    businessProfile,
  };

  settingsCache = {
    data: result,
    cachedAt: now,
  };

  return result;
}

export async function updateSettings(dto: PatchSettingsDto, userId: string): Promise<AppSettingsResponse> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (dto.expiryAlertDays !== undefined) {
      await client.query(
        `UPDATE app_settings
         SET value = jsonb_build_object('days', $1::int),
             updated_by = $2,
             updated_at = NOW()
         WHERE key = 'expiry_alert_days'`,
        [dto.expiryAlertDays, userId]
      );
    }

    if (dto.businessProfile !== undefined) {
      const existingRes = await client.query<{ value: any }>(
        `SELECT value FROM app_settings WHERE key = 'business_profile' FOR UPDATE`
      );

      const existingProfile = existingRes.rows[0]?.value || {};
      const mergedProfile = {
        ...existingProfile,
        ...dto.businessProfile,
      };

      await client.query(
        `UPDATE app_settings
         SET value = $1::jsonb,
             updated_by = $2,
             updated_at = NOW()
         WHERE key = 'business_profile'`,
        [JSON.stringify(mergedProfile), userId]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  invalidateSettingsCache();
  return getSettings();
}
