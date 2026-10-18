import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

// Precomputed 12-round bcrypt hash used for timing-safe dummy verification
const DUMMY_HASH = '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

const PHARMA_WORDS = [
  'Kandarp',
  'Pharma',
  'Health',
  'Capsule',
  'Tablet',
  'Care',
  'Remedy',
  'Syrup',
  'Dosage',
  'Relief',
  'Medical',
  'Herbal',
  'Wellness',
  'Pulse',
  'Vigor',
] as const;

/**
 * Hashes a plaintext password with bcrypt (12 salt rounds).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('$2')) {
    return false;
  }
  return bcrypt.compare(password, storedHash);
}

/**
 * Executes a dummy bcrypt verification against a reference hash to equalize response
 * latency and defend against user enumeration via timing attacks.
 */
export async function verifyDummyPassword(password: string): Promise<boolean> {
  await bcrypt.compare(password, DUMMY_HASH);
  return false;
}

/**
 * Generates a memorable temporary passphrase (e.g., 'Kandarp-Capsule-4821').
 * Satisfies the password policy: length >= 10, contains letters, contains digits.
 */
export function generateTemporaryPassword(): string {
  const word1 = PHARMA_WORDS[crypto.randomInt(0, PHARMA_WORDS.length)];
  let word2 = PHARMA_WORDS[crypto.randomInt(0, PHARMA_WORDS.length)];
  while (word2 === word1) {
    word2 = PHARMA_WORDS[crypto.randomInt(0, PHARMA_WORDS.length)];
  }
  const digits = crypto.randomInt(1000, 10000);
  return `${word1}-${word2}-${digits}`;
}

/**
 * Generates a cryptographically secure 256-bit random hex string for refresh tokens.
 */
export function newRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Produces a SHA-256 digest of a refresh token combined with the application pepper.
 */
export function hashRefreshToken(token: string): string {
  const pepper = env.REFRESH_TOKEN_PEPPER || 'kd-ioms-refresh-pepper-2026';
  return crypto.createHash('sha256').update(`${token}:${pepper}`).digest('hex');
}
