export const ORDER_STATUS = Object.freeze({
  PLACED: 'PLACED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const);

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS];

export const ORDER_STATUS_VALUES = Object.freeze(Object.values(ORDER_STATUS)) as readonly [OrderStatus, ...OrderStatus[]];
