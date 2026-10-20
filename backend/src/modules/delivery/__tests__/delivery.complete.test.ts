import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../../app.js';
import * as db from '../../../config/db.js';
import * as tokensUtils from '../../../utils/tokens.js';
import * as storageUtils from '../../../utils/storage.js';
import * as ledgerService from '../../stock-ledger/stock-ledger.service.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';
import { USER_ROLE } from '../../../enums/user-role.enum.js';
import { ORDER_STATUS } from '../../../enums/order-status.enum.js';
import { LEDGER_ENTRY_TYPE } from '../../../enums/ledger-entry-type.enum.js';

describe('Doorstep Delivery Completion & Whole-Line Refusal (Plan 8-03)', () => {
  const deliveryPartnerId = '33333333-3333-4333-a333-333333333333';
  const otherDeliveryPartnerId = '44444444-4444-4444-a444-444444444444';
  const retailerId = '22222222-2222-4222-a222-222222222222';

  const deliveryToken = tokensUtils.signAccessToken({
    sub: deliveryPartnerId,
    username: 'delivery_partner_1',
    role: USER_ROLE.DELIVERY,
    phone: '9888888888',
    mustChangePassword: false,
  });

  const otherDeliveryToken = tokensUtils.signAccessToken({
    sub: otherDeliveryPartnerId,
    username: 'delivery_partner_2',
    role: USER_ROLE.DELIVERY,
    phone: '9777777777',
    mustChangePassword: false,
  });

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(db, 'query').mockImplementation(async (sql: string, params?: any[]) => {
      if (sql.includes('FROM users WHERE id = $1')) {
        const id = params?.[0];
        return {
          rows: [
            {
              id,
              username: id === deliveryPartnerId ? 'delivery_partner_1' : 'delivery_partner_2',
              role: USER_ROLE.DELIVERY,
              phone: '9888888888',
              is_active: true,
              must_change_password: false,
            },
          ],
          rowCount: 1,
          command: '',
          oid: 0,
          fields: [],
        };
      }
      return { rows: [], rowCount: 0, command: '', oid: 0, fields: [] };
    });
  });

  describe('Validation & Authorization Checks', () => {
    it('returns 400 when photo file is missing', async () => {
      const res = await request(app)
        .post('/api/v1/delivery/orders/101/complete')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .field('decisions', JSON.stringify([{ orderItemId: 1, decision: 'ACCEPTED' }]));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(res.body.message).toMatch(/photo is required/i);
    });

    it('returns 400 when an item is refused without a 3+ character reason', async () => {
      const res = await request(app)
        .post('/api/v1/delivery/orders/101/complete')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .attach('photo', Buffer.from('fake-image-bytes'), 'test.jpg')
        .field('decisions', JSON.stringify([{ orderItemId: 1, decision: 'REFUSED', reason: 'no' }]));

      expect(res.status).toBe(400);
      expect(res.body.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    });

    it('returns 403 when non-assigned delivery partner attempts completion', async () => {
      vi.spyOn(storageUtils, 'uploadDeliveryPhoto').mockResolvedValue('uploads/delivery-photos/101-test.jpg');

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('SELECT order_id, order_number, status, delivery_partner_id FROM orders')) {
              return {
                rows: [
                  {
                    order_id: 101,
                    order_number: 'ORD-000101',
                    status: ORDER_STATUS.OUT_FOR_DELIVERY,
                    delivery_partner_id: deliveryPartnerId, // Assigned to partner 1, not partner 2!
                  },
                ],
                rowCount: 1,
              };
            }
            return { rows: [], rowCount: 0 };
          }),
        };
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/complete')
        .set('Authorization', `Bearer ${otherDeliveryToken}`)
        .attach('photo', Buffer.from('fake-image-bytes'), 'test.jpg')
        .field('decisions', JSON.stringify([{ orderItemId: 1, decision: 'ACCEPTED' }]));

      expect(res.status).toBe(403);
      expect(res.body.code).toBe(ERROR_CODES.FORBIDDEN);
    });
  });

  describe('Storage Upload Failure Safety', () => {
    it('aborts with 502 EXTERNAL_SERVICE_ERROR and leaves database untouched if upload fails', async () => {
      vi.spyOn(storageUtils, 'uploadDeliveryPhoto').mockRejectedValue(new Error('S3 Storage connection timeout'));
      const transactionSpy = vi.spyOn(db, 'withTransaction');

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/complete')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .attach('photo', Buffer.from('fake-image-bytes'), 'test.jpg')
        .field('decisions', JSON.stringify([{ orderItemId: 1, decision: 'ACCEPTED' }]));

      expect(res.status).toBe(502);
      expect(res.body.code).toBe(ERROR_CODES.EXTERNAL_SERVICE_ERROR);
      expect(res.body.message).toMatch(/Failed to upload delivery proof photo/i);
      expect(transactionSpy).not.toHaveBeenCalled();
    });
  });

  describe('Delivery Completion & Refusal Stock Restoration', () => {
    it('completes delivery with partial line refusal: executes RETURN_IN ledger restoration and marks DELIVERED', async () => {
      vi.spyOn(storageUtils, 'uploadDeliveryPhoto').mockResolvedValue('uploads/delivery-photos/101-proof.jpg');
      const ledgerSpy = vi.spyOn(ledgerService, 'applyLedgerEntry').mockResolvedValue({} as any);

      let orderUpdatedStatus = '';
      let deliveredAtSet = false;
      let photoPathSaved = '';
      const itemStatuses: Record<number, string> = {};

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('SELECT order_id, order_number, status, delivery_partner_id FROM orders')) {
              return {
                rows: [
                  {
                    order_id: 101,
                    order_number: 'ORD-000101',
                    status: ORDER_STATUS.OUT_FOR_DELIVERY,
                    delivery_partner_id: deliveryPartnerId,
                  },
                ],
                rowCount: 1,
              };
            }

            if (sql.includes('FROM order_items') && sql.includes('WHERE order_id = $1') && !sql.includes('JOIN medicines')) {
              return {
                rows: [
                  { order_item_id: 1, requested_quantity: 10, picked_quantity: 10, delivery_status: 'PENDING' },
                  { order_item_id: 2, requested_quantity: 5, picked_quantity: 5, delivery_status: 'PENDING' },
                ],
                rowCount: 2,
              };
            }

            if (sql.includes('UPDATE order_items')) {
              const status = sql.includes("delivery_status = 'ACCEPTED'") ? 'ACCEPTED' : 'REFUSED';
              const itemId = params?.[params.length - 1];
              itemStatuses[itemId] = status;
              return { rowCount: 1, rows: [] };
            }

            if (sql.includes('FROM order_allocations') && sql.includes('WHERE order_item_id = $1')) {
              const itemId = params?.[0];
              if (itemId === 2) {
                // Item 2 has allocation in batch 88 for 5 units
                return {
                  rows: [{ allocation_id: 12, batch_id: 88, quantity: 5 }],
                  rowCount: 1,
                };
              }
              return { rows: [], rowCount: 0 };
            }

            if (sql.includes('UPDATE orders') && sql.includes("status = 'DELIVERED'")) {
              orderUpdatedStatus = 'DELIVERED';
              photoPathSaved = params?.[0];
              deliveredAtSet = true;
              return { rowCount: 1, rows: [] };
            }

            if (sql.includes('INSERT INTO order_status_history')) {
              return { rowCount: 1, rows: [] };
            }

            // Return order detail for endpoint response
            if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
              return {
                rows: [
                  {
                    order_id: 101,
                    order_number: 'ORD-000101',
                    status: 'DELIVERED',
                    claimed_at: new Date(),
                    delivered_at: new Date(),
                    delivery_photo_path: photoPathSaved,
                    retailer_user_id: retailerId,
                    retailer_username: 'apollo',
                    shop_name: 'Apollo Pharmacy',
                    city: 'Ahmedabad',
                    delivery_partner_id: deliveryPartnerId,
                  },
                ],
                rowCount: 1,
              };
            }

            if (sql.includes('FROM order_items oi')) {
              return {
                rows: [
                  {
                    order_item_id: 1,
                    medicine_id: 10,
                    medicine_name: 'Paracetamol',
                    company: 'Cipla',
                    pack_size: '10 Tablets',
                    requested_quantity: 10,
                    picked_quantity: 10,
                    quoted_price_incl_gst: '25.00',
                    delivery_status: 'ACCEPTED',
                    refusal_reason: null,
                  },
                  {
                    order_item_id: 2,
                    medicine_id: 20,
                    medicine_name: 'Amoxicillin',
                    company: 'Abbott',
                    pack_size: '10 Capsules',
                    requested_quantity: 5,
                    picked_quantity: 5,
                    quoted_price_incl_gst: '120.00',
                    delivery_status: 'REFUSED',
                    refusal_reason: 'Box crushed during transport',
                  },
                ],
                rowCount: 2,
              };
            }

            if (sql.includes('FROM order_allocations oa')) {
              return { rows: [], rowCount: 0 };
            }

            return { rows: [], rowCount: 0 };
          }),
        };
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/101/complete')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .attach('photo', Buffer.from('fake-image-bytes'), 'test.jpg')
        .field(
          'decisions',
          JSON.stringify([
            { orderItemId: 1, decision: 'ACCEPTED' },
            { orderItemId: 2, decision: 'REFUSED', reason: 'Box crushed during transport' },
          ])
        );

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('DELIVERY_COMPLETED');
      expect(orderUpdatedStatus).toBe('DELIVERED');
      expect(deliveredAtSet).toBe(true);
      expect(photoPathSaved).toBe('uploads/delivery-photos/101-proof.jpg');

      // Verify RETURN_IN ledger entry was applied for the refused line
      expect(ledgerSpy).toHaveBeenCalledTimes(1);
      expect(ledgerSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          batchId: 88,
          type: LEDGER_ENTRY_TYPE.RETURN_IN,
          delta: 5,
          orderId: 101,
          orderItemId: 2,
          userId: deliveryPartnerId,
          reason: 'Doorstep refusal: Box crushed during transport',
        })
      );
    });

    it('marks order REJECTED when 100% of line items are refused', async () => {
      vi.spyOn(storageUtils, 'uploadDeliveryPhoto').mockResolvedValue('uploads/delivery-photos/102-proof.jpg');
      const ledgerSpy = vi.spyOn(ledgerService, 'applyLedgerEntry').mockResolvedValue({} as any);

      let orderUpdatedStatus = '';
      let rejectionReasonSaved = '';

      vi.spyOn(db, 'withTransaction').mockImplementation(async (callback: any) => {
        const mockClient = {
          query: vi.fn().mockImplementation(async (sql: string, params?: any[]) => {
            if (sql.includes('SELECT order_id, order_number, status, delivery_partner_id FROM orders')) {
              return {
                rows: [
                  {
                    order_id: 102,
                    order_number: 'ORD-000102',
                    status: ORDER_STATUS.OUT_FOR_DELIVERY,
                    delivery_partner_id: deliveryPartnerId,
                  },
                ],
                rowCount: 1,
              };
            }

            if (sql.includes('FROM order_items') && sql.includes('WHERE order_id = $1') && !sql.includes('JOIN medicines')) {
              return {
                rows: [{ order_item_id: 1, requested_quantity: 10, picked_quantity: 10, delivery_status: 'PENDING' }],
                rowCount: 1,
              };
            }

            if (sql.includes('UPDATE order_items')) {
              return { rowCount: 1, rows: [] };
            }

            if (sql.includes('FROM order_allocations') && sql.includes('WHERE order_item_id = $1')) {
              return {
                rows: [{ allocation_id: 10, batch_id: 42, quantity: 10 }],
                rowCount: 1,
              };
            }

            if (sql.includes('UPDATE orders') && sql.includes("status = 'REJECTED'")) {
              orderUpdatedStatus = 'REJECTED';
              rejectionReasonSaved = params?.[1];
              return { rowCount: 1, rows: [] };
            }

            if (sql.includes('INSERT INTO order_status_history')) {
              return { rowCount: 1, rows: [] };
            }

            if (sql.includes('FROM orders o') && sql.includes('WHERE o.order_id = $1')) {
              return {
                rows: [
                  {
                    order_id: 102,
                    order_number: 'ORD-000102',
                    status: 'REJECTED',
                    rejection_reason: rejectionReasonSaved,
                    delivery_partner_id: deliveryPartnerId,
                    retailer_user_id: retailerId,
                    retailer_username: 'apollo',
                    shop_name: 'Apollo Pharmacy',
                  },
                ],
                rowCount: 1,
              };
            }

            if (sql.includes('FROM order_items oi') || sql.includes('FROM order_allocations oa')) {
              return { rows: [], rowCount: 0 };
            }

            return { rows: [], rowCount: 0 };
          }),
        };
        return callback(mockClient);
      });

      const res = await request(app)
        .post('/api/v1/delivery/orders/102/complete')
        .set('Authorization', `Bearer ${deliveryToken}`)
        .attach('photo', Buffer.from('fake-image-bytes'), 'test.jpg')
        .field(
          'decisions',
          JSON.stringify([
            { orderItemId: 1, decision: 'REFUSED', reason: 'Pharmacy closed permanently' },
          ])
        );

      expect(res.status).toBe(200);
      expect(res.body.code).toBe('DELIVERY_COMPLETED');
      expect(orderUpdatedStatus).toBe('REJECTED');
      expect(rejectionReasonSaved).toBe('Pharmacy closed permanently');

      expect(ledgerSpy).toHaveBeenCalledTimes(1);
      expect(ledgerSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          batchId: 42,
          type: LEDGER_ENTRY_TYPE.RETURN_IN,
          delta: 10,
          reason: 'Doorstep refusal: Pharmacy closed permanently',
        })
      );
    });
  });
});
