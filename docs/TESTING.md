<!-- generated-by: gsd-doc-writer -->
# Testing Guide

This guide details the test architecture, test runners, execution commands, and testing best practices for KD-IOMS.

## Test Framework and Setup

KD-IOMS utilizes **Vitest** across both backend and frontend workspaces:

- **Backend**: Vitest (`^5.0.5`) running in Node.js environment with ESM support, TypeScript source execution, and Supertest (`^7.3.1`) for integration and HTTP assertions.
- **Frontend**: Vitest (`^3.2.7`) running in `jsdom` environment with React Testing Library (`@testing-library/react ^16.3.3`) and user-event utilities.

### Setup Requirements

No additional global test runners or external binaries are needed. Running `npm install` installs Vitest and all required test utilities. Backend tests interact with either mocked database pools or isolated test database instances.

## Running Tests

Execute tests from the project root or within specific workspaces:

### 1. Run All Tests (Root)

Run the entire test suite across all packages:

```bash
npm run test
```

### 2. Backend Tests Only

Run the backend unit, integration, and HTTP route test suites:

```bash
# Single execution run
npm run test:backend

# Or via workspace flag
npm run test --workspace=backend

# Watch mode for interactive TDD
npm run test:watch --workspace=backend
```

### 3. Frontend Tests Only

Run the frontend component and UI unit test suites:

```bash
# Single execution run
npm run test:frontend

# Or via workspace flag
npm run test --workspace=frontend
```

### 4. Running a Specific Test File or Pattern

Run an isolated test file using Vitest filters:

```bash
# Run backend order approval tests
npx vitest run backend/src/modules/order/__tests__/order.approval.integration.test.ts

# Run frontend alerts component tests
npx vitest run frontend/src/app/\(admin\)/alerts/__tests__/AlertsPage.test.tsx
```

## Writing New Tests

### File Naming Conventions

- **Backend Unit Tests**: Place under `__tests__/` directory adjacent to the unit being tested: `my-service.test.ts`.
- **Backend Integration Tests**: Suffix with `.integration.test.ts`: `order.approval.integration.test.ts`.
- **Frontend Component Tests**: Place under `__tests__/` directory adjacent to the component: `MyComponent.test.tsx`.

### Backend Testing Patterns

#### 1. Mocking the Database Client & Transaction Pool

When testing service logic in isolation from PostgreSQL, mock `pool.connect()` and transaction clients using Vitest mocks:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';
import * as db from '../../config/db.js';

describe('Order Service Tests', () => {
  let mockClient: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    vi.spyOn(db.pool, 'connect').mockResolvedValue(mockClient);
  });

  it('rolls back on error and releases connection', async () => {
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // BEGIN
      .mockRejectedValueOnce(new Error('DB failure')) // Failing query
      .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

    await expect(db.withTransaction(async (client) => {
      await client.query('FAILING QUERY');
    })).rejects.toThrow();

    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });
});
```

#### 2. Testing HTTP Endpoints with Supertest

Route integration tests mount the Express `app` instance directly through Supertest without opening external network ports:

```typescript
import request from 'supertest';
import { app } from '../app.js';
import { describe, it, expect } from 'vitest';

describe('GET /api/v1/health', () => {
  it('returns status 200 and health payload', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('pass');
  });
});
```

### Frontend Testing Patterns

Frontend tests render components using `@testing-library/react` and assert user interactions:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui/Button';
import { describe, it, expect, vi } from 'vitest';

describe('Button Component', () => {
  it('triggers onClick handler when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Submit</Button>);

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Coverage Requirements

KD-IOMS does not configure a hard failure threshold in CI, but targets high test coverage on critical operational paths:
- Financial, ledger, and stock inventory calculations require thorough unit and integration test coverage.
- State machine transitions (e.g. order approvals, cancellations, delivery failures) require branch coverage for both valid transitions and invalid rejection paths.

To generate an HTML and text coverage report locally:

```bash
npx vitest run --coverage
```

## CI Integration

Tests are executed automatically on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`).

The `verify` CI job runs on `ubuntu-latest` with `node-version: 20`:
1. `npm ci`
2. `npm run sync-enums:check` (verifies enums consistency)
3. `npm run lint --workspace=backend` (`tsc --noEmit`)
4. `npm run lint --workspace=frontend` (`eslint`)
5. `npm run test --workspace=backend` (`vitest run`)
6. `npm run test --workspace=frontend` (`vitest run`)

Pull requests cannot be merged if any test step fails in CI.
