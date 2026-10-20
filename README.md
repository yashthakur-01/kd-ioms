<!-- generated-by: gsd-doc-writer -->
# KD-IOMS (KD Inventory & Order Management System)

A high-reliability B2B pharmaceutical wholesale distribution and inventory order management system designed for pharmaceutical distributors, retailers, and delivery personnel.

## Overview

KD-IOMS manages end-to-end pharmaceutical wholesale operations, featuring strict FEFO (First-Expired, First-Out) stock allocation, an append-only immutable stock ledger, real-time catalog pricing and discounts, batch tracking with expiry enforcement, order workflows, proof-of-delivery tracking, and automated PDF tax invoice generation.

## Installation

KD-IOMS is structured as an npm workspaces monorepo containing a TypeScript Express backend and a Next.js App Router frontend.

### Prerequisites

- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **PostgreSQL**: `>= 15.0` (Local or hosted on Supabase)

### Install Dependencies

From the repository root, install dependencies for all workspaces:

```bash
npm install
```

## Quick Start

Follow these steps to set up and run KD-IOMS locally:

1. **Configure Environment Variables**:
   Copy the backend example environment file and configure your database connection:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. **Run Database Migrations**:
   Apply database schema migrations to your PostgreSQL database:
   ```bash
   npm run db:migrate
   ```

3. **Seed Initial Administrator**:
   Create the primary administrator account:
   ```bash
   npm run seed:admin
   ```

4. **Start Development Servers**:
   Launch both backend (port 5000) and frontend (port 3000) concurrently:
   ```bash
   npm run dev
   ```

Once started:
- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000/api/v1](http://localhost:5000/api/v1)
- **Health Check**: [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

## Usage Examples

### 1. Checking System Health

Verify backend database connectivity and operational status:

```bash
curl -s http://localhost:5000/api/v1/health | jq
```

Response:
```json
{
  "success": true,
  "code": "HEALTH_OK",
  "message": "Service healthy",
  "data": {
    "status": "pass",
    "uptimeSeconds": 142.5,
    "database": "connected"
  },
  "meta": {
    "requestId": "req-1729428000000-abcdef",
    "timestamp": "2026-10-20T12:00:00.000Z"
  }
}
```

### 2. User Authentication

Authenticate with administrator or staff credentials:

```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "Admin@KD2026!"}'
```

### 3. Running Workspace-Specific Tasks

Run tasks for specific workspaces using root workspace proxies:

```bash
# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend

# Typecheck backend and lint frontend
npm run lint

# Synchronize TypeScript enums between backend and frontend
npm run sync-enums:check
```

## Documentation

Detailed documentation is available in the `docs/` directory:

- [System Architecture](docs/ARCHITECTURE.md) — Technical overview, component diagrams, invariants, and data flows.
- [Getting Started Guide](docs/GETTING-STARTED.md) — Step-by-step developer onboarding and environment configuration.
- [Development Workflow](docs/DEVELOPMENT.md) — Monorepo scripts, coding conventions, and PR processes.
- [Configuration Reference](docs/CONFIGURATION.md) — Complete environment variable reference and runtime flags.
- [API Reference](docs/API.md) — HTTP API endpoints, request/response formats, authentication, and error codes.
- [Testing Guide](docs/TESTING.md) — Vitest suites, unit and integration testing patterns, and CI setup.
- [Deployment Guide](docs/DEPLOYMENT.md) — Production architecture, Render and Vercel hosting, migrations, and rollbacks.

## Workspace Packages

- [backend](backend/README.md) — Node.js & Express REST API with raw SQL PostgreSQL transactions and Zod validation.
- [frontend](frontend/README.md) — Next.js 16 (App Router), React 19, Tailwind CSS, and TanStack Query web client.

## License

ISC License
