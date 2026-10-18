import { query, pool } from '../config/db.js';
import { env } from '../config/env.js';
import { hashPassword } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

export async function seedAdminUser(): Promise<void> {
  try {
    const existingAdmin = await query(
      "SELECT id, username FROM users WHERE role = 'ADMIN' LIMIT 1"
    );

    if (existingAdmin.rows.length > 0) {
      logger.info(
        { username: existingAdmin.rows[0].username },
        'Admin user already exists. Seeding skipped.'
      );
      return;
    }

    const adminUsername = env.ADMIN_USERNAME || 'admin';
    const adminPassword = env.ADMIN_PASSWORD || 'Admin@KD2026!';
    const passwordHash = await hashPassword(adminPassword);

    const result = await query(
      `INSERT INTO users (username, password_hash, role, phone, is_active, must_change_password)
       VALUES ($1, $2, 'ADMIN', '9999999999', true, false)
       RETURNING id, username, role`,
      [adminUsername, passwordHash]
    );

    const created = result.rows[0];
    logger.info(
      { adminId: created.id, username: created.username },
      'Initial admin account successfully seeded.'
    );
  } catch (err) {
    logger.error({ err }, 'Failed to seed initial admin user');
    throw err;
  }
}

// Execute directly if run as CLI script
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  seedAdminUser()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async () => {
      await pool.end();
      process.exit(1);
    });
}
