# 🏥 KD-IOMS — Kandarp Drugs Inventory & Order Management System

<div align="center">

![KD-IOMS Banner](https://img.shields.io/badge/KD--IOMS-Pharmaceutical%20Distribution%20Platform-0070f3?style=for-the-badge&logo=shield)

[![CI Pipeline](https://github.com/yashthakur-01/kd-ioms/actions/workflows/ci.yml/badge.svg)](https://github.com/yashthakur-01/kd-ioms/actions)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x%20%7C%207.x-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-000000?style=flat&logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tested_with-Vitest-6E9F18?style=flat&logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

**A high-concurrency, audit-compliant B2B pharmaceutical wholesale distribution and inventory order management system designed for pharmaceutical distributors, retail pharmacies, and logistics teams.**

[Explore Architecture](kd-ioms/docs/ARCHITECTURE.md) • [Getting Started](kd-ioms/docs/GETTING-STARTED.md) • [API Documentation](kd-ioms/docs/API.md) • [Deployment Guide](kd-ioms/docs/DEPLOYMENT.md) • [Security & Runbooks](kd-ioms/docs/RUNBOOK.md)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Order Lifecycle Workflow](#-order-lifecycle-workflow)
- [Core Invariants & Engineering Guarantees](#-core-invariants--engineering-guarantees)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
- [Demo Credentials](#-demo-credentials)
- [Monorepo Scripts](#-monorepo-scripts)
- [API Overview](#-api-overview)
- [Testing & Quality Assurance](#-testing--quality-assurance)
- [Documentation Directory](#-documentation-directory)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

**KD-IOMS** manages end-to-end pharmaceutical wholesale distribution operations under strict regulatory requirements (Drugs and Cosmetics Act, GST compliance, and Good Distribution Practices). It eliminates overselling, manages perishable stock through strict **FEFO (First-Expired, First-Out)** principles, maintains an immutable double-entry stock ledger, and automates order lifecycles from retailer checkout to delivery and tax invoicing.

### Why KD-IOMS?

- 📦 **Perishable Expiry Risks**: Pharmaceuticals have finite shelf lives. KD-IOMS automatically enforces FEFO picking, prevents inwarding batches close to expiry, and blocks dispatch of expired stock.
- ⚡ **High Concurrency & Overselling**: In B2B wholesale, multiple retailers place orders concurrently for scarce medicines. KD-IOMS utilizes deterministic row-level PostgreSQL locks and serializable transactions to guarantee zero overselling.
- 🧾 **Regulatory Compliance**: Complete GST calculation (HSN codes, CGST, SGST, IGST), mandatory drug license verification, and automated PDF tax invoices with digital dispatch via WhatsApp and Email.
- 📱 **Field-Ready Logistics**: Delivery partners use a responsive mobile interface with atomic pool claiming, recipient photo Proof-of-Delivery (POD), and line-item refusal handling with automatic warehouse restock.

---

## 🚀 Key Features

### 🏢 1. Administrator & Warehouse Operations
- **Medicine & Salt Master**: Comprehensive product catalog with generic salt composition mapping and fuzzy similarity checking to prevent duplicate master records.
- **Stock Inwarding (GRN)**: Inward inventory batches with barcode / OCR label scanning, manufacturing/expiry date validation, and purchase price vs. MRP enforcement.
- **Immutable Stock Ledger**: Append-only audit trail recording every inventory movement (inward, reservation, allocation, delivery, write-off, return).
- **Order Picking & Allocation**: FEFO-guided picking lists, physical scan verification, batch resolution, and partial order fulfillment.
- **Automated Tax Invoicing**: Generates GST-compliant PDF invoices using PDFKit, uploaded to Supabase Storage and dispatched automatically to retailers.
- **Real-Time Analytics Dashboard**: Live metrics on gross sales, active orders, low-stock batches, upcoming expiries, and delivery performance.

### 💊 2. Retailer Portal (Pharmacies & Chemists)
- **KYC & Onboarding**: Self-service registration with Drug License (Form 20B/21B) and GSTIN upload, subject to admin verification before ordering.
- **Live Inventory & Pricing**: Search medicines by brand or salt composition with real-time stock availability, volume-tiered discounts, and price breakdown.
- **Order Management**: Cart creation, checkout with delivery instructions, order history, and instant digital invoice downloads.

### 🚚 3. Delivery Fleet Portal
- **Atomic Pool Claiming**: Available deliveries are pooled; delivery personnel claim orders atomically, eliminating race conditions.
- **Proof-of-Delivery (POD)**: Capture delivery confirmation with recipient signatures, contact verification, or uploaded photo evidence.
- **Item Refusal & Restock**: If a retailer refuses damaged or expired items at the doorstep, the delivery partner logs the refusal, which instantly restocks the exact batch in the warehouse.

---

## 🏗️ System Architecture

KD-IOMS is built as an npm monorepo separating presentation from backend business logic while sharing TypeScript schemas and domain enums.

```mermaid
graph TD
    Client["Client Browser / Mobile PWA\n(Tailwind CSS + React 19)"]

    subgraph FrontendApp ["Frontend: Next.js 16 App Router"]
        UI["Route Groups\n(admin) / (retailer) / (delivery) / (auth)"]
        ReactQuery["TanStack React Query Cache"]
        Proxy["Next.js Route Rewrites (/api/v1/*)"]
        UI --> ReactQuery
        ReactQuery --> Proxy
    end

    subgraph BackendApp ["Backend: Node.js + Express 5 + TypeScript"]
        Middleware["Middleware Pipeline\n(RequestID, AccessLog, Helmet, RateLimiter, JWT Auth, Idempotency)"]
        Controllers["Domain Controllers\n(Auth, Catalog, Order, Inward, Delivery, Invoice)"]
        Services["Business Services & Allocation Engine"]
        Ledger["Stock Ledger Service\n(applyLedgerEntry)"]
        DBPool["PostgreSQL Transaction Pool\n(withTransaction + Row-Level Locks)"]

        Middleware --> Controllers
        Controllers --> Services
        Services --> Ledger
        Services --> DBPool
        Ledger --> DBPool
    end

    subgraph Persistence ["Data & External Services"]
        Postgres[("PostgreSQL Database\n(Tables, Views, Row Locks, Migrations)")]
        SupabaseStorage[("Supabase Storage\n(Invoice PDFs & Delivery Photos)")]
        NotificationServices["Notification Gateways\n(SMTP Email & Meta WhatsApp API)"]
    end

    Client --> UI
    Proxy -->|HTTP / JSON| Middleware
    DBPool -->|Raw SQL Transactions| Postgres
    Services -->|Uploads| SupabaseStorage
    Services -->|Dispatches| NotificationServices
```

---

## 🔄 Order Lifecycle Workflow

```mermaid
stateDiagram-v2
    [*] --> PLACED: Retailer / Staff places order
    PLACED --> APPROVED: Admin approves order & locks stock
    PLACED --> CANCELLED: Retailer cancels before approval

    APPROVED --> PICKING: Warehouse staff begins picking
    APPROVED --> CANCELLED: Admin cancels with full restock

    PICKING --> DISPATCHED: FEFO batches verified & packed
    PICKING --> PARTIAL_DISPATCHED: Out-of-stock items rejected & restocked

    DISPATCHED --> IN_TRANSIT: Delivery partner claims order
    IN_TRANSIT --> DELIVERED: POD captured & invoice finalized
    IN_TRANSIT --> PARTIAL_DELIVERED: Damaged items refused (restocked)
    IN_TRANSIT --> UNDELIVERED: Retailer unavailable / address issue

    DELIVERED --> [*]
    PARTIAL_DELIVERED --> [*]
    CANCELLED --> [*]
```

---

## 🛡️ Core Invariants & Engineering Guarantees

1. **Single Entrypoint for Stock Mutation (`applyLedgerEntry`)**  
   Batch counts (`batches.quantity_on_hand`) are **never** modified via direct SQL `UPDATE` queries. All adjustments pass through the ledger service, guaranteeing that every balance change has a corresponding immutable entry in `stock_ledger`.

2. **Ascending Row-Level Lock Order (Deadlock Elimination)**  
   When multiple medicines or batches are locked in a transaction, IDs are sorted strictly in ascending order (`ORDER BY medicine_id ASC`). This mathematically eliminates cyclical wait-for dependencies across concurrent order placements.

3. **Strict FEFO Allocation (First-Expired, First-Out)**  
   Orders automatically consume inventory from batches with the earliest expiry date (`expiry_date ASC`) that satisfy minimum shelf-life rules and are not marked as blocked or quarantined.

4. **Idempotent Operations**  
   All mutating requests (order checkout, stock inwarding, payments, delivery completion) support the `Idempotency-Key` header, preventing duplicate transactions on network retries.

5. **Standardized Response Envelope**  
   Every API endpoint returns a uniform JSON envelope with request tracing IDs:
   ```json
   {
     "success": true,
     "code": "ORDER_PLACED",
     "message": "Order placed successfully",
     "data": { "orderId": 41, "orderNumber": "ORD-000041" },
     "meta": { "requestId": "req_8f3c1a2b", "timestamp": "2026-10-24T12:00:00.000Z" }
   }
   ```

---

## 💻 Tech Stack

| Domain | Technology | Description |
| :--- | :--- | :--- |
| **Monorepo** | [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) | Monorepo structure managing frontend and backend packages |
| **Frontend Framework** | [Next.js 16 (App Router)](https://nextjs.org/) | Modern React 19 server/client components with Turbopack |
| **Frontend Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | High-performance atomic utility CSS styling |
| **Frontend State & Fetching** | [TanStack React Query v5](https://tanstack.com/query) | Server-state caching, background revalidation, optimistic updates |
| **Hardware Scanning** | [html5-qrcode](https://github.com/mebjas/html5-qrcode) | Device camera barcode and QR code scanner for stock picking |
| **Backend Framework** | [Express 5](https://expressjs.com/) on [Node.js 20+](https://nodejs.org/) | High-throughput asynchronous REST API |
| **Language** | [TypeScript](https://www.typescriptlang.org/) | End-to-end type safety shared across backend and frontend |
| **Database** | [PostgreSQL 15+](https://www.postgresql.org/) | ACID transactions, row-level locks, views, triggers, and indices |
| **Validation** | [Zod 4](https://zod.dev/) | Strict runtime request schema validation and sanitization |
| **Logging** | [Pino](https://getpino.io/) & `pino-http` | High-performance JSON structured logging with request ID tracing |
| **Document Generation** | [PDFKit](https://pdfkit.org/) | Server-side GST tax invoice PDF generation |
| **Object Storage** | [Supabase Storage](https://supabase.com/storage) | Cloud storage for tax invoice PDFs and delivery photos |
| **Testing** | [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/) | Unit, integration, and end-to-end browser test suites |

---

## 📂 Repository Structure

```text
kd-ioms/
├── .github/
│   └── workflows/ci.yml         # GitHub Actions CI workflow (lint, test, enum sync)
├── docs/                        # Complete technical & operational documentation
│   ├── ARCHITECTURE.md          # In-depth architectural design & patterns
│   ├── API.md                   # Complete REST API reference
│   ├── GETTING-STARTED.md       # Local environment onboarding guide
│   ├── CONFIGURATION.md         # Environment variables & runtime settings
│   ├── TESTING.md               # Vitest, Playwright, and test strategies
│   ├── DEPLOYMENT.md            # Production deployment (Render, Vercel, Supabase)
│   ├── ADMIN-GUIDE.md           # Administrator portal operating instructions
│   ├── DELIVERY-GUIDE.md        # Delivery driver workflows & POD instructions
│   ├── OWASP-TOP-10.md          # Security audit & hardening checklist
│   ├── RUNBOOK.md               # Operations, disaster recovery, and maintenance
│   └── openapi.yaml             # OpenAPI 3.0 API specifications
├── backend/                     # Node.js + Express REST API workspace
│   ├── migrations/              # Raw SQL schema migrations (001_init to 005_*)
│   ├── src/
│   │   ├── config/              # DB pool, logger, environment config
│   │   ├── constants/           # Success & error codes, business limits
│   │   ├── enums/               # Domain enums (Order status, User roles)
│   │   ├── errors/              # AppError classes & PG error translators
│   │   ├── middleware/          # Auth, request ID, idempotency, rate limiting
│   │   ├── modules/             # Modular vertical slices:
│   │   │   ├── auth/            # JWT authentication, cookies, refresh tokens
│   │   │   ├── medicine/        # Medicine catalog & HSN tax codes
│   │   │   ├── salt/            # Salt master & similarity matching
│   │   │   ├── batch/           # Batch inventory, expiry tracking
│   │   │   ├── stock-inward/    # Goods receipt (GRN) & barcode parsing
│   │   │   ├── stock-ledger/    # Immutable stock ledger service
│   │   │   ├── order/           # Order placement, locking, approvals
│   │   │   ├── allocation/      # FEFO stock allocation engine
│   │   │   ├── delivery/        # Dispatch pool, claiming, and photo POD
│   │   │   ├── invoice/         # PDFKit invoice generation & tax math
│   │   │   ├── notification/    # WhatsApp & SMTP email dispatchers
│   │   │   └── retailer/        # Retailer KYC, verification, credit limits
│   │   ├── scripts/             # Admin seeds, demo datasets, db backups
│   │   ├── app.ts               # Express application initialization
│   │   └── server.ts            # Server entrypoint and graceful shutdown
│   └── vitest.config.ts         # Backend test configuration
├── frontend/                    # Next.js 16 App Router workspace
│   ├── public/                  # Static assets and icons
│   ├── scripts/sync-enums.js    # Script keeping frontend enums in sync with backend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (admin)/         # Admin dashboard, orders, inventory, invoices
│   │   │   ├── (auth)/          # Login, password reset
│   │   │   ├── (delivery)/      # Delivery driver portal & POD scanner
│   │   │   └── (retailer)/      # Retailer catalog, cart, and orders
│   │   ├── components/          # Reusable Tailwind UI components
│   │   ├── hooks/               # Custom TanStack Query hooks
│   │   └── lib/                 # API client, auth helpers, formatting
│   ├── next.config.ts           # Next.js config with backend API proxy rewrites
│   └── playwright.config.ts     # Playwright E2E configuration
├── package.json                 # Monorepo root package.json
└── tech.md                      # Comprehensive technical build specification
```

---

## ⚙️ Prerequisites

Ensure your development machine has the following installed:

- **Node.js**: `>= 20.0.0` (LTS recommended)
- **npm**: `>= 10.0.0`
- **PostgreSQL**: `>= 15.0` (Running locally, in Docker, or via [Supabase](https://supabase.com/))
- **Git**

---

## ⚡ Quick Start Guide

### 1. Clone the Repository
```bash
git clone https://github.com/yashthakur-01/kd-ioms.git
cd kd-ioms
```

### 2. Install Dependencies
Install all workspace dependencies from the root directory:
```bash
npm install
```

### 3. Configure Environment Variables
Copy the backend environment template and populate your credentials:
```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your PostgreSQL database URL and JWT secrets:
```env
PORT=5000
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/postgres
JWT_ACCESS_SECRET=your_super_secret_access_jwt_key_32_bytes_long
JWT_REFRESH_SECRET=your_super_secret_refresh_jwt_key_32_bytes_long
COOKIE_SECRET=your_cookie_encryption_secret_minimum_32_characters
```

*(Optional)* Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` if testing PDF cloud storage or photo uploads.

### 4. Run Database Migrations
Create tables, indexes, functions, triggers, and views:
```bash
npm run db:migrate
```

### 5. Seed Database
Seed the initial administrator and full demo dataset (retailers, medicines, stock batches, orders, and delivery partners):
```bash
# Seed default admin user
npm run seed:admin

# (Recommended) Seed full demo catalog, batches, and orders
npm run seed:demo --workspace=backend
```

### 6. Start Development Servers
Run backend and frontend servers simultaneously using the monorepo root script:
```bash
npm run dev
```

The application is now live:
- 🌐 **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- 🔌 **Backend REST API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- 🩺 **Health Check**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

---

## 🔑 Demo Credentials

When running `npm run seed:demo`, the following pre-configured test accounts are available:

| Role | Username | Password | Purpose / Capabilities |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `Admin@KD2026!` | Full system access, catalog, inventory inwarding, order approval, invoicing |
| **Retailer (Approved)** | `apollo_pharmacy` | `Retailer@KD2026!` | Active chemist account with full catalog access and checkout privileges |
| **Retailer (Pending)** | `wellness_store` | `Retailer@KD2026!` | Demonstrates onboarding KYC state (catalog locked until admin approval) |
| **Delivery Partner** | `delivery_rajesh` | `Delivery@KD2026!` | Mobile delivery portal access, pool claiming, photo POD, item refusal |

---

## 📜 Monorepo Scripts

Run these scripts from the repository root:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts both backend (`:5000`) and frontend (`:3000`) concurrently |
| `npm run dev:backend` | Starts only the Express API with `tsx watch` |
| `npm run dev:frontend` | Starts only the Next.js development server |
| `npm run build` | Builds production artifacts for both backend (`tsc`) and frontend (`next build`) |
| `npm run test` | Runs the test suites across both backend and frontend workspaces |
| `npm run test:backend` | Runs backend Vitest suites |
| `npm run test:frontend` | Runs frontend Vitest suites |
| `npm run test:e2e` | Executes Playwright end-to-end browser tests |
| `npm run lint` | Runs TypeScript type checking and ESLint across all workspaces |
| `npm run db:migrate` | Applies incremental SQL migrations to the configured PostgreSQL database |
| `npm run seed:admin` | Seeds the primary administrator user |
| `npm run sync-enums` | Automatically copies backend domain enums to the frontend |
| `npm run sync-enums:check` | Verifies frontend and backend enums match (enforced in CI) |
| `npm run backup` | Executes automated database backup |
| `npm run verify-restore` | Validates database backup restoration integrity |

---

## 🔌 API Overview

All backend endpoints are prefixed with `/api/v1` and follow REST conventions:

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | System health check and database connectivity |
| `POST` | `/api/v1/auth/login` | Public | Authenticates credentials and returns JWT tokens |
| `POST` | `/api/v1/auth/refresh` | Public | Exchanges refresh token for new access token |
| `GET` | `/api/v1/catalog` | Approved Retailer / Admin | Lists medicines with dynamic pricing and availability |
| `POST` | `/api/v1/orders` | Retailer | Places a new order with stock validation |
| `GET` | `/api/v1/orders` | Authenticated | Lists orders with pagination and status filters |
| `PATCH` | `/api/v1/orders/:id/approve`| Admin | Approves order and runs FEFO stock allocation |
| `POST` | `/api/v1/stock/inward` | Admin | Inwards medicine batches to inventory ledger |
| `GET` | `/api/v1/delivery/pool` | Delivery Partner | Lists unassigned orders ready for delivery |
| `POST` | `/api/v1/delivery/:id/claim`| Delivery Partner | Atomically claims an order for delivery |
| `POST` | `/api/v1/delivery/:id/deliver`| Delivery Partner | Submits Proof-of-Delivery with photos / signatures |
| `GET` | `/api/v1/invoices/:id/pdf` | Retailer / Admin | Streams generated GST tax invoice PDF |

> Complete API specifications, request bodies, error schemas, and OpenAPI documentation are available in [docs/API.md](kd-ioms/docs/API.md) and [docs/openapi.yaml](kd-ioms/docs/openapi.yaml).

---

## 🧪 Testing & Quality Assurance

KD-IOMS enforces strict automated quality checks:

- **Unit & Integration Tests**: Over 80+ test suites using [Vitest](https://vitest.dev/), covering database transactions, concurrency locking, and edge-case validations.
- **E2E Testing**: [Playwright](https://playwright.dev/) tests simulating real user journeys across all three portals (Admin, Retailer, Delivery).
- **Enum Drift Verification**: `npm run sync-enums:check` ensures frontend domain models never drift out of sync with backend types.
- **CI Pipeline**: Every pull request triggers GitHub Actions validating type safety, enum sync, linting, and automated test execution.

Run the full verification suite locally:
```bash
npm run sync-enums:check
npm run lint
npm run test
```

---

## 📚 Documentation Directory

Explore the `docs/` folder for in-depth engineering guides:

- 🏛️ [System Architecture](kd-ioms/docs/ARCHITECTURE.md) — Architectural patterns, transaction lifecycle, and invariants.
- 🚀 [Getting Started Guide](kd-ioms/docs/GETTING-STARTED.md) — Comprehensive developer setup and environment configuration.
- ⚙️ [Configuration Reference](kd-ioms/docs/CONFIGURATION.md) — Complete environment variable reference.
- 📡 [API Documentation](kd-ioms/docs/API.md) — Comprehensive HTTP endpoint reference and response schemas.
- 🧪 [Testing Guide](kd-ioms/docs/TESTING.md) — Test setup, concurrency testing patterns, and Vitest configuration.
- 🚢 [Deployment Guide](kd-ioms/docs/DEPLOYMENT.md) — Production architecture for Render, Vercel, and Supabase.
- 🛡️ [OWASP Top 10 Hardening](kd-ioms/docs/OWASP-TOP-10.md) — Security compliance and mitigation checklist.
- 📖 [Operations Runbook](kd-ioms/docs/RUNBOOK.md) — Incident response, backup verification, and database maintenance.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository and create your branch: `git checkout -b feature/amazing-feature`.
2. Ensure all tests and linting pass: `npm run lint && npm run test`.
3. Verify enum synchronization: `npm run sync-enums:check`.
4. Commit your changes: `git commit -m 'feat: add amazing feature'`.
5. Push to the branch: `git push origin feature/amazing-feature`.
6. Open a Pull Request.

---

## 📄 License

This project is licensed under the [ISC License](LICENSE).
