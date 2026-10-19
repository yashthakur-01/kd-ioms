# KD-IOMS Project State & Progress Tracking

**Milestone:** v1.0.0 Baseline MVP  
**Current Phase:** Phase 5 Completed; Phase 6 (Order Placement and Cancel) Unblocked  
**Active Development Branch:** `dev2`  
**Team Branches:** `main`, `dev1`, `dev2`, `dev3`  
**Last Updated:** 2026-10-19  

---

## 1. Project Phase Status

| Phase | Phase Name | Status | Lead / Owner | Gate / Next Step |
| :---: | :--- | :---: | :---: | :--- |
| **0** | **Foundation** | ✅ COMPLETED | Shared (Lead: `dev1`) | Foundation verified across 5 plans (23 tests pass, CI green) |
| **1** | **Auth and Users** | ✅ COMPLETED | `dev1` | Verified across 6 waves (60 tests pass, lint & build clean) |
| **2** | **Retailer Onboarding** | ✅ COMPLETED | `dev3` | Merged from main! Verified (KYC submission, admin queue, approval gate) |
| **3** | **Medicines and Salts** | ✅ COMPLETED | `dev2` | Verified across 6 waves (90 tests pass, sync trigger live, lint & build clean) |
| **4** | **Stock Inward and Batches** | ✅ COMPLETED | `dev1` | Verified across 6 waves (138 tests pass, ledger integrity, scan heuristics, lint & build clean) |
| **5** | **Catalog and Availability** | ✅ COMPLETED | `dev2` | Verified across 6 waves (217 tests pass, dynamic availability, live cart, lint & build clean) |
| **6** | **Order Placement and Cancel** | 🚀 READY | `dev2` | Unblocked on Phase 5 completion! Ready for dev2 |
| **7** | **Approval and Picking** | ⏸️ BLOCKED | `dev1` | Blocked on Phase 6 completion |
| **8** | **Delivery, Refusal & Proof** | ⏸️ BLOCKED | `dev2` | Blocked on Phase 7 completion |
| **9** | **Invoice and Notifications** | ⏸️ BLOCKED | `dev3` | Blocked on Phase 8 completion |
| **10**| **Expiry, Settings & Dashboard**| 🚀 READY | `dev3` | Unblocked on Phase 4 completion! Ready for dev3 |
| **11**| **Hardening and Go-Live** | ⏸️ BLOCKED | Shared (All Devs) | Blocked on Phases 0–10 completion |

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

---

## 3. Immediate Next Actions
 
1. Phase 5 executed, fully verified, and committed on `dev2`. Merge `dev2` into `main` (or sync into other dev branches).
2. `dev2` is unblocked to begin **Phase 6: Order Placement and Cancellation** (`/gsd-discuss-phase 6`) on branch `dev2`.
3. In parallel, `dev3` is unblocked to begin **Phase 10: Expiry, Settings & Dashboard** on branch `dev3`.

