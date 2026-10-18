export const LEDGER_ENTRY_TYPE = Object.freeze({
  INWARD: 'INWARD',
  RESTOCK: 'RESTOCK',
  RETURN_IN: 'RETURN_IN',
  OUTWARD: 'OUTWARD',
  EXPIRY_WRITEOFF: 'EXPIRY_WRITEOFF',
  DAMAGE: 'DAMAGE',
  CORRECTION: 'CORRECTION',
} as const);

export type LedgerEntryType = typeof LEDGER_ENTRY_TYPE[keyof typeof LEDGER_ENTRY_TYPE];

export const LEDGER_ENTRY_TYPE_VALUES = Object.freeze(Object.values(LEDGER_ENTRY_TYPE)) as readonly [LedgerEntryType, ...LedgerEntryType[]];
