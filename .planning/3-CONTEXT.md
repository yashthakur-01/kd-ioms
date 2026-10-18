# Phase 3 Context: Medicines and Salts Master

*See full details at [`.planning/phases/3-medicines-salts/3-CONTEXT.md`](file:///home/yash/D/kd-ioms/.planning/phases/3-medicines-salts/3-CONTEXT.md)*

**Phase:** Phase 3 — Medicines and Salts Master  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 3`)  

### Key Decisions Locked:
1. **Database Migration (`002_salt_rename_trigger.sql`):** An automated `AFTER UPDATE OF salt_name ON salts` trigger synchronizes `salts_text` across all linked medicines at the database level; case-insensitive unique index enforces deduplication on `medicines(LOWER(TRIM(name)), LOWER(TRIM(company)), LOWER(TRIM(pack_size)))`.
2. **Salt Similarity & Collision:** `pg_trgm` similarity check (>0.5 score threshold) flags near-matches with `SALT_SIMILAR_EXISTS` (409) unless explicitly confirmed via `confirmSimilar: true`. Exact matches (case-insensitive) are strictly blocked with `DUPLICATE_RESOURCE` (409).
3. **Salt Deactivation Protection:** `PATCH /salts/:saltId` prevents deactivation with `SALT_IN_USE` (409) if any active medicine is linked to the salt.
4. **Medicine Validation & Price Guard:** Validates 0–10 active salt IDs; rejects non-existent/inactive salts with 400 `VALIDATION_ERROR` (`saltIds.<index>`). Rejects GST rate modifications with 422 `PRICE_EXCEEDS_MRP` if any batch selling price inclusive of new GST exceeds its MRP.
5. **Trigram Medicine Search:** Fast `GET /medicines/search` endpoint matches queries against medicine name and `salts_text` using PostgreSQL `pg_trgm` indexes.
6. **Frontend Hybrid Salt UX & GST Presets:** Admin medicine form features quick GST slab toggle buttons (0%, 5%, 12%, 18%, 28% + custom) and a searchable multi-select salt chip selector with an inline "+ Add New Salt" modal to add salts on the fly with duplicate checking without losing form state.
