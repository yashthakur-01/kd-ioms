import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  verifyDummyPassword,
  generateTemporaryPassword,
  newRefreshToken,
  hashRefreshToken,
} from '../crypto.js';

describe('Crypto Utilities', () => {
  it('hashes password with bcrypt and verifies correctly', async () => {
    const password = 'SuperSecret123!';
    const hash = await hashPassword(password);

    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPassword('WrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  it('handles invalid stored hash gracefully', async () => {
    expect(await verifyPassword('password', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('password', '')).toBe(false);
  });

  it('executes dummy verification safely', async () => {
    const result = await verifyDummyPassword('AnyPassword');
    expect(result).toBe(false);
  });

  it('generates memorable temporary password satisfying password policy', () => {
    for (let i = 0; i < 20; i++) {
      const tempPass = generateTemporaryPassword();
      // Should match Word-Word-Digits
      expect(tempPass).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{4}$/);
      expect(tempPass.length).toBeGreaterThanOrEqual(10);
      expect(/[A-Za-z]/.test(tempPass)).toBe(true);
      expect(/\d/.test(tempPass)).toBe(true);
    }
  });

  it('generates 256-bit random refresh tokens and stable SHA-256 digests', () => {
    const token1 = newRefreshToken();
    const token2 = newRefreshToken();

    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);

    const hash1 = hashRefreshToken(token1);
    const hash2 = hashRefreshToken(token1);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });
});
