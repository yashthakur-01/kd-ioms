<!-- generated-by: gsd-doc-writer -->
# @kd-ioms/frontend

Next.js 16 (App Router) web application for KD-IOMS, providing web portals for administrators, wholesale retailers, and delivery operations.

Part of the [KD-IOMS](../README.md) monorepo.

## Overview

The frontend package is built with React 19, Next.js 16, and Tailwind CSS. It connects to the Express API backend through Next.js server-side route rewrites (`/api/v1/:path*`), avoiding CORS configuration for browser sessions and ensuring same-site cookie handling. Data synchronization is managed via TanStack React Query v5.

## Installation

Dependencies are managed at the monorepo root:

```bash
# From monorepo root
npm install

# Or specifically for frontend workspace
npm install --workspace=frontend
```

## Usage

### Development Server

Run the Next.js development server with Turbopack:

```bash
npm run dev --workspace=frontend
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Production Build

Compile and bundle the production application:

```bash
npm run build --workspace=frontend
```

Run the built production server:

```bash
npm run start --workspace=frontend
```

### Enum Synchronization

Domain enums (order statuses, user roles, payment modes) are defined canonically in the backend and synchronized into the frontend:

```bash
# Check if frontend enums are in sync with backend
npm run sync-enums:check --workspace=frontend

# Synchronize enums from backend to frontend
npm run sync-enums --workspace=frontend
```

## Application Structure

The frontend leverages the Next.js App Router layout hierarchy (`src/app/`):

| Route Group / Page | Audience | Description |
| :--- | :--- | :--- |
| `src/app/(auth)/login` | All Users | Authentication login screen with password change redirection. |
| `src/app/(admin)/dashboard` | Administrator | Operational KPI cards, low stock alerts, and daily sales metrics. |
| `src/app/(admin)/medicines` | Administrator | Product catalog management, medicine creation modal, pricing editors. |
| `src/app/(admin)/batches` | Administrator | Batch inventory listing, rack locations, and manual stock adjustment forms. |
| `src/app/(admin)/orders` | Administrator | Order approval workflow, pick sheet generation, and rejection handlers. |
| `src/app/(admin)/retailers` | Administrator | Retailer onboarding applications and drug license approvals. |
| `src/app/(admin)/invoices` | Administrator | Tax invoices, payment status tracking, and PDF downloads. |
| `src/app/(admin)/delivery` | Administrator | Trip dispatch, route assignments, and proof-of-delivery reviews. |
| `src/app/(admin)/alerts` | Administrator | Inventory threshold warnings, low-stock notifications, and acknowledgement. |
| `src/app/(retailer)/catalog` | Retailer | Searchable medicine catalog with live stock status and wholesale rates. |
| `src/app/(retailer)/orders` | Retailer | Retailer order placement, cart checkout, and order tracking. |

## Testing & Linting

Frontend tests run in a `jsdom` simulated browser environment using Vitest and React Testing Library:

```bash
# Run all frontend tests
npm run test --workspace=frontend

# Run ESLint rules
npm run lint --workspace=frontend
```
