export const BATCH_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  BLOCKED: 'BLOCKED',
} as const);

export type BatchStatus = typeof BATCH_STATUS[keyof typeof BATCH_STATUS];

export const BATCH_STATUS_VALUES = Object.freeze(Object.values(BATCH_STATUS)) as readonly [BatchStatus, ...BatchStatus[]];
