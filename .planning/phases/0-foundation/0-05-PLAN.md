# Plan 0-05: Phase 0 End-to-End Verification & Health Integration

**Phase:** Phase 0 — Foundation  
**Plan ID:** `0-05`  
**Wave:** 4 (End-to-End Verification & Sign-Off)  
**Dependencies:** Plan `0-01`, Plan `0-02`, Plan `0-03`, Plan `0-04`  
**Responsible Developer:** **Shared Foundation (Lead: `dev1`)**  

---

## 1. Objective

Perform end-to-end system verification across backend and frontend, confirming that all Phase 0 architectural standards, database migrations, response envelopes, error handling pipelines, and CI checks operate cohesively before concluding Phase 0.

---

## 2. Tasks & Detailed Instructions

### Task 1: Migration Baseline Execution Check
- Run `npm run db:migrate` against the Supabase database.
- Confirm `schema_migrations` contains record for `001_init.sql`.
- Verify database tables, custom types, functions (`today_ist()`, `next_document_number()`), triggers, and views (`v_catalog`, `v_medicine_availability`, `v_expiry_alerts`, `v_expired_stock`) are active in the database.

### Task 2: Service Orchestration & Health Check Rewrite Test
- Start backend (`npm run dev:backend`) on port 5000 and frontend (`npm run dev:frontend`) on port 3000 concurrently using root `npm run dev`.
- Execute HTTP request: `curl http://localhost:3000/api/v1/health`.
- Assert:
  1. HTTP status is 200 OK.
  2. Response body matches standard success envelope:
     ```json
     {
       "success": true,
       "code": "HEALTH_OK",
       "message": "System healthy",
       "data": {
         "status": "ok",
         "db": "up",
         "version": "1.0.0",
         "uptimeSeconds": ...
       },
       "meta": {
         "requestId": "...",
         "timestamp": "..."
       }
     }
     ```
  3. Header `X-Request-Id` is present in HTTP response headers.

### Task 3: Error Tracing & Reference ID Verification
- Make request to non-existent route: `curl http://localhost:3000/api/v1/non-existent`.
- Verify response matches error envelope:
  ```json
  {
    "success": false,
    "code": "NOT_FOUND",
    "message": "Resource not found",
    "meta": {
      "requestId": "<test_req_id>",
      "timestamp": "..."
    }
  }
  ```
- Trigger a failing API call in the browser; verify that the frontend toast displays `"Ref: <test_req_id>"` and that the backend console outputs a structured Pino JSON log containing matching `"requestId":"<test_req_id>"`.

### Task 4: Complete Workspace Test Suite Execution
- Run `npm run lint` across both workspaces; ensure 0 errors.
- Run `npm run sync-enums:check` to ensure zero drift between backend and frontend enums.
- Run `npm test` across backend and frontend workspaces; ensure all unit and integration tests pass.
- Run `npm run build` across backend and frontend; ensure production bundle builds cleanly.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [x] `GET /api/v1/health` returns standard envelope via Next.js proxy rewrite (`localhost:3000/api/v1/health`).
- [x] Migrations (`001_init.sql`) execute cleanly on the Supabase database.
- [x] Deliberately triggered error shows reference ID in frontend toast and matches backend structured log entry.
- [x] Root `npm test` passes 100% across all suites (17 backend + 6 frontend = 23 tests).
- [x] Enum sync script verifies parity between backend and frontend enums.
- [x] Phase 0 exit criteria signed off and recorded in `.planning/STATE.md`.
