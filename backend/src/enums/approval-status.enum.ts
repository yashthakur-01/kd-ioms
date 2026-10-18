export const APPROVAL_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const);

export type ApprovalStatus = typeof APPROVAL_STATUS[keyof typeof APPROVAL_STATUS];

export const APPROVAL_STATUS_VALUES = Object.freeze(Object.values(APPROVAL_STATUS)) as readonly [ApprovalStatus, ...ApprovalStatus[]];
