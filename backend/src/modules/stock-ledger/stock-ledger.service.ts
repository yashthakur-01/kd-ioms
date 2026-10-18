import type pg from 'pg';
import type { LedgerEntryType } from '../../enums/ledger-entry-type.enum.js';
import { LEDGER_ENTRY_TYPE } from '../../enums/ledger-entry-type.enum.js';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../errors/app-error.js';

export interface ApplyLedgerEntryParams {
  batchId: number;
  type: LedgerEntryType;
  delta: number;
  reason?: string;
  supplierName?: string;
  orderId?: number;
  orderItemId?: number;
  userId?: string;
}

export interface ApplyLedgerEntryResult {
  entryId: number;
  balanceAfter: number;
}

/**
 * KD-IOMS Append-Only Stock Ledger Service
 *
 * This function is the ONLY authorized entry point for modifying `batches.quantity_on_hand`.
 * It guarantees:
 * 1. An exclusive row-level lock on the batch row (`FOR UPDATE`).
 * 2. Strict validation of delta sign per ledger entry type.
 * 3. Atomic enforcement of non-negative stock balance.
 * 4. Immutable append-only logging of every change to `stock_ledger_entries`.
 */
export async function applyLedgerEntry(
  client: pg.PoolClient,
  params: ApplyLedgerEntryParams
): Promise<ApplyLedgerEntryResult> {
  const { batchId, type, delta, reason, supplierName, orderId, orderItemId, userId } = params;

  // 1. Delta non-zero check
  if (!delta || delta === 0) {
    throw new ValidationError({
      code: 'VALIDATION_ERROR',
      message: 'Ledger delta cannot be zero',
      details: { batchId, delta },
    });
  }

  // 2. Validate delta sign by entry type
  switch (type) {
    case LEDGER_ENTRY_TYPE.INWARD:
    case LEDGER_ENTRY_TYPE.RESTOCK:
    case LEDGER_ENTRY_TYPE.RETURN_IN:
      if (delta <= 0) {
        throw new BusinessRuleError({
          code: 'INVALID_LEDGER_SIGN',
          message: `Ledger entry type ${type} requires a positive quantity delta (> 0)`,
          details: { type, delta },
        });
      }
      break;

    case LEDGER_ENTRY_TYPE.OUTWARD:
    case LEDGER_ENTRY_TYPE.DAMAGE:
    case LEDGER_ENTRY_TYPE.EXPIRY_WRITEOFF:
      if (delta >= 0) {
        throw new BusinessRuleError({
          code: 'INVALID_LEDGER_SIGN',
          message: `Ledger entry type ${type} requires a negative quantity delta (< 0)`,
          details: { type, delta },
        });
      }
      break;

    case LEDGER_ENTRY_TYPE.CORRECTION:
      // Non-zero allowed in either direction
      break;

    default:
      throw new ValidationError({
        code: 'VALIDATION_ERROR',
        message: `Unknown ledger entry type: ${type}`,
      });
  }

  // 3. Acquire exclusive row lock on the batch row
  const batchRes = await client.query<{
    batch_id: number;
    quantity_on_hand: number;
    status: string;
    expiry_date: string;
  }>(
    'SELECT batch_id, quantity_on_hand, status, expiry_date FROM batches WHERE batch_id = $1 FOR UPDATE',
    [batchId]
  );

  if (batchRes.rows.length === 0) {
    throw new NotFoundError({
      code: 'NOT_FOUND',
      message: `Batch with ID ${batchId} does not exist`,
      details: { batchId },
    });
  }

  const batch = batchRes.rows[0]!;
  const currentQuantity = batch.quantity_on_hand;
  const balanceAfter = currentQuantity + delta;

  // 4. Non-negative balance check
  if (balanceAfter < 0) {
    throw new BusinessRuleError({
      code: 'INSUFFICIENT_STOCK',
      message: 'Stock balance cannot be negative',
      details: {
        batchId,
        currentQuantity,
        requestedDelta: delta,
        attemptedBalance: balanceAfter,
      },
    });
  }

  // 5. Update batch quantity_on_hand
  await client.query(
    'UPDATE batches SET quantity_on_hand = $1, updated_at = NOW() WHERE batch_id = $2',
    [balanceAfter, batchId]
  );

  // 6. Insert immutable ledger entry
  const ledgerRes = await client.query<{ entry_id: number }>(
    `INSERT INTO stock_ledger_entries (
      batch_id,
      type,
      delta,
      balance_after,
      reason,
      supplier_name,
      order_id,
      order_item_id,
      created_by,
      created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    RETURNING entry_id`,
    [
      batchId,
      type,
      delta,
      balanceAfter,
      reason?.trim() || null,
      supplierName?.trim() || null,
      orderId || null,
      orderItemId || null,
      userId || null,
    ]
  );

  return {
    entryId: ledgerRes.rows[0]!.entry_id,
    balanceAfter,
  };
}
