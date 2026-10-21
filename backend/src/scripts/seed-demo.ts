import { pool, query, withTransaction } from '../config/db.js';
import { hashPassword } from '../utils/crypto.js';
import { logger } from '../config/logger.js';

interface SeedSummary {
  usersCreated: number;
  saltsCreated: number;
  medicinesCreated: number;
  batchesCreated: number;
  ordersCreated: number;
  invoicesCreated: number;
}

export async function seedDemoData(): Promise<SeedSummary> {
  const summary: SeedSummary = {
    usersCreated: 0,
    saltsCreated: 0,
    medicinesCreated: 0,
    batchesCreated: 0,
    ordersCreated: 0,
    invoicesCreated: 0,
  };

  logger.info('Starting KD-IOMS Comprehensive Demo Data Seed...');

  // --------------------------------------------------------------------------
  // 1. SEED USERS & PROFILES
  // --------------------------------------------------------------------------
  const adminPasswordHash = await hashPassword('Admin@KD2026!');
  const retailerPasswordHash = await hashPassword('Retailer@KD2026!');
  const deliveryPasswordHash = await hashPassword('Delivery@KD2026!');

  // Admin user
  let adminUserId: string;
  const adminCheck = await query<{ id: string }>(
    `SELECT id FROM users WHERE username = 'admin' LIMIT 1`
  );
  if (adminCheck.rows.length === 0) {
    const res = await query<{ id: string }>(
      `INSERT INTO users (username, password_hash, role, phone, is_active, must_change_password)
       VALUES ('admin', $1, 'ADMIN', '9999999999', true, false)
       RETURNING id`,
      [adminPasswordHash]
    );
    adminUserId = res.rows[0].id;
    summary.usersCreated++;
  } else {
    adminUserId = adminCheck.rows[0].id;
  }

  // Retailer Users
  const retailers = [
    {
      username: 'apollo_pharmacy',
      phone: '9825012345',
      shopName: 'Apollo Pharmacy Navrangpura',
      address: 'Shop 4, Ground Floor, Shivalik Plaza, Navrangpura',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380009',
      whatsapp: '9825012345',
      email: 'navrangpura@apollopharmacy.org',
      drugLicense: 'GJ-AHM-20B-112233',
      gstin: '24AAACA1234A1Z1',
      status: 'APPROVED' as const,
    },
    {
      username: 'medplus_chemist',
      phone: '9879054321',
      shopName: 'MedPlus Chemist Vastrapur',
      address: 'GF-12, Galaxy Bazaar, Opp. Vastrapur Lake',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
      whatsapp: '9879054321',
      email: 'vastrapur@medplusindia.com',
      drugLicense: 'GJ-AHM-21B-445566',
      gstin: '24AAACM5678B1Z2',
      status: 'APPROVED' as const,
    },
    {
      username: 'wellness_store',
      phone: '9898098980',
      shopName: 'Wellness Chemist & Druggist',
      address: '10, S.G. Highway, Bodakdev',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380054',
      whatsapp: '9898098980',
      email: 'bodakdev@wellnesschemist.com',
      drugLicense: 'GJ-AHM-20B-778899',
      gstin: '24AAACW9988C1Z3',
      status: 'PENDING' as const,
    },
  ];

  const retailerUserMap = new Map<string, string>();

  for (const ret of retailers) {
    let retUserId: string;
    const existing = await query<{ id: string }>(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [ret.username]
    );

    if (existing.rows.length === 0) {
      const uRes = await query<{ id: string }>(
        `INSERT INTO users (username, password_hash, role, phone, is_active, must_change_password)
         VALUES ($1, $2, 'RETAILER', $3, true, false)
         RETURNING id`,
        [ret.username, retailerPasswordHash, ret.phone]
      );
      retUserId = uRes.rows[0].id;
      summary.usersCreated++;
    } else {
      retUserId = existing.rows[0].id;
    }
    retailerUserMap.set(ret.username, retUserId);

    // Upsert Retailer Profile
    await query(
      `INSERT INTO retailer_profiles (
         user_id, shop_name, address_line, city, state, pincode,
         whatsapp_number, email, drug_license_number, gstin, approval_status, reviewed_by, reviewed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         shop_name = EXCLUDED.shop_name,
         address_line = EXCLUDED.address_line,
         city = EXCLUDED.city,
         approval_status = EXCLUDED.approval_status`,
      [
        retUserId,
        ret.shopName,
        ret.address,
        ret.city,
        ret.state,
        ret.pincode,
        ret.whatsapp,
        ret.email,
        ret.drugLicense,
        ret.gstin,
        ret.status,
        adminUserId,
      ]
    );
  }

  // Delivery Partners
  const deliveryPartners = [
    { username: 'delivery_rajesh', phone: '9824056789' },
    { username: 'delivery_amit', phone: '9824011223' },
  ];

  const deliveryUserMap = new Map<string, string>();

  for (const dp of deliveryPartners) {
    let dpUserId: string;
    const existing = await query<{ id: string }>(
      `SELECT id FROM users WHERE username = $1 LIMIT 1`,
      [dp.username]
    );

    if (existing.rows.length === 0) {
      const uRes = await query<{ id: string }>(
        `INSERT INTO users (username, password_hash, role, phone, is_active, must_change_password)
         VALUES ($1, $2, 'DELIVERY', $3, true, false)
         RETURNING id`,
        [dp.username, deliveryPasswordHash, dp.phone]
      );
      dpUserId = uRes.rows[0].id;
      summary.usersCreated++;
    } else {
      dpUserId = existing.rows[0].id;
    }
    deliveryUserMap.set(dp.username, dpUserId);
  }

  // --------------------------------------------------------------------------
  // 2. SEED SALTS
  // --------------------------------------------------------------------------
  const standardSalts = [
    'Paracetamol',
    'Amoxicillin',
    'Clavulanic Acid',
    'Ibuprofen',
    'Cetirizine Hydrochloride',
    'Metformin Hydrochloride',
    'Azithromycin',
    'Pantoprazole',
    'Omeprazole',
    'Domperidone',
    'Diclofenac Sodium',
    'Montelukast Sodium',
    'Telmisartan',
    'Atorvastatin',
    'Amlodipine Besylate',
  ];

  for (const sName of standardSalts) {
    const res = await query(
      `INSERT INTO salts (salt_name, created_by)
       VALUES ($1, $2)
       ON CONFLICT (LOWER(TRIM(salt_name))) DO NOTHING`,
      [sName, adminUserId]
    );
    if ((res.rowCount ?? 0) > 0) summary.saltsCreated++;
  }

  const { rows: saltRows } = await query<{ salt_id: number; salt_name: string }>(
    `SELECT salt_id, salt_name FROM salts`
  );
  const saltMap = new Map<string, number>();
  for (const s of saltRows) {
    saltMap.set(s.salt_name.toLowerCase().trim(), s.salt_id);
  }

  // --------------------------------------------------------------------------
  // 3. SEED MEDICINES
  // --------------------------------------------------------------------------
  const medicineDefs = [
    {
      name: 'Augmentin 625 Duo',
      company: 'GlaxoSmithKline',
      packSize: '10 Tablets',
      gstRate: 12,
      salts: ['Amoxicillin', 'Clavulanic Acid'],
    },
    {
      name: 'Crocin 650 Advance',
      company: 'GlaxoSmithKline',
      packSize: '15 Tablets',
      gstRate: 12,
      salts: ['Paracetamol'],
    },
    {
      name: 'Dolo 650',
      company: 'Micro Labs Ltd',
      packSize: '15 Tablets',
      gstRate: 12,
      salts: ['Paracetamol'],
    },
    {
      name: 'Pan 40',
      company: 'Alkem Laboratories',
      packSize: '15 Tablets',
      gstRate: 12,
      salts: ['Pantoprazole'],
    },
    {
      name: 'Pan-D',
      company: 'Alkem Laboratories',
      packSize: '15 Capsules',
      gstRate: 12,
      salts: ['Pantoprazole', 'Domperidone'],
    },
    {
      name: 'Combiflam',
      company: 'Sanofi India',
      packSize: '20 Tablets',
      gstRate: 12,
      salts: ['Ibuprofen', 'Paracetamol'],
    },
    {
      name: 'Zithrox 500',
      company: 'Mankind Pharma',
      packSize: '3 Tablets',
      gstRate: 12,
      salts: ['Azithromycin'],
    },
    {
      name: 'Azithral 500',
      company: 'Alembic Pharmaceuticals',
      packSize: '5 Tablets',
      gstRate: 12,
      salts: ['Azithromycin'],
    },
    {
      name: 'Cetzine 10mg',
      company: "Dr. Reddy's Laboratories",
      packSize: '10 Tablets',
      gstRate: 12,
      salts: ['Cetirizine Hydrochloride'],
    },
    {
      name: 'Montair-LC',
      company: 'Cipla Ltd',
      packSize: '10 Tablets',
      gstRate: 12,
      salts: ['Montelukast Sodium', 'Cetirizine Hydrochloride'],
    },
    {
      name: 'Glycomet 500 SR',
      company: 'USV Private Ltd',
      packSize: '20 Tablets',
      gstRate: 12,
      salts: ['Metformin Hydrochloride'],
    },
    {
      name: 'Telma 40',
      company: 'Glenmark Pharmaceuticals',
      packSize: '30 Tablets',
      gstRate: 12,
      salts: ['Telmisartan'],
    },
    {
      name: 'Atorva 20',
      company: 'Zydus Cadila',
      packSize: '15 Tablets',
      gstRate: 12,
      salts: ['Atorvastatin'],
    },
    {
      name: 'Amlong 5',
      company: 'Micro Labs Ltd',
      packSize: '15 Tablets',
      gstRate: 12,
      salts: ['Amlodipine Besylate'],
    },
    {
      name: 'Voveran SR 100',
      company: 'Novartis India',
      packSize: '15 Tablets',
      gstRate: 12,
      salts: ['Diclofenac Sodium'],
    },
  ];

  const medicineIdMap = new Map<string, number>();

  for (const med of medicineDefs) {
    const sIds = med.salts
      .map((s) => saltMap.get(s.toLowerCase().trim()))
      .filter((id): id is number => typeof id === 'number');

    const res = await query<{ medicine_id: number }>(
      `INSERT INTO medicines (name, company, pack_size, gst_rate, salt_ids, is_active, created_by)
       VALUES ($1, $2, $3, $4, $5, true, $6)
       ON CONFLICT (name, company, pack_size) DO UPDATE SET
         salt_ids = EXCLUDED.salt_ids,
         gst_rate = EXCLUDED.gst_rate
       RETURNING medicine_id`,
      [med.name, med.company, med.packSize, med.gstRate, sIds, adminUserId]
    );

    if (res.rows.length > 0) {
      medicineIdMap.set(med.name, res.rows[0].medicine_id);
      summary.medicinesCreated++;
    }
  }

  // --------------------------------------------------------------------------
  // 4. SEED BATCHES & INVENTORY
  // --------------------------------------------------------------------------
  const today = new Date();
  const addDays = (d: Date, days: number) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().split('T')[0];
  };

  const batchDefs = [
    // Healthy / Active Batches
    {
      medName: 'Augmentin 625 Duo',
      batchNumber: 'AUG-26A',
      expiry: addDays(today, 450),
      mrp: 204.50,
      sellingPrice: 178.00,
      purchaseRate: 152.00,
      qty: 250,
      supplier: 'Glaxo Depot Ahmedabad',
    },
    {
      medName: 'Crocin 650 Advance',
      batchNumber: 'CRO-27B',
      expiry: addDays(today, 520),
      mrp: 33.50,
      sellingPrice: 28.50,
      purchaseRate: 24.00,
      qty: 600,
      supplier: 'Glaxo Depot Ahmedabad',
    },
    {
      medName: 'Dolo 650',
      batchNumber: 'DLO-31A',
      expiry: addDays(today, 600),
      mrp: 34.00,
      sellingPrice: 29.00,
      purchaseRate: 23.50,
      qty: 850,
      supplier: 'Micro Labs Distribution',
    },
    {
      medName: 'Pan 40',
      batchNumber: 'PAN-88C',
      expiry: addDays(today, 480),
      mrp: 155.00,
      sellingPrice: 132.00,
      purchaseRate: 110.00,
      qty: 400,
      supplier: 'Alkem Regional Depot',
    },
    {
      medName: 'Pan-D',
      batchNumber: 'PND-12A',
      expiry: addDays(today, 550),
      mrp: 195.00,
      sellingPrice: 165.00,
      purchaseRate: 140.00,
      qty: 320,
      supplier: 'Alkem Regional Depot',
    },
    {
      medName: 'Combiflam',
      batchNumber: 'CMB-44F',
      expiry: addDays(today, 400),
      mrp: 45.00,
      sellingPrice: 38.00,
      purchaseRate: 31.00,
      qty: 500,
      supplier: 'Sanofi Healthcare Ltd',
    },
    {
      medName: 'Zithrox 500',
      batchNumber: 'ZTX-09K',
      expiry: addDays(today, 380),
      mrp: 72.00,
      sellingPrice: 61.50,
      purchaseRate: 51.00,
      qty: 300,
      supplier: 'Mankind Supply Chain',
    },
    {
      medName: 'Azithral 500',
      batchNumber: 'AZT-77R',
      expiry: addDays(today, 430),
      mrp: 119.00,
      sellingPrice: 101.00,
      purchaseRate: 85.00,
      qty: 240,
      supplier: 'Alembic Pharma Depot',
    },
    {
      medName: 'Cetzine 10mg',
      batchNumber: 'CTZ-22M',
      expiry: addDays(today, 500),
      mrp: 58.00,
      sellingPrice: 48.00,
      purchaseRate: 39.00,
      qty: 450,
      supplier: "Dr. Reddy's Hub",
    },
    {
      medName: 'Montair-LC',
      batchNumber: 'MLC-90X',
      expiry: addDays(today, 460),
      mrp: 215.00,
      sellingPrice: 182.00,
      purchaseRate: 155.00,
      qty: 280,
      supplier: 'Cipla Distribution Ctr',
    },
    {
      medName: 'Glycomet 500 SR',
      batchNumber: 'GLY-11S',
      expiry: addDays(today, 620),
      mrp: 49.00,
      sellingPrice: 41.50,
      purchaseRate: 34.00,
      qty: 550,
      supplier: 'USV Pharma Depot',
    },
    {
      medName: 'Telma 40',
      batchNumber: 'TLM-55P',
      expiry: addDays(today, 580),
      mrp: 268.00,
      sellingPrice: 228.00,
      purchaseRate: 195.00,
      qty: 210,
      supplier: 'Glenmark Hub',
    },
    {
      medName: 'Atorva 20',
      batchNumber: 'ATV-33Z',
      expiry: addDays(today, 490),
      mrp: 310.00,
      sellingPrice: 264.00,
      purchaseRate: 225.00,
      qty: 180,
      supplier: 'Zydus Cadila Depot',
    },
    {
      medName: 'Amlong 5',
      batchNumber: 'AML-04Q',
      expiry: addDays(today, 540),
      mrp: 62.00,
      sellingPrice: 52.00,
      purchaseRate: 43.00,
      qty: 360,
      supplier: 'Micro Labs Distribution',
    },

    // Near-Expiry Batches (Expiring in 35-45 days) -> Populates Near-Expiry Alerts Tab!
    {
      medName: 'Dolo 650',
      batchNumber: 'EXP-NEAR-DLO',
      expiry: addDays(today, 35),
      mrp: 34.00,
      sellingPrice: 25.00,
      purchaseRate: 20.00,
      qty: 45,
      supplier: 'Micro Labs Clearance',
    },
    {
      medName: 'Combiflam',
      batchNumber: 'EXP-NEAR-CMB',
      expiry: addDays(today, 42),
      mrp: 45.00,
      sellingPrice: 32.00,
      purchaseRate: 26.00,
      qty: 60,
      supplier: 'Sanofi Clearance Lot',
    },

    // Expired Batches (Expired 20-30 days ago) -> Populates Expired Stock Alerts Tab!
    {
      medName: 'Pan 40',
      batchNumber: 'EXPIRED-PAN',
      expiry: addDays(today, -20),
      mrp: 155.00,
      sellingPrice: 120.00,
      purchaseRate: 95.00,
      qty: 20,
      supplier: 'Alkem Regional Depot',
    },
    {
      medName: 'Cetzine 10mg',
      batchNumber: 'EXPIRED-CTZ',
      expiry: addDays(today, -35),
      mrp: 58.00,
      sellingPrice: 40.00,
      purchaseRate: 30.00,
      qty: 15,
      supplier: "Dr. Reddy's Hub",
    },
  ];

  const batchIdMap = new Map<string, number>();

  for (const b of batchDefs) {
    const medId = medicineIdMap.get(b.medName);
    if (!medId) continue;

    const res = await query<{ batch_id: number }>(
      `INSERT INTO batches (
         medicine_id, batch_number, expiry_date, mrp, selling_price,
         purchase_rate, quantity_on_hand, status, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE', $8)
       ON CONFLICT (medicine_id, batch_number, expiry_date, mrp) DO UPDATE SET
         quantity_on_hand = EXCLUDED.quantity_on_hand,
         selling_price = EXCLUDED.selling_price
       RETURNING batch_id`,
      [medId, b.batchNumber, b.expiry, b.mrp, b.sellingPrice, b.purchaseRate, b.qty, adminUserId]
    );

    if (res.rows.length > 0) {
      const bId = res.rows[0].batch_id;
      batchIdMap.set(`${medId}-${b.batchNumber}`, bId);
      summary.batchesCreated++;

      // Stock Ledger Entry for Inwarding
      await query(
        `INSERT INTO stock_ledger_entries (
           batch_id, type, delta, balance_after, supplier_name, reason, created_by
         ) VALUES ($1, 'INWARD', $2, $2, $3, 'Initial demo stock inward', $4)`,
        [bId, b.qty, b.supplier, adminUserId]
      );
    }
  }

  // --------------------------------------------------------------------------
  // 5. SEED ORDERS, ORDER ITEMS & INVOICES
  // --------------------------------------------------------------------------
  const apolloId = retailerUserMap.get('apollo_pharmacy')!;
  const medplusId = retailerUserMap.get('medplus_chemist')!;
  const wellnessId = retailerUserMap.get('wellness_store')!;
  const rajeshId = deliveryUserMap.get('delivery_rajesh')!;
  const amitId = deliveryUserMap.get('delivery_amit')!;

  const augId = medicineIdMap.get('Augmentin 625 Duo')!;
  const doloId = medicineIdMap.get('Dolo 650')!;
  const panId = medicineIdMap.get('Pan 40')!;
  const combId = medicineIdMap.get('Combiflam')!;

  const augBatchId = batchIdMap.get(`${augId}-AUG-26A`);
  const doloBatchId = batchIdMap.get(`${doloId}-DLO-31A`);
  const panBatchId = batchIdMap.get(`${panId}-PAN-88C`);
  const combBatchId = batchIdMap.get(`${combId}-CMB-44F`);

  // Order 1: DELIVERED (Complete lifecycle with Tax Invoice)
  const o1Check = await query<{ order_id: number }>(
    `SELECT order_id FROM orders WHERE order_number = 'ORD-000001'`
  );
  if (o1Check.rows.length === 0) {
    const o1Res = await query<{ order_id: number }>(
      `INSERT INTO orders (
         order_number, retailer_id, delivery_partner_id, status, note,
         claimed_at, delivered_at, created_at, updated_at
       ) VALUES (
         'ORD-000001', $1, $2, 'DELIVERED', 'Urgent morning stock replenishment',
         NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours',
         NOW() - INTERVAL '1 day', NOW() - INTERVAL '2 hours'
       ) RETURNING order_id`,
      [apolloId, rajeshId]
    );
    const order1Id = o1Res.rows[0].order_id;
    summary.ordersCreated++;

    // Items
    const i1Res = await query<{ order_item_id: number }>(
      `INSERT INTO order_items (
         order_id, medicine_id, requested_quantity, quoted_price_incl_gst,
         picked_quantity, fulfilment_status, delivery_status
       ) VALUES ($1, $2, 20, 199.36, 20, 'FULL', 'ACCEPTED')
       RETURNING order_item_id`,
      [order1Id, augId]
    );
    const i2Res = await query<{ order_item_id: number }>(
      `INSERT INTO order_items (
         order_id, medicine_id, requested_quantity, quoted_price_incl_gst,
         picked_quantity, fulfilment_status, delivery_status
       ) VALUES ($1, $2, 50, 32.48, 50, 'FULL', 'ACCEPTED')
       RETURNING order_item_id`,
      [order1Id, doloId]
    );

    // Allocations
    if (augBatchId) {
      await query(
        `INSERT INTO order_allocations (
           order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method
         ) VALUES ($1, $2, 20, 178.00, 204.50, 12.00, 'SCAN_BARCODE')`,
        [i1Res.rows[0].order_item_id, augBatchId]
      );
    }
    if (doloBatchId) {
      await query(
        `INSERT INTO order_allocations (
           order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method
         ) VALUES ($1, $2, 50, 29.00, 34.00, 12.00, 'SCAN_BARCODE')`,
        [i2Res.rows[0].order_item_id, doloBatchId]
      );
    }

    // Status History
    await query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note, created_at)
       VALUES
         ($1, NULL, 'PLACED', $2, 'Order placed via portal', NOW() - INTERVAL '1 day'),
         ($1, 'PLACED', 'APPROVED', $3, 'Verified and inventory allocated', NOW() - INTERVAL '8 hours'),
         ($1, 'APPROVED', 'OUT_FOR_DELIVERY', $4, 'Dispatched with delivery partner', NOW() - INTERVAL '6 hours'),
         ($1, 'OUT_FOR_DELIVERY', 'DELIVERED', $4, 'Successfully delivered to pharmacy', NOW() - INTERVAL '2 hours')`,
      [order1Id, apolloId, adminUserId, rajeshId]
    );

    // Tax Invoice
    const billedToApollo = {
      shopName: 'Apollo Pharmacy Navrangpura',
      contactPerson: 'Mr. Jayesh Patel',
      addressLine: 'Shop 4, Ground Floor, Shivalik Plaza, Navrangpura',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380009',
      whatsappNumber: '9825012345',
      drugLicenseNumber: 'GJ-AHM-20B-112233',
      gstin: '24AAACA1234A1Z1',
    };

    const subtotal = 5010.00; // 20 * 178 + 50 * 29 = 3560 + 1450 = 5010
    const gstAmount = 601.20; // 12% of 5010 = 601.20
    const total = 5611.20;

    await query(
      `INSERT INTO invoices (
         invoice_number, order_id, retailer_id, billed_to,
         subtotal, gst_amount, round_off, total, pdf_path, generated_at
       ) VALUES (
         'INV-2026-0001', $1, $2, $3,
         $4, $5, 0.00, $6, '/uploads/invoices/INV-2026-0001.pdf', NOW() - INTERVAL '2 hours'
       )`,
      [order1Id, apolloId, JSON.stringify(billedToApollo), subtotal, gstAmount, total]
    );
    summary.invoicesCreated++;
  }

  // Order 2: OUT_FOR_DELIVERY (Active delivery tracking)
  const o2Check = await query<{ order_id: number }>(
    `SELECT order_id FROM orders WHERE order_number = 'ORD-000002'`
  );
  if (o2Check.rows.length === 0) {
    const o2Res = await query<{ order_id: number }>(
      `INSERT INTO orders (
         order_number, retailer_id, delivery_partner_id, status, note,
         claimed_at, created_at, updated_at
       ) VALUES (
         'ORD-000002', $1, $2, 'OUT_FOR_DELIVERY', 'Deliver before 4 PM',
         NOW() - INTERVAL '1 hour', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '1 hour'
       ) RETURNING order_id`,
      [medplusId, amitId]
    );
    const order2Id = o2Res.rows[0].order_id;
    summary.ordersCreated++;

    // Items
    const i1Res = await query<{ order_item_id: number }>(
      `INSERT INTO order_items (
         order_id, medicine_id, requested_quantity, quoted_price_incl_gst,
         picked_quantity, fulfilment_status, delivery_status
       ) VALUES ($1, $2, 30, 147.84, 30, 'FULL', 'PENDING')
       RETURNING order_item_id`,
      [order2Id, panId]
    );
    const i2Res = await query<{ order_item_id: number }>(
      `INSERT INTO order_items (
         order_id, medicine_id, requested_quantity, quoted_price_incl_gst,
         picked_quantity, fulfilment_status, delivery_status
       ) VALUES ($1, $2, 40, 42.56, 40, 'FULL', 'PENDING')
       RETURNING order_item_id`,
      [order2Id, combId]
    );

    // Allocations
    if (panBatchId) {
      await query(
        `INSERT INTO order_allocations (
           order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method
         ) VALUES ($1, $2, 30, 132.00, 155.00, 12.00, 'SCAN_BARCODE')`,
        [i1Res.rows[0].order_item_id, panBatchId]
      );
    }
    if (combBatchId) {
      await query(
        `INSERT INTO order_allocations (
           order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method
         ) VALUES ($1, $2, 40, 38.00, 45.00, 12.00, 'SCAN_BARCODE')`,
        [i2Res.rows[0].order_item_id, combBatchId]
      );
    }

    // Status History
    await query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note, created_at)
       VALUES
         ($1, NULL, 'PLACED', $2, 'Order placed via catalog checkout', NOW() - INTERVAL '4 hours'),
         ($1, 'PLACED', 'APPROVED', $3, 'Verified and packed for dispatch', NOW() - INTERVAL '2 hours'),
         ($1, 'APPROVED', 'OUT_FOR_DELIVERY', $4, 'Claimed by delivery partner Amit', NOW() - INTERVAL '1 hour')`,
      [order2Id, medplusId, adminUserId, amitId]
    );

    // Invoice for Order 2
    const billedToMedPlus = {
      shopName: 'MedPlus Chemist Vastrapur',
      contactPerson: 'Mr. Ramesh Shah',
      addressLine: 'GF-12, Galaxy Bazaar, Opp. Vastrapur Lake',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pincode: '380015',
      whatsappNumber: '9879054321',
      drugLicenseNumber: 'GJ-AHM-21B-445566',
      gstin: '24AAACM5678B1Z2',
    };

    const subtotal2 = 5480.00; // 30 * 132 + 40 * 38 = 3960 + 1520 = 5480
    const gstAmount2 = 657.60;
    const total2 = 6137.60;

    await query(
      `INSERT INTO invoices (
         invoice_number, order_id, retailer_id, billed_to,
         subtotal, gst_amount, round_off, total, pdf_path, generated_at
       ) VALUES (
         'INV-2026-0002', $1, $2, $3,
         $4, $5, 0.00, $6, '/uploads/invoices/INV-2026-0002.pdf', NOW() - INTERVAL '1 hour'
       )`,
      [order2Id, medplusId, JSON.stringify(billedToMedPlus), subtotal2, gstAmount2, total2]
    );
    summary.invoicesCreated++;
  }

  // Order 3: APPROVED (Awaiting delivery partner claim in Delivery Pool)
  const o3Check = await query<{ order_id: number }>(
    `SELECT order_id FROM orders WHERE order_number = 'ORD-000003'`
  );
  if (o3Check.rows.length === 0) {
    const o3Res = await query<{ order_id: number }>(
      `INSERT INTO orders (order_number, retailer_id, status, note, created_at, updated_at)
       VALUES ('ORD-000003', $1, 'APPROVED', 'Regular weekly batch replenishment', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour')
       RETURNING order_id`,
      [apolloId]
    );
    const order3Id = o3Res.rows[0].order_id;
    summary.ordersCreated++;

    const iRes = await query<{ order_item_id: number }>(
      `INSERT INTO order_items (
         order_id, medicine_id, requested_quantity, quoted_price_incl_gst,
         picked_quantity, fulfilment_status
       ) VALUES ($1, $2, 25, 32.48, 25, 'FULL')
       RETURNING order_item_id`,
      [order3Id, doloId]
    );

    if (doloBatchId) {
      await query(
        `INSERT INTO order_allocations (
           order_item_id, batch_id, quantity, rate, mrp, gst_rate, capture_method
         ) VALUES ($1, $2, 25, 29.00, 34.00, 12.00, 'MANUAL')`,
        [iRes.rows[0].order_item_id, doloBatchId]
      );
    }

    await query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note, created_at)
       VALUES
         ($1, NULL, 'PLACED', $2, 'Order placed via portal', NOW() - INTERVAL '3 hours'),
         ($1, 'PLACED', 'APPROVED', $3, 'Picking completed, staging in delivery pool', NOW() - INTERVAL '1 hour')`,
      [order3Id, apolloId, adminUserId]
    );
  }

  // Order 4: PLACED (Active in Orders Queue for Admin picking!)
  const o4Check = await query<{ order_id: number }>(
    `SELECT order_id FROM orders WHERE order_number = 'ORD-000004'`
  );
  if (o4Check.rows.length === 0) {
    const o4Res = await query<{ order_id: number }>(
      `INSERT INTO orders (order_number, retailer_id, status, note, created_at, updated_at)
       VALUES ('ORD-000004', $1, 'PLACED', 'High priority order for cardiac & antibiotic medicines', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes')
       RETURNING order_id`,
      [medplusId]
    );
    const order4Id = o4Res.rows[0].order_id;
    summary.ordersCreated++;

    await query(
      `INSERT INTO order_items (order_id, medicine_id, requested_quantity, quoted_price_incl_gst)
       VALUES
         ($1, $2, 15, 199.36),
         ($1, $3, 30, 147.84)`,
      [order4Id, augId, panId]
    );

    await query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note, created_at)
       VALUES ($1, NULL, 'PLACED', $2, 'Order newly placed by retailer', NOW() - INTERVAL '30 minutes')`,
      [order4Id, medplusId]
    );
  }

  // Order 5: REJECTED (Demonstrates rejection reason tracking)
  const o5Check = await query<{ order_id: number }>(
    `SELECT order_id FROM orders WHERE order_number = 'ORD-000005'`
  );
  if (o5Check.rows.length === 0) {
    const o5Res = await query<{ order_id: number }>(
      `INSERT INTO orders (order_number, retailer_id, status, note, rejection_reason, created_at, updated_at)
       VALUES ('ORD-000005', $1, 'REJECTED', 'First time trial order', 'Retailer KYC profile under pending review. Please verify drug license.', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
       RETURNING order_id`,
      [wellnessId]
    );
    summary.ordersCreated++;

    await query(
      `INSERT INTO order_items (order_id, medicine_id, requested_quantity, quoted_price_incl_gst)
       VALUES ($1, $2, 10, 32.48)`,
      [o5Res.rows[0].order_id, doloId]
    );

    await query(
      `INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note, created_at)
       VALUES
         ($1, NULL, 'PLACED', $2, 'Order submitted', NOW() - INTERVAL '2 days'),
         ($1, 'PLACED', 'REJECTED', $3, 'KYC pending compliance rejection', NOW() - INTERVAL '1 day')`,
      [o5Res.rows[0].order_id, wellnessId, adminUserId]
    );
  }

  // --------------------------------------------------------------------------
  // 6. SYNC DOCUMENT SEQUENCES
  // --------------------------------------------------------------------------
  await query(
    `INSERT INTO document_sequences (code, current_val)
     VALUES ('ORD', 5), ('INV', 2)
     ON CONFLICT (code) DO UPDATE SET
       current_val = GREATEST(document_sequences.current_val, EXCLUDED.current_val)`
  );

  logger.info(summary, 'KD-IOMS Demo Data Seed Completed Successfully');
  return summary;
}

// CLI Execution Entrypoint
if (
  process.argv[1]?.endsWith('seed-demo.ts') ||
  process.argv[1]?.endsWith('seed-demo.js') ||
  import.meta.url.endsWith('seed-demo.ts')
) {
  seedDemoData()
    .then(async (summary) => {
      console.log('\n========================================');
      console.log('  KD-IOMS Demo Data Seed Summary');
      console.log('========================================');
      console.log(`Users Created:     ${summary.usersCreated}`);
      console.log(`Salts Created:     ${summary.saltsCreated}`);
      console.log(`Medicines Created: ${summary.medicinesCreated}`);
      console.log(`Batches Created:   ${summary.batchesCreated}`);
      console.log(`Orders Created:    ${summary.ordersCreated}`);
      console.log(`Invoices Created:  ${summary.invoicesCreated}`);
      console.log('========================================\n');
      console.log('Demo Credentials:');
      console.log('  Admin:            admin / Admin@KD2026!');
      console.log('  Retailer 1:       apollo_pharmacy / Retailer@KD2026! (Approved)');
      console.log('  Retailer 2:       medplus_chemist / Retailer@KD2026! (Approved)');
      console.log('  Retailer 3:       wellness_store / Retailer@KD2026! (Pending KYC)');
      console.log('  Delivery Partner: delivery_rajesh / Delivery@KD2026!');
      console.log('========================================\n');
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('\n[SEED ERROR] Failed to seed demo data:', err);
      await pool.end();
      process.exit(1);
    });
}
