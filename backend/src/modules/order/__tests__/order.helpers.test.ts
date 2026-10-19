import { describe, it, expect } from 'vitest';
import { assertTransition, ALLOWED_TRANSITIONS } from '../order.helpers.js';
import { ORDER_STATUS } from '../../../enums/order-status.enum.js';
import { ConflictError } from '../../../errors/app-error.js';
import { ERROR_CODES } from '../../../constants/error-codes.js';

describe('Order Helpers - State Machine Transitions', () => {
  it('allows valid transition from PLACED to CANCELLED', () => {
    expect(() => assertTransition(ORDER_STATUS.PLACED, ORDER_STATUS.CANCELLED)).not.toThrow();
  });

  it('allows valid transition from PLACED to APPROVED', () => {
    expect(() => assertTransition(ORDER_STATUS.PLACED, ORDER_STATUS.APPROVED)).not.toThrow();
  });

  it('allows valid transition from PLACED to REJECTED', () => {
    expect(() => assertTransition(ORDER_STATUS.PLACED, ORDER_STATUS.REJECTED)).not.toThrow();
  });

  it('allows valid transition from APPROVED to OUT_FOR_DELIVERY', () => {
    expect(() => assertTransition(ORDER_STATUS.APPROVED, ORDER_STATUS.OUT_FOR_DELIVERY)).not.toThrow();
  });

  it('allows valid transition from APPROVED to REJECTED', () => {
    expect(() => assertTransition(ORDER_STATUS.APPROVED, ORDER_STATUS.REJECTED)).not.toThrow();
  });

  it('allows valid transition from OUT_FOR_DELIVERY to DELIVERED', () => {
    expect(() => assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.DELIVERED)).not.toThrow();
  });

  it('allows valid transition from OUT_FOR_DELIVERY to REJECTED', () => {
    expect(() => assertTransition(ORDER_STATUS.OUT_FOR_DELIVERY, ORDER_STATUS.REJECTED)).not.toThrow();
  });

  it('throws 409 INVALID_STATE_TRANSITION when attempting to cancel an APPROVED order', () => {
    expect(() => assertTransition(ORDER_STATUS.APPROVED, ORDER_STATUS.CANCELLED)).toThrow(ConflictError);
    try {
      assertTransition(ORDER_STATUS.APPROVED, ORDER_STATUS.CANCELLED);
    } catch (err: any) {
      expect(err.code).toBe(ERROR_CODES.INVALID_STATE_TRANSITION);
      expect(err.httpStatus).toBe(409);
    }
  });

  it('throws 409 INVALID_STATE_TRANSITION when attempting to transition from CANCELLED to anything', () => {
    expect(() => assertTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.PLACED)).toThrow(ConflictError);
    expect(() => assertTransition(ORDER_STATUS.CANCELLED, ORDER_STATUS.APPROVED)).toThrow(ConflictError);
  });

  it('throws 409 INVALID_STATE_TRANSITION when attempting to transition from DELIVERED to anything', () => {
    expect(() => assertTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.OUT_FOR_DELIVERY)).toThrow(ConflictError);
    expect(() => assertTransition(ORDER_STATUS.DELIVERED, ORDER_STATUS.CANCELLED)).toThrow(ConflictError);
  });

  it('matches all specified transitions in ALLOWED_TRANSITIONS table', () => {
    expect(ALLOWED_TRANSITIONS[ORDER_STATUS.PLACED]).toEqual([
      ORDER_STATUS.CANCELLED,
      ORDER_STATUS.APPROVED,
      ORDER_STATUS.REJECTED,
    ]);
  });
});
