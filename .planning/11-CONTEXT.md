# Phase 11 Context: Hardening, Reliability and Go-Live

*See full context specifications in [`.planning/phases/11-hardening-go-live/11-CONTEXT.md`](file:///d:/coding/Projects/kd-ioms/.planning/phases/11-hardening-go-live/11-CONTEXT.md)*

### Summary of Locked Decisions:
- **E2E Automation (ADR-049):** Full-lifecycle browser Playwright suite (`frontend/e2e/order-lifecycle.spec.ts`) testing complete retail-to-delivery workflow: Onboard Retailer -> Approve -> Inward Stock -> Place Order -> FEFO Suggest & Pick -> Claim & Deliver with Refusal -> Verify Invoicing.
- **Security & OWASP (ADR-044):** Integration of `helmet` security headers, strict CORS, scoped cookie flags, and verified route authorization checks.
- **Rate Limiting (ADR-045):** Added `searchScanLimiter` (60 req/min) for search (`/salts/suggest`, `/medicines`) and scan resolution endpoints (`/stock/scan/resolve`, `/batches/resolve-scan`), plus refined login and write limiters.
- **Performance Profiling (ADR-046):** Query profiling with `EXPLAIN (ANALYZE, BUFFERS)` on catalog view, order review, and FEFO allocation queries; verifying p95 latencies (<300ms catalog, <500ms approval).
- **Disaster Recovery (ADR-047):** Standalone database backup utility script (`scripts/backup-db.ts`) with SHA-256 checksums and verified restore rehearsal into clean database.
- **Master Data CSV Import (ADR-048):** Two-stage CSV migration tools (`scripts/import-salts.ts` and `scripts/import-medicines.ts`) with strict `--dry-run` validation and atomic batch transactions.
- **OpenAPI 3.0 & Operations Guides (ADR-050):** Canonical OpenAPI 3.0 spec in `docs/openapi.yaml`, Admin user guide, Delivery guide, and Go-Live runbook.
