---
phase: 2
slug: retailer-onboarding
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-10-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 |
| **Config file** | `backend/package.json` (`vitest run`), `frontend/vitest.config.ts` |
| **Quick run command** | `npm run test:backend -- src/modules/retailer/` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:backend -- src/modules/retailer/` or frontend component test
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | FR-RET-01, FR-RET-02 | T-02-01 | Input sanitization & GSTIN/license validation | integration | `npm run test:backend -- src/modules/retailer/__tests__/retailer.integration.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | FR-RET-03 | T-02-02 | Direct edit refusal on APPROVED status | integration | `npm run test:backend -- src/modules/retailer/__tests__/retailer.integration.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 2 | FR-RET-04, FR-RET-05, FR-RET-06 | T-02-03 | Admin authorization & state transition guards | integration | `npm run test:backend -- src/modules/retailer/__tests__/retailer.integration.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 2 | FR-RET-07 | T-02-04 | 403 RETAILER_NOT_APPROVED middleware refusal | unit/integration | `npm run test:backend -- src/middleware/__tests__/require-approved-retailer.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 3 | FR-RET-01, FR-RET-02 | — | Form states (unsubmitted, pending, rejected, approved) | frontend unit | `npm run test:frontend -- src/features/retailer/__tests__/profile.test.tsx` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 3 | FR-RET-04, FR-RET-05, FR-RET-06 | — | Admin queue tabs, confirm modal, rejection preset | frontend unit | `npm run test:frontend -- src/features/retailer/__tests__/admin-retailers.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/modules/retailer/__tests__/retailer.integration.test.ts` — test stubs for FR-RET-01 through FR-RET-06
- [ ] `backend/src/middleware/__tests__/require-approved-retailer.test.ts` — test stubs for FR-RET-07
- [ ] `frontend/src/features/retailer/__tests__/profile.test.tsx` — test stubs for retailer profile views
- [ ] `frontend/src/features/retailer/__tests__/admin-retailers.test.tsx` — test stubs for admin review views

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real-time tab refocus sync | D-13, D-14 | Requires multi-window browser interactions | 1. Open retailer in browser A (pending). 2. Approve in browser B (admin). 3. Switch back to browser A, click "Check Verification Status" or focus window. Verify celebration toast and navigation unlock without page reload. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 20s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending 2026-10-18
