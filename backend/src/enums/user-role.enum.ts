export const USER_ROLE = Object.freeze({
  ADMIN: 'ADMIN',
  RETAILER: 'RETAILER',
  DELIVERY: 'DELIVERY',
} as const);

export type UserRole = typeof USER_ROLE[keyof typeof USER_ROLE];

export const USER_ROLE_VALUES = Object.freeze(Object.values(USER_ROLE)) as readonly [UserRole, ...UserRole[]];
