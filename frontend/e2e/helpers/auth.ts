import { type Page } from '@playwright/test';

/**
 * Authentication helpers for KD-IOMS E2E tests.
 */

export async function loginAsAdmin(page: Page, username = 'admin', password = 'Admin@KD2026!') {
  await page.goto('/login');
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

export async function loginAsRetailer(page: Page, username = 'retailer_demo', password = 'RetailerPass@2026!') {
  await page.goto('/login');
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/catalog', { timeout: 10000 });
}

export async function loginAsDelivery(page: Page, username = 'delivery_demo', password = 'DeliveryPass@2026!') {
  await page.goto('/login');
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/pool', { timeout: 10000 });
}
