# Phase 11 Context: Hardening, Reliability and Go-Live

**Phase:** Phase 11 — Hardening, Reliability and Go-Live  
**Responsible Developer:** Shared Integration (Lead: `dev1`, Reviewers/Integration: `dev2`, `dev3`)  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 11`)  
**Primary Source:** [`tech.md`](file:///d:/coding/Projects/kd-ioms/tech.md) Section 16, Section 2.1, Section 2.8, Section 2.9, Section 17, and [`ROADMAP.md`](file:///d:/coding/Projects/kd-ioms/.planning/ROADMAP.md) Phase 11  

---

## 1. Phase Objective & Boundary

Prepare the complete KD-IOMS system for production readiness, operational stability, and go-live deployment. This phase ensures the application is secure against standard API vulnerability vectors, verified under realistic database queries, observable through structured telemetry and health probes, equipped with disaster recovery tools and CSV import utilities, and thoroughly tested end-to-end via browser automation:

1. **Security & OWASP API Top 10 Hardening:**
   - Integrate `helmet` in Express backend for strict HTTP security headers (CSP, HSTS, X-Content-Type-Options, etc.).
   - Verify strict CORS policies (same-origin only in production).
   - Enforce cookie security flags: `HttpOnly`, `Secure`, `SameSite=Lax/Strict`, scoped path `/api/v1/auth`.
   - Audit all routes to confirm that authentication (`authenticate`) and authorization (`authorize`, `requireApprovedRetailer`, `requirePasswordChanged`) cannot be bypassed, and that no endpoint leaks tenant data.
   - Refine sliding-window rate limiters:
     - `loginLimiter`: 10 attempts per 15 minutes per IP and username.
     - `generalLimiter`: 300 requests per minute per user/IP.
     - `searchScanLimiter`: 60 requests per minute on scan and fuzzy search endpoints.
   - Author OWASP API Top 10 compliance audit checklist with verified evidence.

2. **Database Performance & Query Profiling:**
   - Profile critical high-traffic and complex queries using `EXPLAIN ANALYZE`:
     - Dynamic catalog view (`v_catalog`, `v_medicine_availability`).
     - Order review and tenant-isolated order listing queries.
     - FEFO pick suggestion queries with composite ordering (`expiry_date ASC, batch_id ASC`).
   - Verify query execution latency targets: p95 under 300ms for catalog reads, under 500ms for order approvals.
   - Verify and tune compound indexes (`batches(medicine_id, status, expiry_date, quantity_on_hand)`, trigram GIN indexes on `salts` and `medicines`).

3. **Disaster Recovery & Database Backups:**
   - Implement automated database backup utility script (`scripts/backup-db.ts`) with timestamped dump management and compression.
   - Document and rehearse database restore procedure into an isolated, empty PostgreSQL instance.
   - Provide signed verification of successful restore rehearsal.

4. **Observability, Reliability & Render Keep-Warm:**
   - Health probe enhancement (`/api/v1/health`) with detailed pool diagnostics and uptime metrics.
   - Render cold-start keep-warm ping mechanism to prevent free-tier spin-down during operating hours.
   - Verify end-to-end trace correlation: user error toast display of `requestId` resolves to matching Pino JSON log line within 60 seconds.
   - Implement graceful process shutdown hooks (`SIGTERM`, `SIGINT`) in `backend/src/server.ts` to release database pool connections and finish in-flight requests cleanly.

5. **Master Data CSV Migration Scripts:**
   - Implement two-stage CSV import utilities with `--dry-run` and live modes:
     - `scripts/import-salts.ts`: Validates and bulk-upserts salt formulations with phonetic similarity checks.
     - `scripts/import-medicines.ts`: Validates medicine master records, links to salts, and verifies packaging specifications.
   - Execute imports within atomic transactions; report parsed counts, duplicates, validation failures, and inserts.

6. **Full-Lifecycle Playwright End-to-End Suite:**
   - Configure Playwright in `frontend/playwright.config.ts`.
   - Implement complete browser E2E test suite (`frontend/e2e/order-lifecycle.spec.ts`) validating the full business scenario on a clean database:
     1. Admin logs in and creates/approves a Retailer account.
     2. Admin performs stock inwarding of batches.
     3. Retailer logs in, browses catalog, adds medicines to cart, and places an order.
     4. Admin inspects order, runs FEFO pick suggestions, scans/confirms batches, and approves.
     5. Delivery partner claims order from dispatch pool and starts delivery.
     6. Delivery partner completes doorstep delivery with photo proof and a whole-line refusal.
     7. Verifies stock return ledger entry and automated invoice generation.

7. **Documentation & Release Artifacts:**
   - Generate canonical OpenAPI 3.0 specification (`docs/openapi.yaml`) covering all `/api/v1` endpoints.
   - Author Administrator Operating Manual (`docs/ADMIN-GUIDE.md`).
   - Author Delivery Partner Mobile/Web Guide (`docs/DELIVERY-GUIDE.md`).
   - Production Go-Live checklist and secrets rotation runbook (`docs/RUNBOOK.md`).

---

## 2. Key Architecture Decisions Log

| Decision ID | Area | Decision Summary | Source Reference |
| :---: | :--- | :--- | :--- |
| **ADR-044** | Security | Incorporate `helmet` middleware in backend Express application pipeline for strict security headers; enforce scoped cookies and strict CORS origin. | `tech.md` Section 16.1 |
| **ADR-045** | Rate Limiting | Introduce dedicated `searchScanLimiter` (60 req/min) for search (`/salts/suggest`, `/medicines`) and scan resolution endpoints (`/stock/scan/resolve`, `/batches/resolve-scan`), preventing brute-force OCR and inventory probing. | User Alignment / `tech.md` 16.1 |
| **ADR-046** | Query Profiling | Database query profiling harness using `EXPLAIN (ANALYZE, BUFFERS)` to validate catalog, order list, and allocation latency budgets on representative data sizes. | `tech.md` Section 16.1 |
| **ADR-047** | Backup & Recovery | Standalone TypeScript backup tool using `pg_dump` wrapper with environment-based configuration, SHA-256 checksum generation, and documented dry-run restore validation. | `tech.md` Section 16.1 |
| **ADR-048** | Master Data Import | Two-stage CSV import workflow (`import-salts.ts` then `import-medicines.ts`) with mandatory `--dry-run` inspection, header validation, and transaction rollbacks on syntax or constraint errors. | User Alignment / `tech.md` 16.1 |
| **ADR-049** | End-to-End Testing | Full browser Playwright scenario exercising complete operational loop across all user roles (`ADMIN`, `RETAILER`, `DELIVERY`) against live local server processes. | User Alignment / `tech.md` 16.1, 17 |
| **ADR-050** | API Schema Spec | Generate canonical OpenAPI 3.0 specification in `docs/openapi.yaml` mapping all request parameters, Zod validation schemas, response envelopes, and error codes. | User Alignment / `tech.md` 16.1 |

---

## 3. Work Items Breakdown & Wave Mapping

Phase 11 will be planned and executed across sequential waves:

- **Wave 11-01: Security Hardening & Rate Limiting**
  - Install `helmet` and configure secure HTTP headers.
  - Add `searchScanLimiter` (60 req/min) and refine login/write limiters.
  - Implement route authentication/authorization audit test suite.
  - Author OWASP API Top 10 compliance document with verification test evidence.

- **Wave 11-02: Performance Profiling & Query Optimization**
  - Implement profiling runner for `v_catalog`, order listing, and pick suggestion queries.
  - Run `EXPLAIN ANALYZE` and document query execution plans and index utilization.
  - Tune indexes or query constraints if latency exceeds p95 thresholds (300ms / 500ms).

- **Wave 11-03: Disaster Recovery & Observability**
  - Implement `backend/src/scripts/backup-db.ts` for database backups with checksums.
  - Create restore rehearsal verification test and runbook.
  - Enhance `/api/v1/health` with pool metrics and cold-start keep-warm ping client.
  - Ensure graceful shutdown (`SIGTERM`/`SIGINT`) in Express server.

- **Wave 11-04: Master Data CSV Import Utilities**
  - Implement `backend/src/scripts/import-salts.ts` with `--dry-run` support.
  - Implement `backend/src/scripts/import-medicines.ts` with `--dry-run` support.
  - Add sample CSV templates in `backend/data/`.
  - Unit and integration tests for CSV parsing and error handling.

- **Wave 11-05: Playwright End-to-End Test Suite**
  - Install and configure Playwright (`frontend/playwright.config.ts`).
  - Implement full order journey E2E test (`frontend/e2e/order-lifecycle.spec.ts`).
  - Add npm script `npm run test:e2e` and verify clean execution in CI.

- **Wave 11-06: OpenAPI Specification, Operations Guides & Go-Live Checklist**
  - Generate canonical OpenAPI 3.0 specification (`docs/openapi.yaml`).
  - Author `docs/ADMIN-GUIDE.md` and `docs/DELIVERY-GUIDE.md`.
  - Author production operations runbook and signed Go-Live checklist (`docs/RUNBOOK.md`).
  - Final full-suite verification (lint, typecheck, unit tests, integration tests, E2E tests).

---

## 4. Success & Exit Criteria

1. **Security**: Helmet enabled, OWASP API Top 10 compliance checklist verified, rate limiters active on login, general, and search/scan endpoints.
2. **Performance**: Catalog, orders, and pick suggestion queries pass profiling with p95 latencies within target budgets.
3. **Disaster Recovery**: Automated backup tool works, restore rehearsal validated into clean database.
4. **Data Entry**: Master data CSV import tools tested with `--dry-run` and live modes on sample data.
5. **E2E Automation**: Complete Playwright browser test passes from retailer onboarding through delivery and invoice generation.
6. **Documentation**: OpenAPI 3.0 specification, Admin guide, Delivery guide, and Go-Live runbook committed in `docs/`.
7. **CI Integrity**: All linting (`tsc`, `eslint`), unit/integration tests (396+ tests), and E2E tests pass cleanly.
