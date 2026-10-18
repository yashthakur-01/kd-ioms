export const NOTIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const);

export type NotificationStatus = typeof NOTIFICATION_STATUS[keyof typeof NOTIFICATION_STATUS];

export const NOTIFICATION_STATUS_VALUES = Object.freeze(Object.values(NOTIFICATION_STATUS)) as readonly [NotificationStatus, ...NotificationStatus[]];
