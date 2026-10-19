import { ORDER_STATUS, type OrderStatus } from '../../enums/order-status.enum.js';
import { ConflictError } from '../../errors/app-error.js';
import { ERROR_CODES } from '../../constants/error-codes.js';

export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = Object.freeze({
  [ORDER_STATUS.PLACED]: [ORDER_STATUS.CANCELLED, ORDER_STATUS.APPROVED, ORDER_STATUS.REJECTED],
  [ORDER_STATUS.APPROVED]: [ORDER_STATUS.REJECTED, ORDER_STATUS.OUT_FOR_DELIVERY],
  [ORDER_STATUS.OUT_FOR_DELIVERY]: [ORDER_STATUS.DELIVERED, ORDER_STATUS.REJECTED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REJECTED]: [],
});

/**
 * Validates order state machine transitions.
 * Throws 409 ConflictError with INVALID_STATE_TRANSITION for illegal moves.
 */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  const allowed = ALLOWED_TRANSITIONS[from] || [];
  if (!allowed.includes(to)) {
    throw new ConflictError({
      code: ERROR_CODES.INVALID_STATE_TRANSITION,
      message: `Cannot transition order status from '${from}' to '${to}'`,
      details: {
        from,
        to,
        allowedTransitions: [...allowed],
      },
    });
  }
}
