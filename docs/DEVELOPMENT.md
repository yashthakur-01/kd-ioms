<!-- generated-by: gsd-doc-writer -->
# Development Workflow

This document outlines the development lifecycle, repository scripts, coding standards, branch naming conventions, and pull request procedures for KD-IOMS.

## Local Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/kd-pharma/kd-ioms.git
   cd kd-ioms
   ```

2. **Install all dependencies across the monorepo**:
   ```bash
   npm install
   ```

3. **Configure local environment**:
   ```bash
   cp backend/.env.example backend/.env
   ```

4. **Initialize the local database**:
   ```bash
   npm run db:migrate
   npm run seed:admin
   ```

5. **Start development mode with hot reload**:
   ```bash
   npm run dev
   ```

## Build Commands

The root `package.json` provides unified scripts that execute across the monorepo workspaces:

| Command | Workspace | Description |
| :--- | :--- | :--- |
| `npm run dev` | Root | Starts both backend (`tsx watch`) and frontend (`next dev`) concurrently. |
| `npm run dev:backend` | Backend | Runs the Express API backend with live reloading on [http://localhost:5000](http://localhost:5000). |
| `npm run dev:frontend` | Frontend | Runs the Next.js development server on [http://localhost:3000](http://localhost:3000). |
| `npm run build` | Root | Compiles both backend TypeScript (`tsc`) and frontend Next.js production bundles. |
| `npm run build:backend` | Backend | Compiles backend TypeScript source into `backend/dist/`. |
| `npm run build:frontend` | Frontend | Builds the production Next.js application bundle. |
| `npm run test` | Root | Runs the complete Vitest test suite across backend and frontend workspaces. |
| `npm run test:backend` | Backend | Runs all backend unit and integration tests via Vitest. |
| `npm run test:frontend` | Frontend | Runs all frontend component tests via Vitest and jsdom. |
| `npm run lint` | Root | Runs backend TypeScript typechecking and frontend ESLint rules. |
| `npm run db:migrate` | Backend | Executes pending raw SQL database migrations in `backend/migrations/`. |
| `npm run seed:admin` | Backend | Creates or verifies the initial administrative superuser account in the database. |
| `npm run sync-enums` | Frontend | Copies backend TypeScript domain enums into `frontend/src/types/enums.ts`. |
| `npm run sync-enums:check`| Frontend | Verifies that frontend domain enums match backend source enums without drifting. |

## Code Style & Standards

KD-IOMS enforces consistent typing and style across all workspaces:

### Backend TypeScript Standards

- **Strict Type Checking**: Backend code must pass `tsc --noEmit` (`npm run lint --workspace=backend`) with zero type errors.
- **Explicit Returns**: All service functions and controller handlers should declare explicit return types.
- **Module Resolution**: All internal TypeScript imports must specify the `.js` extension (e.g. `import { pool } from '../config/db.js'`) to support native ECMAScript Modules (ESM).
- **Zod Validation**: All external HTTP input (route params, query strings, body payloads) must be validated using Zod schemas before being processed by controllers.

### Frontend Standards

- **Linting**: Next.js ESLint configuration (`eslint-config-next`) is enforced via `npm run lint --workspace=frontend`.
- **Enum Synchronization**: Frontend code must never define custom copies of domain enums (such as `ORDER_STATUS`, `USER_ROLE`, `PAYMENT_MODE`). Always run `npm run sync-enums` to pull backend enums directly.
- **React 19 & Tailwind**: Components use functional component patterns, React 19 hooks, and Tailwind CSS utility classes.

## Branch Conventions

The repository uses a structured branching strategy to support collaborative feature development:

- `main` — Production-ready branch. All releases and live deployments originate here.
- `dev1`, `dev2`, `dev3` — Workstream integration branches used by parallel development tracks.
- `feat/<topic>` or `fix/<topic>` — Feature and bugfix branches cut from active dev branches (e.g. `feat/batch-allocation`, `fix/login-rate-limit`).

When merging between development workstreams, rebase or fast-forward merge onto the target branch and run tests to ensure tree stability.

## Pull Request Process

All contributions submitted via pull request must satisfy the following checklist before merge:

1. **Verify Enum Synchronization**:
   ```bash
   npm run sync-enums:check
   ```
   If enums have changed, run `npm run sync-enums` and commit the updated `frontend/src/types/enums.ts`.

2. **Typecheck and Lint**:
   ```bash
   npm run lint
   ```
   Must pass with zero errors in both backend and frontend.

3. **Run Test Suites**:
   ```bash
   npm run test
   ```
   All backend integration tests and frontend component tests must pass cleanly.

4. **Database Migration Safety**:
   - New database schema changes must be added as sequential, idempotent SQL files in `backend/migrations/` (e.g. `006_feature_name.sql`).
   - Migrations must never drop existing production columns without backwards-compatible deprecation periods.

5. **CI Automation**:
   The GitHub Actions workflow (`.github/workflows/ci.yml`) must pass green on push or pull request to `main` or development branches.
