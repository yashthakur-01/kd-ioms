# KD-IOMS Project State & Progress Tracking

**Milestone:** v1.0.0 Baseline MVP  
**Current Phase:** Phase 11 (Hardening and Go-Live) — ✅ COMPLETED (6 Waves)  
**Active Development Branch:** `dev1`  
**Team Branches:** `main`, `dev1`, `dev2`, `dev3`  
**Last Updated:** 2026-10-20  

---

## 1. Project Phase Status

| Phase | Phase Name | Status | Lead / Owner | Gate / Next Step |
| :---: | :--- | :--- :| :---: | :--- |
| **0** | **Foundation** | ✅ COMPLETED | Shared (Lead: `dev1`) | Foundation verified across 5 plans (23 tests pass, CI green) |
| **1** | **Auth and Users** | ✅ COMPLETED | `dev1` | Verified across 6 waves (60 tests pass, lint & build clean) |
| **2** | **Retailer Onboarding** | ✅ COMPLETED | `dev3` | Merged from main! Verified (KYC submission, admin queue, approval gate) |
| **3** | **Medicines and Salts** | ✅ COMPLETED | `dev2` | Verified across 6 waves (90 tests pass, sync trigger live, lint & build clean) |
| **4** | **Stock Inward and Batches** | ✅ COMPLETED | `dev1` | Verified across 6 waves (138 tests pass, ledger integrity, scan heuristics, lint & build clean) |
| **5** | **Catalog and Availability** | ✅ COMPLETED | `dev2` | Verified across 6 waves (217 tests pass, dynamic availability, live cart, lint & build clean) |
| **6** | **Order Placement and Cancel** | ✅ COMPLETED | `dev2` | Verified across 6 waves (262 tests pass, concurrency locking, idempotency replay, shortage resolution, clean build) |
| **7** | **Approval and Picking** | ✅ COMPLETED | `dev1` | Verified across 6 waves (242 backend tests + 91 frontend tests pass, clean build & lint, scan heuristics live) |
| **8** | **Delivery, Refusal & Proof** | ✅ COMPLETED | `dev2` | Verified across 6 waves (265 backend tests + 107 frontend tests pass, clean build & lint, storage & camera live) |
| **9** | **Invoice and Notifications** | ✅ COMPLETED | `dev3` | Verified across 6 waves (285 backend + 111 frontend tests pass, clean build & lint, FY sequence, PDFKit engine, cascade notifications live) |
| **10**| **Expiry, Settings & Dashboard**| ✅ COMPLETED | `dev3` | Verified across 6 waves (158 backend + 47 frontend tests pass, lifecycle tested, clean build) |
| **11**| **Hardening and Go-Live** | ✅ COMPLETED | Shared (Lead: `dev1`) | Verified across 6 waves: Helmet security, search rate limits, OWASP audit, query profiling, automated backup/restore, master CSV import, Playwright E2E suite, OpenAPI 3.0 spec, operations guides, runbook, 100% test pass rate (416 tests passing), clean build. |

---

## 2. Key Architecture Decisions Log

| Decision ID | Area | Decision Summary | Source Reference |
| :---: | :--- | :--- | :--- |
| **ADR-001** | Stack | Express.js for backend; Next.js (App Router) for frontend. | `tech.md` Section 2–4 |
| **ADR-002** | Database | PostgreSQL via `pg` connection pool with raw SQL & transactions. | `tech.md` Section 2.8 |
| **ADR-003** | Inventory | Single entrypoint for stock quantity changes via `applyLedgerEntry`. Direct updates banned. | `tech.md` Section 2.8, 9.2 |
| **ADR-004** | Deadlocks | Ascending primary-key ordering for multi-row locks (`lockMedicines`, `lockBatches`). | `tech.md` Section 2.8 |
| **ADR-005** | Envelope | Standard envelope `{ success, code, message, data, meta }` on all responses. | `tech.md` Section 2.1 |
| **ADR-006** | Money | Numeric(12,2) in DB, integer paise in memory via `utils/money.js`, strings in JSON. | `tech.md` Section 2.9 |
| **ADR-007** | Team | 4 git branches (`main`, `dev1`, `dev2`, `dev3`). Shared foundation (`Phase 0`) & integration (`Phase 11`). | User directive |
| **ADR-008** | Language | Backend implemented in TypeScript (`.ts`) for end-to-end type safety. | Team decision |
| **ADR-009** | Migrations | Comprehensive `001_init.sql` schema baseline authored in Phase 0 containing all core schemas, views, and triggers. | Team decision |
| **ADR-010** | Security & Auth | 15-minute in-memory JWT access token; 7-day rotating HttpOnly cookie refresh token (SHA-256 hashed in `auth_sessions`). Replay revokes all sessions. | `tech.md` Section 6.1 |
| **ADR-011** | Passwords | Memorable passphrase format (`Word-Word-Digits`) for single-view temporary passwords. Mandatory change on first login. Current session preserved on change. | `tech.md` Section 6.2 |
| **ADR-012** | Brute-Force | 5 consecutive failed logins trigger 15-minute lockout (`AUTH_ACCOUNT_LOCKED`). Timing-attack resistant dummy hash verification for non-existent users. | `tech.md` Section 6.1 |
| **ADR-013** | Salt Deduplication | Trigram similarity matching (`pg_trgm` score > 0.5) flags near-matches with `SALT_SIMILAR_EXISTS` (409) unless `confirmSimilar: true`. Exact duplicate blocked with `DUPLICATE_RESOURCE` (409). | `tech.md` Section 8.2 |
| **ADR-014** | Rename Sync & Medicine Uniqueness | Migration `002_salt_rename_trigger.sql` introduces an `AFTER UPDATE OF salt_name ON salts` trigger to automatically synchronize `salts_text` on linked medicines; case-insensitive unique index enforces deduplication on `medicines(LOWER(TRIM(name)), LOWER(TRIM(company)), LOWER(TRIM(pack_size)))`. | User alignment |
| **ADR-015** | Medicine Invariants & Price Protection | Medicines enforce 0–10 active salt IDs. Modification of `gstRate` is rejected with 422 `PRICE_EXCEEDS_MRP` if any existing batch selling price with the new GST rate exceeds its MRP. | `tech.md` Section 8.3 |
| **ADR-016** | Append-Only Stock Ledger | `applyLedgerEntry` is the sole modifier of `batches.quantity_on_hand` with row-level locks (`FOR UPDATE`), delta sign enforcement per movement type, non-negative stock balance invariant (`INSUFFICIENT_STOCK` 422), and atomic `stock_ledger_entries` audit trail. | `tech.md` Section 9.2 |
| **ADR-017** | GS1 Barcode & Packing OCR Parsing | `parseGs1` handles AI(01), AI(10), AI(17), AI(21), and raw GTIN fallbacks with day 00 month-end conversion. Packaging OCR text heuristics (`parsePackText`) extract batch, expiry, and MRP candidates for interactive pre-population. | `tech.md` Section 9.1 |
| **ADR-018** | Stock Inward & Batch Top-Up Invariants | Batch identity matched by `(medicine_id, batch_number, expiry_date, mrp)`. Expiry dates in past rejected with 422 `EXPIRY_IN_PAST`. Selling price inclusive of GST cannot exceed MRP (`PRICE_EXCEEDS_MRP` 422). GTINs cannot be assigned across differing medicines (`BATCH_MEDICINE_MISMATCH` 422). Expiry write-offs on unexpired batches rejected with 409 `INVALID_STATE_TRANSITION`. | `tech.md` Section 9.1, 9.3 |
| **ADR-019** | Dynamic Sellable Availability | Availability computed on read: `GREATEST(0, sellable_qty - reserved_qty)` where sellable includes ACTIVE batches with `expiry_date >= today_ist()` and `quantity_on_hand > 0`, and reserved aggregates `requested_quantity` from `PLACED` orders. | `tech.md` Section 10.1, 10.3 |
| **ADR-020** | Price Ceilings & Information Masking | `maxMrp` is highest MRP and `maxPriceInclGst` is highest selling price × (1 + GST) among sellable batches with stock. If no sellable stock, both are `null` and `inStock` is `false`. Retailers never see batch numbers, individual batch quantities, purchase rates, or expiry dates. | `tech.md` Section 10.2, 10.3 |
| **ADR-021** | Database Catalog Views & Trigram Search | Migration `003_catalog_views.sql` updates `v_medicine_availability` and `v_catalog` to project `salts_text` and `salt_ids`, with GIN trigram indexes on `medicines` and compound index on `batches(medicine_id, status, expiry_date, quantity_on_hand)`. | Team alignment |
| **ADR-022** | Retailer Gating & Local Cart Persistence | `requireApprovedRetailer` rejects unapproved retailers with 403 `RETAILER_NOT_APPROVED`. Client cart persisted per user in `localStorage` (`kd_cart_${userId}`) with sticky floating summary bar and quantity steppers clamped to live availability. | User alignment |
| **ADR-023** | Idempotency Key & Request Hash Protection | `Idempotency-Key` (UUID) with SHA-256 payload hash stored in `idempotency_keys` (`key, user_id, request_hash, response, created_at`). Identical requests replay cached 200 response (`X-Idempotent-Replay: true`); mismatched body with same key rejects with 409 `IDEMPOTENCY_KEY_REUSED`. Permanent retention for completed order auditability. | User alignment / `tech.md` 11.1 |
| **ADR-024** | Ascending Row Locking & Concurrency Reservation | In a single transaction, `lockMedicines(client, medicineIds)` locks medicine IDs in ascending numeric order. Availability recomputed against sellable on-hand stock minus `PLACED` reservations. If requested > available, rolls back and throws 409 `INSUFFICIENT_STOCK` with itemized shortage details. | `tech.md` 11.4, 2.8 |
| **ADR-025** | Catalog Price Ceiling Validation & Stale Quote Rejection | Each item's `quotedPriceInclGst` is compared with current catalog `max_price_incl_gst`. If quote < catalog maximum, transaction aborts with 409 `PRICE_CHANGED`. | `tech.md` 11.3, 11.4 |
| **ADR-026** | Strict Order State Machine & Retailer Cancellation Invariant | State transitions governed by `assertTransition(from, to)`. Retailer may only cancel their own order while `PLACED` (throws 409 `INVALID_STATE_TRANSITION` once approved/claimed). Cancelling releases reservation immediately. Tenant isolation enforces 404 `NOT_FOUND` on cross-retailer order queries. | `tech.md` 11.2, 11.3 |
| **ADR-027** | FEFO Auto-Suggestion | `allocationService.suggest` queries active, unexpired batches sorted `expiry_date ASC, batch_id ASC` where `effectivePrice <= quotedPriceInclGst`, computing recommended `suggestedQty` across eligible batches up to `requested_quantity`. | User Alignment / `tech.md` 12.2 |
| **ADR-028** | Ascending Batch Locking | To avoid database deadlocks during pick approvals, all batch IDs in `picks` are deduplicated, sorted ascending, and locked via `lockBatches(client, sortedBatchIds)` (`FOR UPDATE`). | `tech.md` 2.8, 12.3 |
| **ADR-029** | Single-Source Inventory Reduction | Batch quantity decrements occur EXCLUSIVELY via `applyLedgerEntry` with type `OUTWARD` (negative delta), recording `order_id` and `order_item_id` in `stock_ledger_entries`. Direct `UPDATE batches` is strictly prohibited. | `tech.md` 9.2, 12.3 |
| **ADR-030** | Drop-Shortfall Partial Fulfillment | If admin picks less than requested quantity, line item status is set to `PARTIAL` (or `NONE`), and unallocated quantity is dropped without creating backorders. If all lines have 0 picks, approve is rejected with 400 `VALIDATION_ERROR`. | `tech.md` 12.1, 12.2 |
| **ADR-031** | Unclaimed Order Restock Invariant | Admin can reject an `APPROVED` order only if `delivery_partner_id IS NULL`. Rejection triggers `applyLedgerEntry` with `RESTOCK` (+quantity) per allocation, restoring original batch balances. | `tech.md` 12.2, 12.3 |
| **ADR-032** | Scan-to-Pick Interaction | Barcode scans match via `parseGs1` and `resolveScan`. Matching a batch automatically fills or increments its picked quantity by 1, with an audible audio tone and emerald visual highlight. | User Alignment |
| **ADR-033** | Atomic Pool Claim | Delivery claim uses atomic conditional update: `UPDATE orders SET status = 'OUT_FOR_DELIVERY', delivery_partner_id = $1, claimed_at = NOW() WHERE order_id = $2 AND status = 'APPROVED' AND delivery_partner_id IS NULL RETURNING *`. If zero rows updated, checks order existence and returns 409 `ORDER_ALREADY_CLAIMED` or 409 `INVALID_STATE_TRANSITION`. | `tech.md` 13.2, 13.3 |
| **ADR-034** | Whole-Line Doorstep Refusal | Refusal is whole-line only: either the entire picked quantity of an item is accepted or all of it is refused. No partial line refusal and no post-delivery returns. Refused items require a 3–200 character reason. | `tech.md` 13.3 |
| **ADR-035** | Append-Only Stock Return | Every refused line item triggers `applyLedgerEntry` with `type = 'RETURN_IN'` (+delta) for each allocation in `order_allocations`, restoring `batches.quantity_on_hand` with order/item audit links. Direct SQL updates to batches remain strictly banned. | `tech.md` 9.2, 13.3 |
| **ADR-036** | Delivery Photo & Failure Atomicity | Delivery photo upload (max 5MB, JPEG/PNG/WebP) is performed via Supabase Storage (with local filesystem fallback when cloud credentials are not set). If photo upload fails, request aborts with 502 `EXTERNAL_SERVICE_ERROR` before database transaction begins, leaving order and inventory untouched. | User Alignment / `tech.md` 13.1, 13.3 |
| **ADR-037** | Delivery Partner Release & Admin Override | An order in `OUT_FOR_DELIVERY` can be returned to `APPROVED` in the pool via partner self-release (`POST /delivery/orders/:orderId/release`) or admin override (`POST /delivery/orders/:orderId/override`). State machine `ALLOWED_TRANSITIONS` updated to allow `OUT_FOR_DELIVERY -> APPROVED`. | User Alignment |
| **ADR-038** | Standardized Delivery Frontend Hierarchy | Frontend routes aligned with backend hierarchy: Dispatch Pool at `/delivery/pool`, My Deliveries at `/delivery/orders`, Delivery Checklist & Proof at `/delivery/orders/[orderId]`, and On-Behalf Order at `/delivery/orders/new`. `(delivery)/layout.tsx` `BottomNav` synchronized. | User Alignment |
| **ADR-039** | Fiscal Year Invoice Sequence | Invoices use Indian Fiscal Year format `INV/YYYY-YY/00001` (April 1 to March 31). Sequences are scoped per fiscal year in `document_sequences` (code `INV_YYYY-YY`), resetting to 1 on April 1st. Migration `005_invoice_sequences.sql` widens `document_sequences.code` to `VARCHAR(32)`. | User Alignment / `tech.md` 14.3 |
| **ADR-040** | Single GST & Rupee Round-Off | Invoices aggregate all line items into a single GST summary line. Total amount rounds half-up to the nearest integer rupee (`round_off = roundHalfUp(subtotal + gst) - (subtotal + gst)`). Invoices include strictly accepted lines; refused lines are excluded from invoicing. | `tech.md` 14.3, 2.9 |
| **ADR-041** | Decoupled Post-Commit Hook | Delivery transaction commits first. Then, `invoiceService.generate` executes post-commit and dispatches notifications asynchronously. Any failure during PDF compilation or message transport never invalidates or rolls back the delivery. | `tech.md` 14.3, 14.4 |
| **ADR-042** | Cascade Notification & Fallback | Delivery triggers WhatsApp template message first. If WhatsApp fails, status is marked `FAILED` with provider error, an `EMAIL` attempt is created immediately, and sent via Nodemailer. A background worker retries open rows up to 3 attempts. Admin can trigger immediate resend via `POST /invoices/:invoiceId/resend`. | `tech.md` 14.3, 14.4 |
| **ADR-043** | Private Storage & Signed URLs | Invoice PDFs are stored in private Supabase Storage (`invoices` bucket) with local filesystem fallback (`uploads/invoices`). Files are never publicly readable; clients obtain temporary signed URLs (300s TTL) with strict tenant ownership validation. | `tech.md` 14.2, ADR-036 |
| **ADR-044** | Security | Incorporate `helmet` middleware in backend Express application pipeline for strict security headers; enforce scoped cookies and strict CORS origin. | `tech.md` Section 16.1 |
| **ADR-045** | Rate Limiting | Introduce dedicated `searchScanLimiter` (60 req/min) for search (`/salts/suggest`, `/medicines`) and scan resolution endpoints (`/stock/scan/resolve`, `/batches/resolve-scan`), preventing brute-force OCR and inventory probing. | User Alignment / `tech.md` 16.1 |
| **ADR-046** | Query Profiling | Database query profiling harness using `EXPLAIN (ANALYZE, BUFFERS)` to validate catalog, order list, and allocation latency budgets on representative data sizes. | `tech.md` Section 16.1 |
| **ADR-047** | Backup & Recovery | Standalone TypeScript backup tool using `pg_dump` wrapper with environment-based configuration, SHA-256 checksum generation, and documented dry-run restore validation. | `tech.md` Section 16.1 |
| **ADR-048** | Master Data Import | Two-stage CSV import workflow (`import-salts.ts` then `import-medicines.ts`) with mandatory `--dry-run` inspection, header validation, and transaction rollbacks on syntax or constraint errors. | User Alignment / `tech.md` 16.1 |
| **ADR-049** | End-to-End Testing | Full browser Playwright scenario exercising complete operational loop across all user roles (`ADMIN`, `RETAILER`, `DELIVERY`) against live local server processes. | User Alignment / `tech.md` 16.1, 17 |
| **ADR-050** | API Schema Spec | Generate canonical OpenAPI 3.0 specification in `docs/openapi.yaml` mapping all request parameters, Zod validation schemas, response envelopes, and error codes. | User Alignment / `tech.md` 16.1 |

---

## 3. Immediate Next Actions
 
1. **Milestone v1.0.0 Ready**: All 12 project phases (Phase 0 through Phase 11) have been fully executed, tested, and verified.
2. Complete test suite passes with 100% green rate: 75 test files, 416 unit/integration tests passing, 0 errors.
3. Monorepo builds cleanly: backend (`tsc`) and frontend (`next build` with Turbopack) generate complete production bundles.
4. Next recommended action: Run milestone audit or merge `dev1` to `main` for release packaging.


