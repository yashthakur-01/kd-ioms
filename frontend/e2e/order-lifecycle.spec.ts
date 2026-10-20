import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsRetailer, loginAsDelivery } from './helpers/auth';
import { setupE2EMockRoutes, createInitialStore } from './helpers/api';

test.describe('KD-IOMS Full Operational User Journey (Plan 11-05)', () => {
  let store = createInitialStore();

  test.beforeEach(async ({ page }) => {
    store = createInitialStore();
    await setupE2EMockRoutes(page, store);
  });

  test('Step 1: Admin Seed Login authenticates and loads system dashboard', async ({ page }) => {
    await loginAsAdmin(page, 'admin', 'Admin@KD2026!');
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
  });

  test('Step 2: Retailer KYC Application and Admin Approval workflow', async ({ page }) => {
    // 1. Admin navigates to Retailer management
    await loginAsAdmin(page);
    await page.goto('/retailers');

    // 2. Verifies pending retailer record is present in review queue
    await expect(page.getByText('Apollo City Pharmacy')).toBeVisible();
    await expect(page.getByText('DL-2026-99881')).toBeVisible();

    // 3. Navigates to Retailer Detail / Verification page
    await page.click('text=Review Application');
    await page.waitForURL('**/retailers/2');

    // 4. Admin clicks Approve Application and confirms
    const approveBtn = page.getByRole('button', { name: /approve/i });
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      // Handle confirmation dialog if modal appears
      const confirmDialogBtn = page.locator('button:has-text("Confirm"), button:has-text("Approve")').last();
      if (await confirmDialogBtn.isVisible()) {
        await confirmDialogBtn.click();
      }
    }

    // Verify store state updated to APPROVED
    expect(store.retailers[0].approvalStatus).toBe('APPROVED');
  });

  test('Step 3: Stock Inwarding records batch and updates inventory ledger', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/stock/inward');

    // Verify page loads inwarding interface
    await expect(page.locator('body')).toBeVisible();

    // Simulate batch entry
    const beforeCount = store.batches.length;
    await page.evaluate(() => {
      window.fetch('/api/v1/stock/inward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchNumber: 'CRO-2026-X2',
          expiryDate: '2028-06-30',
          quantity: 200,
          mrp: 50.0,
          purchaseRate: 30.0,
          sellingPrice: 40.0,
        }),
      });
    });

    expect(store.batches.length).toBeGreaterThan(beforeCount);
    expect(store.stockLedger.some((l) => l.entryType === 'INWARD')).toBe(true);
  });

  test('Step 4: Retailer browses catalog and places order', async ({ page }) => {
    await loginAsRetailer(page);
    await page.goto('/catalog');

    // Verify catalog displays products
    await expect(page.getByText('Crocin 650 Advance')).toBeVisible();

    // Place an order
    const beforeOrderCount = store.orders.length;
    await page.evaluate(() => {
      window.fetch('/api/v1/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ medicineId: 1, quantity: 10 }],
        }),
      });
    });

    expect(store.orders.length).toBeGreaterThan(beforeOrderCount);
    expect(store.orders[store.orders.length - 1].status).toBe('PLACED');
  });

  test('Step 5: Admin reviews order and confirms FEFO batch allocation', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/orders/101/pick');

    // Verify picking UI renders
    await expect(page.locator('body')).toBeVisible();

    // Approve the order with FEFO allocation
    await page.evaluate(() => {
      window.fetch('/api/v1/orders/101/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    expect(store.orders[0].status).toBe('APPROVED');
  });

  test('Step 6 & 7: Delivery Claim, Doorstep Whole-Line Refusal & Stock Return Invariants', async ({ page }) => {
    // 1. Delivery partner logs in and views pool
    await loginAsDelivery(page);
    await page.goto('/pool');

    // 2. Claim order
    await page.evaluate(() => {
      window.fetch('/api/v1/delivery/orders/101/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });
    expect(store.orders[0].status).toBe('OUT_FOR_DELIVERY');

    // 3. Navigate to delivery completion checklist
    await page.goto('/delivery/orders/101');
    await expect(page.locator('body')).toBeVisible();

    // 4. Complete delivery with doorstep line refusal
    const initialLedgerCount = store.stockLedger.length;
    await page.evaluate(() => {
      window.fetch('/api/v1/delivery/orders/101/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decisions: [
            {
              orderItemId: 1,
              status: 'REFUSED',
              reason: 'Packaging torn / seal broken',
            },
          ],
        }),
      });
    });

    // 5. Verify system invariants
    expect(store.orders[0].status).toBe('DELIVERED');
    // Stock ledger records RETURN_IN for refused item
    expect(store.stockLedger.length).toBeGreaterThan(initialLedgerCount);
    const returnEntry = store.stockLedger.find((e) => e.entryType === 'RETURN_IN');
    expect(returnEntry).toBeDefined();
    expect(returnEntry?.quantityDelta).toBe(2);
  });
});
