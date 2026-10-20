import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { uploadDeliveryPhoto } from '../storage.js';
import { assertTransition } from '../../modules/order/order.helpers.js';
import { ORDER_STATUS } from '../../enums/order-status.enum.js';
import { ValidationError } from '../../errors/app-error.js';

describe('Storage Utility & State Machine Baseline (Plan 8-01)', () => {
  const testBuffer = Buffer.from('fake-image-bytes-jpeg-data');

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe('uploadDeliveryPhoto', () => {
    it('throws ValidationError when MIME type is not allowed', async () => {
      await expect(
        uploadDeliveryPhoto(testBuffer, 'application/pdf', 101)
      ).rejects.toThrow(ValidationError);

      await expect(
        uploadDeliveryPhoto(testBuffer, 'text/plain', 102)
      ).rejects.toThrow(/Only JPEG, PNG, and WebP images are accepted/);
    });

    it('saves image file to local filesystem fallback when Supabase is not configured', async () => {
      const orderId = 888;
      const resultPath = await uploadDeliveryPhoto(testBuffer, 'image/jpeg', orderId);

      expect(resultPath).toMatch(/^uploads\/delivery-photos\/888-\d+\.jpg$/);

      const absolutePath = path.resolve(process.cwd(), resultPath);
      expect(fs.existsSync(absolutePath)).toBe(true);

      const savedContent = await fs.promises.readFile(absolutePath);
      expect(savedContent.equals(testBuffer)).toBe(true);

      // Clean up test file
      await fs.promises.unlink(absolutePath).catch(() => {});
    });

    it('correctly handles PNG and WebP extensions', async () => {
      const pngPath = await uploadDeliveryPhoto(testBuffer, 'image/png', 991);
      expect(pngPath).toMatch(/^uploads\/delivery-photos\/991-\d+\.png$/);
      await fs.promises.unlink(path.resolve(process.cwd(), pngPath)).catch(() => {});

      const webpPath = await uploadDeliveryPhoto(testBuffer, 'image/webp', 992);
      expect(webpPath).toMatch(/^uploads\/delivery-photos\/992-\d+\.webp$/);
      await fs.promises.unlink(path.resolve(process.cwd(), webpPath)).catch(() => {});
    });
  });

  describe('Order State Machine Transition Invariants', () => {
    it('allows transition from OUT_FOR_DELIVERY back to APPROVED (for release or admin override)', () => {
      expect(() => {
        assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.APPROVED);
      }).not.toThrow();
    });

    it('still allows transition from OUT_FOR_DELIVERY to DELIVERED and REJECTED', () => {
      expect(() => {
        assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED);
      }).not.toThrow();

      expect(() => {
        assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.REJECTED);
      }).not.toThrow();
    });

    it('rejects illegal transitions from OUT_FOR_DELIVERY to PLACED or CANCELLED', () => {
      expect(() => {
        assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.PLACED);
      }).toThrow(/Cannot transition order status/);

      expect(() => {
        assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.CANCELLED);
      }).toThrow(/Cannot transition order status/);
    });
  });
});
