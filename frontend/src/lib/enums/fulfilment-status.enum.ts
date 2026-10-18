export const FULFILMENT_STATUS = Object.freeze({
  FULL: 'FULL',
  PARTIAL: 'PARTIAL',
  NONE: 'NONE',
} as const);

export type FulfilmentStatus = typeof FULFILMENT_STATUS[keyof typeof FULFILMENT_STATUS];

export const FULFILMENT_STATUS_VALUES = Object.freeze(Object.values(FULFILMENT_STATUS)) as readonly [FulfilmentStatus, ...FulfilmentStatus[]];
