import { type Page } from '@playwright/test';

/**
 * Direct API request helper and deterministic state store for KD-IOMS E2E testing.
 */
export interface E2EStore {
  users: Array<{ id: string; username: string; role: string; mustChangePassword: boolean }>;
  retailers: Array<{
    userId: string;
    username: string;
    shopName: string;
    drugLicenseNumber: string;
    gstin: string;
    city: string;
    state: string;
    whatsappNumber: string;
    approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
  }>;
  batches: Array<{
    batchId: number;
    medicineId: number;
    medicineName: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    availableQuantity: number;
    mrp: number;
    sellingPrice: number;
  }>;
  orders: Array<{
    id: number;
    orderNumber: string;
    retailerId: string;
    retailerName: string;
    status: string;
    deliveryPartnerId: string | null;
    totalAmount: number;
    items: Array<{
      id: number;
      medicineId: number;
      medicineName: string;
      requestedQuantity: number;
      unitPrice: number;
      allocatedBatchId?: number;
      allocatedQuantity?: number;
      status?: 'ACCEPTED' | 'REFUSED';
      refusalReason?: string;
    }>;
  }>;
  stockLedger: Array<{
    id: number;
    entryType: string;
    medicineName: string;
    batchNumber: string;
    quantityDelta: number;
    createdAt: string;
  }>;
}

/**
 * Creates fresh in-memory mock store for hermetic E2E test executions.
 */
export function createInitialStore(): E2EStore {
  return {
    users: [
      { id: '1', username: 'admin', role: 'ADMIN', mustChangePassword: false },
      { id: '2', username: 'retailer_demo', role: 'RETAILER', mustChangePassword: false },
      { id: '3', username: 'delivery_demo', role: 'DELIVERY', mustChangePassword: false },
    ],
    retailers: [
      {
        userId: '2',
        username: 'retailer_demo',
        shopName: 'Apollo City Pharmacy',
        drugLicenseNumber: 'DL-2026-99881',
        gstin: '24AAACT1234F1Z8',
        city: 'Ahmedabad',
        state: 'Gujarat',
        whatsappNumber: '9876543210',
        approvalStatus: 'PENDING',
        createdAt: new Date().toISOString(),
      },
    ],
    batches: [
      {
        batchId: 101,
        medicineId: 1,
        medicineName: 'Crocin 650 Advance',
        batchNumber: 'CRO-2026-X1',
        expiryDate: '2027-12-31',
        quantity: 100,
        availableQuantity: 100,
        mrp: 50.0,
        sellingPrice: 40.0,
      },
    ],
    orders: [
      {
        id: 101,
        orderNumber: 'ORD-2026-000101',
        retailerId: '2',
        retailerName: 'Apollo City Pharmacy',
        status: 'PLACED',
        deliveryPartnerId: null,
        totalAmount: 400.0,
        items: [
          {
            id: 1,
            medicineId: 1,
            medicineName: 'Crocin 650 Advance',
            requestedQuantity: 10,
            unitPrice: 40.0,
            allocatedBatchId: 101,
            allocatedQuantity: 10,
          },
        ],
      },
    ],
    stockLedger: [
      {
        id: 1,
        entryType: 'INWARD',
        medicineName: 'Crocin 650 Advance',
        batchNumber: 'CRO-2026-X1',
        quantityDelta: 100,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Intercepts frontend /api/v1 network calls and mounts deterministic stateful handlers.
 */
export async function setupE2EMockRoutes(page: Page, store = createInitialStore()) {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();

    // 1. Auth routes
    if (pathname.endsWith('/auth/login') && method === 'POST') {
      const body = request.postDataJSON() || {};
      const user = store.users.find((u) => u.username.toLowerCase() === body.username?.toLowerCase());
      if (user) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: user.id,
              username: user.username,
              role: user.role,
              mustChangePassword: user.mustChangePassword,
            },
            accessToken: `mock-token-${user.role}`,
          }),
        });
      }
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    }

    if (pathname.endsWith('/auth/refresh') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: 'mock-refreshed-token' }),
      });
    }

    // 2. Retailer profile & approval
    if (pathname.includes('/retailer/profile')) {
      const retailer = store.retailers[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: retailer }),
      });
    }

    if (pathname.endsWith('/retailers') && method === 'GET') {
      const statusParam = url.searchParams.get('approvalStatus');
      const filtered = statusParam
        ? store.retailers.filter((r) => r.approvalStatus === statusParam)
        : store.retailers;

      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: filtered,
          meta: {
            pagination: {
              page: 1,
              pageSize: 20,
              totalItems: filtered.length,
              totalPages: 1,
            },
          },
        }),
      });
    }

    if (pathname.match(/\/retailers\/[^/]+$/) && method === 'GET') {
      const retailer = store.retailers[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: retailer }),
      });
    }

    if (pathname.includes('/retailers/') && pathname.endsWith('/approve') && method === 'POST') {
      if (store.retailers[0]) {
        store.retailers[0].approvalStatus = 'APPROVED';
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Retailer approved successfully',
          data: store.retailers[0],
        }),
      });
    }

    // 3. Stock Inwarding
    if (pathname.endsWith('/stock/inward') && method === 'POST') {
      const body = request.postDataJSON() || {};
      const newBatch = {
        batchId: store.batches.length + 101,
        medicineId: 1,
        medicineName: 'Crocin 650 Advance',
        batchNumber: body.batchNumber || 'CRO-2026-X1',
        expiryDate: body.expiryDate || '2027-12-31',
        quantity: Number(body.quantity) || 100,
        availableQuantity: Number(body.quantity) || 100,
        mrp: Number(body.mrp) || 50.0,
        sellingPrice: Number(body.sellingPrice) || 40.0,
      };
      store.batches.push(newBatch);
      store.stockLedger.push({
        id: store.stockLedger.length + 1,
        entryType: 'INWARD',
        medicineName: newBatch.medicineName,
        batchNumber: newBatch.batchNumber,
        quantityDelta: newBatch.quantity,
        createdAt: new Date().toISOString(),
      });
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Stock inwarded successfully', data: newBatch }),
      });
    }

    // 4. Catalog
    if (pathname.endsWith('/catalog') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 1,
              name: 'Crocin 650 Advance',
              company: 'GSK Pharmaceuticals',
              packSize: '15 Tablets',
              mrp: 50.0,
              sellingPrice: 40.0,
              availableStock: 100,
              isAvailable: true,
              salts: 'Paracetamol',
            },
          ],
          meta: {
            pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
          },
        }),
      });
    }

    // 5. Orders & FEFO Pick Allocation
    if (pathname.endsWith('/orders') && method === 'POST') {
      const body = request.postDataJSON() || {};
      const newOrder = {
        id: store.orders.length + 101,
        orderNumber: `ORD-2026-000${store.orders.length + 101}`,
        retailerId: '2',
        retailerName: 'Apollo City Pharmacy',
        status: 'PLACED',
        deliveryPartnerId: null,
        totalAmount: 400.0,
        items: (body.items || []).map((item: { medicineId?: number; quantity?: number }, idx: number) => ({
          id: idx + 1,
          medicineId: item.medicineId || 1,
          medicineName: 'Crocin 650 Advance',
          requestedQuantity: item.quantity || 10,
          unitPrice: 40.0,
        })),
      };
      store.orders.push(newOrder);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Order placed successfully', data: newOrder }),
      });
    }

    if (pathname.endsWith('/orders') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: store.orders,
          meta: { pagination: { page: 1, pageSize: 20, totalItems: store.orders.length, totalPages: 1 } },
        }),
      });
    }

    if (pathname.match(/\/orders\/\d+\/pick$/) && method === 'GET') {
      const order = store.orders[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order,
          allocations: [
            {
              orderItemId: 1,
              medicineId: 1,
              medicineName: 'Crocin 650 Advance',
              requestedQuantity: 10,
              suggestedBatch: {
                batchId: 101,
                batchNumber: 'CRO-2026-X1',
                expiryDate: '2027-12-31',
                availableQuantity: 100,
                allocatedQuantity: 10,
              },
            },
          ],
        }),
      });
    }

    if (pathname.match(/\/orders\/\d+\/approve$/) && method === 'POST') {
      const order = store.orders[0];
      if (order) {
        order.status = 'APPROVED';
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Order approved and allocated', data: order }),
      });
    }

    // 6. Delivery Pool, Claim & Complete
    if (pathname.endsWith('/delivery/pool') && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: store.orders.filter((o) => o.status === 'APPROVED' || o.status === 'PLACED'),
          meta: { pagination: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 } },
        }),
      });
    }

    if (pathname.match(/\/delivery\/orders\/\d+\/claim$/) && method === 'POST') {
      const order = store.orders[0];
      if (order) {
        order.status = 'OUT_FOR_DELIVERY';
        order.deliveryPartnerId = '3';
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Order claimed successfully', data: order }),
      });
    }

    if (pathname.match(/\/delivery\/orders\/\d+$/) && method === 'GET') {
      const order = store.orders[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            ...order,
            retailerShopName: order.retailerName,
            retailerAddress: 'Shop 4, Galaxy Heights, Navrangpura',
            retailerCity: 'Ahmedabad',
            retailerPhone: '9876543210',
          },
        }),
      });
    }

    if (pathname.match(/\/delivery\/orders\/\d+\/complete$/) && method === 'POST') {
      const order = store.orders[0];
      if (order) {
        order.status = 'DELIVERED';
      }
      // Record stock return in ledger for refused line
      store.stockLedger.push({
        id: store.stockLedger.length + 1,
        entryType: 'RETURN_IN',
        medicineName: 'Crocin 650 Advance',
        batchNumber: 'CRO-2026-X1',
        quantityDelta: 2,
        createdAt: new Date().toISOString(),
      });
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Delivery completed successfully with item refusal handled',
          data: { ...order, status: 'DELIVERED' },
          invoiceNumber: 'INV-2026-000101',
        }),
      });
    }

    // Default fallback
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [], meta: {} }),
    });
  });
}
