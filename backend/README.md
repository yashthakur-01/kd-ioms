<!-- generated-by: gsd-doc-writer -->
# @kd-ioms/backend

Express REST API service for KD-IOMS, providing transactional business logic, FEFO inventory allocation, authentication, and database migrations.

Part of the [KD-IOMS](../README.md) monorepo.

## Overview

The backend package implements the REST API layer for KD-IOMS using Node.js and Express 5. It manages business operations through raw SQL transactions in PostgreSQL, enforces atomic stock mutations via an append-only stock ledger, validates incoming data with Zod schemas, and provides structured logging and error handling.

## Installation

Dependencies are managed at the monorepo root:

```bash
# From monorepo root
npm install

# Or specifically for backend workspace
npm install --workspace=backend
```

## Usage

### Development Server

Run the development server with hot-reloading via `tsx watch`:

```bash
npm run dev --workspace=backend
```

The server listens on `http://localhost:5000` (or the configured `PORT`).

### Production Build

Compile TypeScript source files into JavaScript in `dist/`:

```bash
npm run build --workspace=backend
```

Run the compiled production server:

```bash
npm run start --workspace=backend
```

### Database Operations

```bash
# Run pending PostgreSQL migrations
npm run db:migrate --workspace=backend

# Seed or verify default administrator account
npm run seed:admin --workspace=backend
```

## Architecture & Modules

The backend is organized into domain modules under `src/modules/`:

| Module | Responsibility |
| :--- | :--- |
| `auth` | User authentication, token issuance, refresh token rotation, and password resets. |
| `user` | User provisioning, staff role assignments, and status toggles. |
| `salt` | Chemical active ingredient master catalog and phonetic/fuzzy search suggestions. |
| `medicine` | Medicine catalog management, packaging specifications, and MRP/cost prices. |
| `stock-inward`| Supplier consignment processing and GS1 DataMatrix barcode parsing. |
| `stock-ledger`| Single canonical entry point (`applyLedgerEntry`) for immutable inventory audits. |
| `batch` | Batch status management, rack locations, and manual stock adjustment logging. |
| `retailer` | Retailer registration, drug license verification, and credit term approvals. |
| `catalog` | Retailer-facing catalog browsing with real-time stock availability and tiered pricing. |
| `order` | Order placement, state machines (`PLACED`, `APPROVED`, `CANCELLED`), and allocation. |
| `allocation` | First-Expired, First-Out (FEFO) batch allocation algorithms. |
| `delivery` | Delivery run manifests, driver dispatch, and proof-of-delivery tracking (signatures/OTP). |
| `invoice` | Automated PDF tax invoice generation, tax breakdown, and storage uploads. |
| `alert` | Automated inventory alerts for low stock levels and approaching expiration dates. |
| `settings` | System operational parameters and global discount percentage rules. |
| `dashboard` | Operational metrics, stock valuations, and KPI aggregation. |

## Testing

Backend tests are powered by Vitest and execute in an ESM environment:

```bash
# Run full backend test suite
npm run test --workspace=backend

# Run tests in watch mode
npm run test:watch --workspace=backend

# Run typecheck
npm run lint --workspace=backend
```
