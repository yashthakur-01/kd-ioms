# Plan 6-03: Order Querying, Cancellation & API Routes

**Phase:** Phase 6 — Order Placement and Cancellation  
**Plan ID:** `6-03`  
**Wave:** 3 (REST Endpoints & Lifecycle Routes)  
**Dependencies:** Plan 6-01, Plan 6-02  
**Responsible Developer:** `dev2`  

---

## 1. Objective

Deliver order query and cancellation service methods (`getOrders`, `getOrderById`, `cancelOrder`), controller endpoints, validation schemas, and Express routing (`order.route.ts`), registered in the main application router at `/api/v1/orders`. Enforces strict tenant isolation, role-based allocation masking, retailer-only cancellation during `PLACED` status, and immediate catalog reservation release.

---

## 2. Tasks & Detailed Instructions

### Task 1: Order Query & Cancellation Service Methods (`backend/src/modules/order/order.service.ts`)
- Implement:
  1. **`getOrders(actor, queryParams)`:**
     - Query parameters: `status`, `from`, `to`, `retailerId`, `q`, `page`, `pageSize`, `sort` (`createdAt`, `-createdAt`).
     - Access Control & Tenant Filtering:
       - If `actor.role === 'RETAILER'`: strictly force `retailer_id = actor.id`. Ignore external `retailerId` filter.
       - If `actor.role === 'ADMIN'`: allow filtering by `retailerId` or viewing all.
       - If `actor.role === 'DELIVERY'`: allow viewing assigned orders (`delivery_partner_id = actor.id`) or unassigned orders.
     - Projects: `orderId`, `orderNumber`, `status`, `retailer` (`id`, `name`, `pharmacyName`), `itemCount`, `totalAmount`, `createdAt`.
     - Returns paginated list envelope.
  2. **`getOrderById(actor, orderId)`:**
     - Query order with retailer information, order items (with medicine name, pack size, requested quantity, quoted price incl. GST), and order status history trail.
     - Tenant Isolation: If `actor.role === 'RETAILER'` and `order.retailer_id !== actor.id`:
       - Throw `NotFoundError` (`404 ORDER_NOT_FOUND`, message: `'Order not found'`). Prevents cross-retailer ID harvesting.
     - Information Masking: Batch allocations (`order_allocations`) are only queried and returned for `ADMIN` and `DELIVERY`. For `RETAILER`, allocations are completely omitted.
  3. **`cancelOrder({ actor, orderId, reason })`:**
     - Executes inside `withTransaction`:
       - Query order `FOR UPDATE`. If not found, throw 404 `ORDER_NOT_FOUND`.
       - If `actor.role === 'RETAILER'` and `order.retailer_id !== actor.id`:
         - Throw 404 `ORDER_NOT_FOUND`.
       - Validate state transition using `assertTransition(order.status, ORDER_STATUS.CANCELLED)`:
         - If `order.status !== 'PLACED'`: throws 409 `INVALID_STATE_TRANSITION`.
       - Update order:
         ```sql
         UPDATE orders 
         SET status = 'CANCELLED', cancelled_at = NOW(), rejection_reason = $2, updated_at = NOW()
         WHERE order_id = $1
         RETURNING order_id, order_number, status, cancelled_at;
         ```
       - Insert audit record into `order_status_history`:
         ```sql
         INSERT INTO order_status_history (order_id, from_status, to_status, actor_id, note)
         VALUES ($1, 'PLACED', 'CANCELLED', $2, $3);
         ```
     - Notice: Because `v_medicine_availability` only deducts orders where `status = 'PLACED'`, updating to `CANCELLED` instantly frees the reserved inventory in real time.

### Task 2: Controller & Route Wiring (`order.controller.ts` & `order.route.ts`)
- Create `backend/src/modules/order/order.controller.ts`:
  - `placeOrder`: Calls `orderService.placeOrder`. On success, responds with 201 Created.
  - `getOrders`: Calls `orderService.getOrders`. Responds with 200 OK.
  - `getOrderById`: Calls `orderService.getOrderById`. Responds with 200 OK.
  - `cancelOrder`: Calls `orderService.cancelOrder`. Responds with 200 OK.
- Create `backend/src/modules/order/order.route.ts`:
  - `POST /`: `authenticate`, `requireApprovedRetailer` (for retailers) or `authorize(['DELIVERY'])`, `idempotency`, `validate(placeOrderSchema)`, `placeOrder`.
  - `GET /`: `authenticate`, `validate(getOrdersQuerySchema)`, `getOrders`.
  - `GET /:orderId`: `authenticate`, `validate(orderIdParamSchema)`, `getOrderById`.
  - `POST /:orderId/cancel`: `authenticate`, `authorize(['RETAILER'])`, `validate(cancelOrderSchema)`, `cancelOrder`.
- Mount router in `backend/src/routes/index.ts`:
  ```ts
  import { orderRouter } from '../modules/order/order.route.js';
  router.use('/orders', orderRouter);
  ```

---

## 3. Verification & Acceptance Criteria
- [ ] `POST /orders` mounted with authentication, authorization, idempotency, and validation middlewares.
- [ ] `GET /orders` filters retailer's view to their own orders, provides pagination, and supports status/date filters.
- [ ] `GET /orders/:orderId` returns full order details; returns 404 for another retailer's order.
- [ ] `POST /orders/:orderId/cancel` cancels `PLACED` order, records history, and returns 200.
- [ ] `POST /orders/:orderId/cancel` on non-PLACED order throws 409 `INVALID_STATE_TRANSITION`.
- [ ] Router registered cleanly in `backend/src/routes/index.ts`.
