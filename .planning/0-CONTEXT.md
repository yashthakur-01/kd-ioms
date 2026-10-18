# Phase 0 Context: Foundation

*See full details at [`.planning/phases/0-foundation/0-CONTEXT.md`](file:///d:/coding/Projects/kd-ioms/.planning/phases/0-foundation/0-CONTEXT.md)*

**Phase:** Phase 0 — Foundation  
**Responsible Developer:** **Shared Foundation (Lead: `dev1`, Reviewers: `dev2`, `dev3`)**  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 0`)  

### Key Decisions Locked:
1. **Backend Language & Execution:** Node.js + Express written in TypeScript (`backend/src/**/*.ts`), running locally with `tsx watch` and built with `tsc`.
2. **Database:** Supabase PostgreSQL for both local development and production. Numbered migrations via `src/db/migrate.ts`. Comprehensive `001_init.sql` schema baseline.
3. **Frontend UI Components:** Lightweight custom Tailwind CSS components using native HTML and Tailwind tokens (per `tech.md`).
4. **Monorepo Scripts:** Root `package.json` with orchestration scripts (`npm run dev`, `npm run build`, `npm test`, `npm run db:migrate`).
5. **Testing & CI:** Vitest + Supertest for backend, Vitest + RTL for frontend, GitHub Actions CI verifying lint, typecheck, tests, and enum sync.
