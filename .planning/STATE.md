# KD-IOMS Project State & Progress Tracking

**Milestone:** v1.0.0 Baseline MVP  
**Current Phase:** Phase 0: Foundation (Awaiting Roadmap Approval)  
**Active Development Branch:** `dev1`  
**Team Branches:** `main`, `dev1`, `dev2`, `dev3`  
**Last Updated:** 2026-10-18  

---

## 1. Project Phase Status

| Phase | Phase Name | Status | Lead / Owner | Gate / Next Step |
| :---: | :--- | :---: | :---: | :--- |
| **0** | **Foundation** | ⏳ PENDING APPROVAL | Shared (Lead: `dev1`) | Awaiting roadmap approval before scaffolding code |
| **1** | **Auth and Users** | ⏸️ BLOCKED | `dev1` | Blocked on Phase 0 completion |
| **2** | **Retailer Onboarding** | ⏸️ BLOCKED | `dev3` | Blocked on Phase 1 completion (Parallel with Phase 3) |
| **3** | **Medicines and Salts** | ⏸️ BLOCKED | `dev2` | Blocked on Phase 1 completion (Parallel with Phase 2) |
| **4** | **Stock Inward and Batches** | ⏸️ BLOCKED | `dev1` | Blocked on Phase 3 completion |
| **5** | **Catalog and Availability** | ⏸️ BLOCKED | `dev2` | Blocked on Phase 4 & Phase 2 completion |
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

---

## 3. Immediate Next Actions

1. Review proposed developer mappings (`dev1`, `dev2`, `dev3`) and roadmap with the team.
2. Obtain approval on technical decisions and open questions before starting Phase 0 code.
3. Once approved, initiate execution of **Phase 0: Foundation** on branch `dev1`.
