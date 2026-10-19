# KD-IOMS Project State & Progress Tracking

**Milestone:** v1.0.0 Baseline MVP  
**Current Phase:** Phase 2: Retailer Onboarding (✅ COMPLETED)  
**Active Development Branch:** `dev3`  
**Team Branches:** `main`, `dev1`, `dev2`, `dev3`  
**Last Updated:** 2026-10-19  

---

## 1. Project Phase Status

| Phase | Phase Name | Status | Lead / Owner | Gate / Next Step |
| :---: | :--- | :---: | :---: | :--- |
| **0** | **Foundation** | ✅ COMPLETED | Shared (Lead: `dev1`) | Foundation verified across 5 plans (23 tests pass, CI green) |
| **1** | **Auth and Users** | ✅ COMPLETED | `dev1` | Verified across 6 waves (60 tests pass, lint & build clean) |
| **2** | **Retailer Onboarding** | ✅ COMPLETED | `dev3` | Verified across 3 plans (98 tests pass, lint & build clean) |
| **3** | **Medicines and Salts** | 🚀 READY | `dev2` | Unblocked! Active parallel work on branch `dev2` (`/gsd-execute-phase 3`) |
| **4** | **Stock Inward and Batches** | ⏸️ BLOCKED | `dev1` | Blocked on Phase 3 completion (`dev1` next phase) |
| **5** | **Catalog and Availability** | ⏸️ BLOCKED | `dev2` | Blocked on Phase 4 & Phase 2 completion (Phase 2 complete!) |
| **6** | **Order Placement and Cancel** | ⏸️ BLOCKED | `dev2` | Blocked on Phase 5 completion |
| **7** | **Approval and Picking** | ⏸️ BLOCKED | `dev1` | Blocked on Phase 6 completion |
| **8** | **Delivery, Refusal & Proof** | ⏸️ BLOCKED | `dev2` | Blocked on Phase 7 completion |
| **9** | **Invoice and Notifications** | ⏸️ BLOCKED | `dev3` | Blocked on Phase 8 completion |
| **10**| **Expiry, Settings & Dashboard**| ⏸️ BLOCKED | `dev3` | Blocked on Phase 4 completion |
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
| **ADR-013** | Retailer KYC | Four-state KYC lifecycle (`UNSUBMITTED`, `PENDING`, `APPROVED`, `REJECTED`). Atomic state transitions, duplicate resource conflict mapping, route & navigation lock gating via `requireApprovedRetailer` middleware and UI lock badges. | `tech.md` Section 7 |

---

## 3. Immediate Next Actions

1. Commit and push Phase 2 deliverables on `dev3`.
2. Merge `dev3` into `main` (or keep branch ready for team rebase/integration).
3. `dev2` executes **Phase 3: Medicines and Salts** (`/gsd-execute-phase 3`).
4. `dev1` unblocks on Phase 3 completion to begin **Phase 4: Stock Inward and Batches**.
5. `dev3` will execute **Phase 10: Expiry, Settings & Dashboard** once Phase 4 is delivered.
