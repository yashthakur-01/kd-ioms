export const DELIVERY_ITEM_STATUS = Object.freeze({
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  REFUSED: 'REFUSED',
} as const);

export type DeliveryItemStatus = typeof DELIVERY_ITEM_STATUS[keyof typeof DELIVERY_ITEM_STATUS];

export const DELIVERY_ITEM_STATUS_VALUES = Object.freeze(Object.values(DELIVERY_ITEM_STATUS)) as readonly [DeliveryItemStatus, ...DeliveryItemStatus[]];
