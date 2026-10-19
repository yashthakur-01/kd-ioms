# Phase 5 Context: Catalog and Availability

*See full details at [`.planning/phases/5-catalog-availability/5-CONTEXT.md`](file:///home/yash/D/kd-ioms/.planning/phases/5-catalog-availability/5-CONTEXT.md)*

**Phase:** Phase 5 — Catalog and Availability  
**Responsible Developer:** `dev2`  
**Status:** Context Gathered & Locked (Ready for `/gsd-plan-phase 5`)  

### Key Decisions Locked:
1. **Real-Time Dynamic Availability (ADR-019):** Calculated on every read as `available_qty = GREATEST(0, sellable_qty - reserved_qty)`. Sellable stock includes only `ACTIVE`, unexpired batches (`expiry_date >= today_ist()`) with positive balance (`quantity_on_hand > 0`). Reserved stock aggregates line quantities from `PLACED` orders.
2. **Catalog Price Ceilings & Information Masking (ADR-020):** `maxMrp` is the highest MRP and `maxPriceInclGst` is the highest selling price × (1 + GST) among sellable batches with stock. If no sellable stock exists, both evaluate to `null` and `inStock` is `false`. Retailers never see batch numbers, individual batch quantities, purchase rates, or expiry dates.
3. **Database Views & Trigram Search (ADR-021):** Migration `003_catalog_views.sql` updates `v_medicine_availability` and `v_catalog` to expose `salts_text` and `salt_ids`, with GIN trigram indexes on `medicines` and a compound index on `batches(medicine_id, status, expiry_date, quantity_on_hand)` for sub-100ms response times.
4. **Multi-Tier Retailer Gating & Local Cart Persistence (ADR-022):** Middleware `requireApprovedRetailer` rejects unapproved retailers with 403 `RETAILER_NOT_APPROVED`. Client-side cart is persisted per authenticated user in `localStorage` (`kd_cart_${userId}`) with an interactive floating sticky bottom bar for quick cart review and checkout navigation.
5. **Admin Out-of-Stock Alerts:** `GET /alerts/out-of-stock` powers the dedicated Out-of-Stock queue tab on `/admin/alerts` with direct inward restock actions.
