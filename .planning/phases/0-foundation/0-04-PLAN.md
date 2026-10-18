# Plan 0-04: Frontend Foundation, Design System, Providers & API Client

**Phase:** Phase 0 — Foundation  
**Plan ID:** `0-04`  
**Wave:** 3 (Frontend Foundation, parallel with Plan 0-03)  
**Dependencies:** Plan `0-01`  
**Responsible Developer:** **Shared Foundation (Lead: `dev1`)**  

---

## 1. Objective

Scaffold the Next.js frontend architecture: Next.js API rewrite proxy, typed API client parsing standard envelopes, error handling with requestId capture, TanStack Query and Toast providers, lightweight custom Tailwind CSS UI components, layout shells, and role-based route groups (`auth`, `admin`, `retailer`, `delivery`).

---

## 2. Tasks & Detailed Instructions

### Task 1: Next.js API Rewrite Proxy (`frontend/next.config.ts`)
- Configure `rewrites()` in `frontend/next.config.ts`:
  ```ts
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  }
  ```
- Ensures cookies are handled in a same-origin context from the browser.

### Task 2: Standard API Client & Error Mapping
- Create `frontend/src/lib/api/api-error.ts`:
  - `ApiError` class extending `Error`, storing `status`, `code`, `message`, `errors: Array<{ field?: string; code: string; message: string; details?: any }>`, `requestId`.
- Create `frontend/src/lib/api/error-messages.ts`:
  - Mapping from backend `UPPER_SNAKE` error codes to user-friendly Indian English messages.
- Create `frontend/src/lib/api/client.ts`:
  - `apiFetch(path: string, options?: RequestInit & { idempotencyKey?: string })`:
    - Prefixes `/api/v1`.
    - Injects Authorization Bearer header if token exists in memory.
    - Adds `Idempotency-Key` header when supplied.
    - Catches 401 with code `AUTH_TOKEN_EXPIRED`: triggers silent refresh once via `/auth/refresh` and replays the original request.
    - Parses JSON envelope; throws `ApiError` on `success: false` or HTTP >= 400.
    - Returns `json.data` and preserves `json.meta`.

### Task 3: Application Providers
- Create `frontend/src/providers/QueryProvider.tsx`:
  - Wraps children in `QueryClientProvider` from `@tanstack/react-query`.
  - Configures default query options: `staleTime: 30_000`, `refetchOnWindowFocus: false`, `retry: 1`.
- Create `frontend/src/providers/AuthProvider.tsx`:
  - Provides React context holding `user` (`id`, `username`, `role`), `accessToken` in memory, `login()`, `logout()`, `refresh()`.
- Create `frontend/src/providers/ToastProvider.tsx`:
  - Global toast notification queue (success, error, info).
  - On error toasts, automatically appends reference ID `Ref: <requestId>` for easy debugging and log correlation.
- Update `frontend/src/app/layout.tsx` wrapping the application in `QueryProvider`, `AuthProvider`, and `ToastProvider`.

### Task 4: Lightweight Custom Tailwind UI Components (`frontend/src/components/ui/`)
Implement clean, accessible UI components with native HTML semantics and Tailwind CSS utility tokens:
- `Button.tsx`: variants (`primary`, `secondary`, `danger`, `outline`, `ghost`), size tokens, loading spinner state, disabled states, minimum 44px touch target on mobile.
- `Input.tsx`: accessible text/number input with label, helper text, error message, and `aria-describedby` linkage.
- `Select.tsx`: styled native select with label and validation error.
- `Modal.tsx`: accessible dialog overlay with escape key dismissal, focus management, and confirm/cancel footer slots.
- `Table.tsx`: responsive data table with sticky headers, zebra stripes, and overflow container.
- `Badge.tsx`: status badges (`success`, `warning`, `danger`, `neutral`, `brand`).
- `Toast.tsx`: floating toast notification with dismiss button and reference ID display.
- `Spinner.tsx`: SVG animated loading spinner.
- `EmptyState.tsx`: clean illustration/icon placeholder with title, description, and action button.
- `Pagination.tsx`: page navigator with Previous/Next buttons and page numbers.
- `ConfirmDialog.tsx`: reusable confirmation dialog for destructive actions.
- `FormField.tsx`: wrapper component connecting label, children, and validation error.

### Task 5: Layout Shells & Feedback Components
- `frontend/src/components/layout/AppShell.tsx`: responsive page wrapper with header and mobile navigation.
- `frontend/src/components/layout/Sidebar.tsx`: desktop sidebar for admin with role-specific navigation links.
- `frontend/src/components/layout/BottomNav.tsx`: mobile bottom navigation bar (minimum 44px touch targets) for retailer and delivery roles.
- `frontend/src/components/layout/PageHeader.tsx`: standard page title with breadcrumbs and action button slot.
- `frontend/src/components/feedback/ErrorBanner.tsx`: alert banner displaying error message and reference ID.
- `frontend/src/components/feedback/FieldError.tsx`: field error text under form inputs.

### Task 6: Role Route Groups Scaffolding
Create initial page shells with role layout guards:
- `frontend/src/app/(auth)/login/page.tsx`: login page with username and password form.
- `frontend/src/app/(admin)/layout.tsx`: admin shell with `Sidebar`.
- `frontend/src/app/(admin)/dashboard/page.tsx`: placeholder admin dashboard.
- `frontend/src/app/(retailer)/layout.tsx`: retailer mobile shell with `BottomNav`.
- `frontend/src/app/(retailer)/catalog/page.tsx`: placeholder retailer catalog.
- `frontend/src/app/(delivery)/layout.tsx`: delivery mobile shell with `BottomNav`.
- `frontend/src/app/(delivery)/pool/page.tsx`: placeholder delivery pool.

### Task 7: Automated Tests
- `Button.test.tsx`: renders button, handles click events, displays loading spinner.
- `Modal.test.tsx`: renders modal dialog, closes on backdrop click and Escape key.
- `Toast.test.tsx`: renders toast notification, shows `Ref: <requestId>`.
- `client.test.ts`: parses standard response envelope and throws typed `ApiError`.

---

## 3. Verification & Acceptance Criteria

- [x] All frontend components and client tests pass via `npm test --workspace=frontend`.
- [x] Next.js build (`npm run build --workspace=frontend`) succeeds without TypeScript or ESLint errors.
- [x] Calling `/api/v1/health` from frontend code rewrites properly to backend and returns envelope.
- [x] Triggering an error displays the reference ID toast `Ref: <requestId>`.
