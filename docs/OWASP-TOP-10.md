<!-- generated-by: gsd-doc-writer -->
# OWASP API Security Top 10 Compliance Audit

This document details the security posture, defensive countermeasures, and verified evidence for the KD-IOMS REST API against the **OWASP API Security Top 10 (2023)** standard.

---

## Compliance Overview

| OWASP Category | Vulnerability Risk | Status | KD-IOMS Defense Mechanism | Verified Evidence |
| :--- | :--- | :---: | :--- | :--- |
| **API1:2023** | Broken Object Level Authorization (BOLA) | **Protected** | Tenant-scoped database queries filter by authenticated user ID; retailers cannot access or query foreign orders or invoices. | `order.service.ts` tenant checks (`WHERE retailer_id = $1`); `backend/src/modules/order/__tests__/order.approval.integration.test.ts` |
| **API2:2023** | Broken Authentication | **Protected** | 15-minute HS256 JWT access tokens; SHA-256 hashed 7-day refresh tokens; automatic revocation of all sessions on token replay; 5 failed login lockout. | `backend/src/modules/auth/auth.service.ts`, `backend/src/middleware/authenticate.ts`, `tokens.ts` |
| **API3:2023** | Broken Object Property Level Authorization | **Protected** | Retailer responses mask sensitive internal fields (purchase rates, individual batch numbers, supplier details). Zod schemas strictly whitelist acceptable mutation payloads. | `v_catalog` view masking; `backend/src/modules/order/order.validation.ts` schema validation |
| **API4:2023** | Unrestricted Resource Consumption | **Protected** | Tiered sliding-window in-memory rate limiting: 10 attempts/15min login, 300 req/min general API, 60 req/min for search and barcode scanning; body size capped at 100kb. | `backend/src/middleware/rate-limit.ts`; `backend/src/modules/security/__tests__/security-hardening.test.ts` |
| **API5:2023** | Broken Function Level Authorization | **Protected** | Role-based middleware (`authorize(USER_ROLE.ADMIN)`) enforces strict privilege separation on administrative routes; `requirePasswordChanged` blocks unrotated staff accounts. | `backend/src/middleware/authorize.ts`; `security-hardening.test.ts` asserting 403 FORBIDDEN |
| **API6:2023** | Unrestricted Access to Sensitive Business Flows | **Protected** | Unique `Idempotency-Key` headers required on mutating order placements, stock inwarding, and deliveries to prevent duplicate financial execution or race conditions. | `backend/src/middleware/idempotency.ts`; `backend/src/middleware/__tests__/idempotency.test.ts` |
| **API7:2023** | Server Side Request Forgery (SSRF) | **Protected** | Outbound notification webhooks (WhatsApp Meta Graph API, SMTP) use fixed environment-configured endpoints; no user-supplied URLs are fetched by the backend server. | `backend/src/config/env.ts`; `backend/src/modules/notification/notification.service.ts` |
| **API8:2023** | Security Misconfiguration | **Protected** | `helmet` middleware sets secure HTTP headers (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`); strict same-origin CORS; HttpOnly scoped cookies (`Path=/api/v1/auth`). | `backend/src/app.ts`; `security-hardening.test.ts` |
| **API9:2023** | Improper Inventory Management | **Protected** | Unified `/api/v1` route prefixing; deprecated routes or undocumented endpoints are disabled; centralized 404 handler prevents endpoint probing. | `backend/src/routes/index.ts`; `backend/src/middleware/not-found.ts` |
| **API10:2023**| Unsafe Consumption of APIs | **Protected** | Inputs received from external services (Supabase Storage upload responses, Meta Cloud API payloads) are strictly validated with Zod before database insertion. | `backend/src/utils/storage.ts`; `backend/src/modules/invoice/invoice.service.ts` |

---

## Detailed Category Analysis & Verification

### 1. API1:2023 — Broken Object Level Authorization (BOLA)
- **Threat Vector**: A malicious retailer attempts to view another pharmacy's invoice (`GET /api/v1/invoices/:id`) or order (`GET /api/v1/orders/:id`).
- **Mitigation**: Every database query for retail entities includes an ownership predicate:
  ```sql
  SELECT * FROM orders WHERE order_id = $1 AND ($2 = 'ADMIN' OR retailer_id = $3);
  ```
- **Result**: Cross-tenant queries return 404 `NOT_FOUND` rather than exposing existence or leaking data.

### 2. API2:2023 — Broken Authentication
- **Threat Vector**: Credential stuffing, token theft, or brute-forcing administrative logins.
- **Mitigation**:
  - `loginLimiter` limits attempts to 10 per 15 minutes per IP.
  - 5 consecutive invalid passwords triggers an account lock (`AUTH_ACCOUNT_LOCKED`).
  - Refresh tokens are hashed using SHA-256 with a pepper (`REFRESH_TOKEN_PEPPER`) and stored in `auth_sessions`.
  - Detecting token reuse immediately revokes the entire user session hierarchy.

### 3. API3:2023 — Broken Object Property Level Authorization
- **Threat Vector**: Mass assignment attacks injecting elevated privileges (`role: "ADMIN"`) during user registration or patching.
- **Mitigation**:
  - Request validation schemas explicitly list allowed fields. Unexpected properties are stripped or rejected.
  - Inward cost prices and purchase rates are completely excluded from retailer catalog projections (`v_catalog`).

### 4. API4:2023 — Unrestricted Resource Consumption
- **Threat Vector**: Denial of Service (DoS) through heavy query spamming or oversized JSON payload uploads.
- **Mitigation**:
  - `express.json({ limit: '100kb' })` prevents memory exhaustion from huge POST bodies.
  - `generalLimiter` throttles at 300 requests/minute.
  - `searchScanLimiter` throttles heavy OCR and trigram search endpoints at 60 requests/minute.

### 5. API5:2023 — Broken Function Level Authorization
- **Threat Vector**: Retailer or delivery personnel calling admin-only endpoints (`/api/v1/stock/inward`, `/api/v1/users`).
- **Mitigation**:
  - Explicit middleware chains:
    ```typescript
    router.use(authenticate, authorize(USER_ROLE.ADMIN), requirePasswordChanged);
    ```
  - Unauthorized roles receive standard 403 `FORBIDDEN` error envelope without reaching controller logic.

### 6. API6:2023 — Unrestricted Access to Sensitive Business Flows
- **Threat Vector**: Rapidly resubmitting orders or delivery receipts to double-charge or duplicate inventory adjustments.
- **Mitigation**:
  - The `idempotency` middleware enforces unique `Idempotency-Key` tokens stored in `idempotency_keys` with SHA-256 payload hashes.
  - Duplicate requests replay cached responses with `X-Idempotent-Replay: true`.

### 7. API7:2023 — Server Side Request Forgery (SSRF)
- **Threat Vector**: Exploiting PDF invoice generators or webhooks to make requests to internal network services.
- **Mitigation**:
  - KD-IOMS does not accept remote image URLs or webhook endpoints from client input.
  - All communication targets predefined SaaS endpoints (`SUPABASE_URL`, Meta Cloud Graph API).

### 8. API8:2023 — Security Misconfiguration
- **Threat Vector**: Missing defensive HTTP headers, verbose stack traces in production responses, or open CORS policies.
- **Mitigation**:
  - `helmet` sets `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and DNS prefetch controls.
  - `errorHandlerMiddleware` strips internal stack traces from API responses, outputting standard error envelopes while logging full traces securely to server stdout.

### 9. API9:2023 — Improper Inventory Management
- **Threat Vector**: Forgotten shadow endpoints, old API versions, or exposed debug routes.
- **Mitigation**:
  - Centralized route registration under `/api/v1/`.
  - Unmatched endpoints trigger `notFoundMiddleware` returning standard `NOT_FOUND` envelopes.

### 10. API10:2023 — Unsafe Consumption of APIs
- **Threat Vector**: Malformed payloads or untrusted data returned from third-party storage or messaging APIs.
- **Mitigation**:
  - Response structures from external APIs (Supabase Storage, Nodemailer) are validated before status persistence.
  - Network timeouts and fallbacks ensure core database operations complete reliably.
