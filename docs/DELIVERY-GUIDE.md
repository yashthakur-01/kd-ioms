<!-- generated-by: gsd-doc-writer -->
# Delivery Partner Operations Manual

This guide provides operational instructions for field delivery personnel fulfilling pharmaceutical wholesale orders using KD-IOMS on mobile phones or tablets.

---

## Table of Contents
1. [Account Login & Security](#1-account-login--security)
2. [Dispatch Pool & Claiming Deliveries](#2-dispatch-pool--claiming-deliveries)
3. [Order Transit & Route Navigation](#3-order-transit--route-navigation)
4. [Doorstep Inspection & Item Handover](#4-doorstep-inspection--item-handover)
5. [Whole-Line Refusal Handling](#5-whole-line-refusal-handling)
6. [Photo Proof of Delivery (POD) & Completion](#6-photo-proof-of-delivery-pod--completion)
7. [Placing Orders on Behalf of Retailers](#7-placing-orders-on-behalf-of-retailers)

---

## 1. Account Login & Security

### 1.1 Initial Sign-In
1. Open the mobile browser and navigate to the application URL: `https://app.kandarpidrugs.com/login`.
2. Enter your assigned username (e.g., `delivery_rajesh`) and the temporary password provided by your warehouse administrator.
3. Tap **Sign In**.

### 1.2 Mandatory Password Change
- Upon first sign-in, you are automatically redirected to `/change-password`.
- Enter your temporary password and create a secure personal password:
  - Minimum 8 characters.
  - Mix of letters, numbers, and symbols.
- Save your new credentials. You are redirected to the delivery dashboard.

---

## 2. Dispatch Pool & Claiming Deliveries

When warehouse staff pick and pack approved pharmaceutical orders, they appear in the Dispatch Pool.

### 2.1 Viewing Open Deliveries
1. Navigate to `/delivery/pool` (or tap the **Pool** tab in the bottom navigation bar).
2. The pool lists available orders with:
   - Order Number (e.g., `ORD-2026-000101`).
   - Retail Pharmacy Name and Destination Area (e.g., `Apollo City Pharmacy — Navrangpura`).
   - Package count and total order value.

### 2.2 Claiming an Order
1. Tap **Claim Order** on the delivery card.
2. The system atomically assigns the order to you and transitions its status to `OUT_FOR_DELIVERY`.
3. The order moves to your active delivery list at `/delivery/orders`.

> **Note**: Orders are claimed on a first-come, first-served basis. If another driver claims an order simultaneously, the screen updates automatically.

---

## 3. Order Transit & Route Navigation

### 3.1 Reviewing Delivery Details
Navigate to `/delivery/orders` and tap your active order to open the Delivery Detail screen:
- **Retailer Profile**: Pharmacy shop name, physical address, and landmarks.
- **Direct Actions**:
  - Tap **Call Retailer** to initiate a phone call via device dialer.
  - Tap **WhatsApp** to send an instant message or dispatch notice.
  - Tap **Map Directions** to open GPS navigation (Google Maps) to the destination.

### 3.2 Releasing an Order
If your vehicle encounters a mechanical failure or you cannot complete delivery:
1. Contact warehouse dispatch immediately.
2. Tap **Release to Pool** on the order screen.
3. The order returns to the open pool for another delivery partner to claim.

---

## 4. Doorstep Inspection & Item Handover

Upon arrival at the retail pharmacy:
1. Locate the pharmacist-in-charge or authorized receiving staff.
2. Open the active delivery order on your screen.
3. Cross-examine each packed carton against the digital line-item checklist:
   - Medicine Name and Formulation.
   - Batch Number printed on the pack (e.g., `CRO-2026-X1`).
   - Expiry Date (verify it matches the dispatch manifest).
   - Quantity of strips, bottles, or boxes delivered.
4. If all items match without damage, tap **Accept** for each line.

---

## 5. Whole-Line Refusal Handling

Pharmaceutical wholesale regulations permit **whole-line refusals**. If a pharmacy rejects a specific medicine line (e.g., packaging broken during transit or near-expiry concerns):

### 5.1 Refusal Procedure
1. On the specific line item, tap **Refuse Line**.
2. Select or enter the mandatory **Refusal Reason**:
   - `Packaging torn / seal broken`
   - `Wrong medicine delivered`
   - `Pharmacy overstocked / ordered in error`
   - `Near expiry batch`
3. Physical custody: Retain the entire refused quantity in your transit tote for immediate return to warehouse inventory.

> **Important**: Partial unit refusal within a single line is not permitted. The line must either be accepted in full or returned in full.

### 5.2 Automatic System Action
When a line is marked refused, the backend:
- Immediately credits the items back to inventory via a `RETURN_IN` stock ledger entry upon delivery submission.
- Re-calculates the order total and excludes refused items from the final tax invoice.

---

## 6. Photo Proof of Delivery (POD) & Completion

To complete the delivery and generate the formal GST tax invoice:

### 6.1 Capturing Photo Proof
1. Tap **Capture Proof Photo** at the bottom of the checklist.
2. Your camera opens. Capture a clear photo showing:
   - Delivered parcels on the pharmacy counter, or
   - The pharmacist receiving the consignment, or
   - The signed physical delivery challan.
3. Tap **Upload Photo** (maximum file size: 5 MB).

### 6.2 Final Confirmation
1. Review the final summary:
   - Accepted Lines count.
   - Refused Lines count.
   - Revised total amount collectible.
2. Tap **Complete Delivery**:
   - The order status updates to `DELIVERED`.
   - The system generates the final PDF tax invoice.
   - The retailer receives an instant WhatsApp confirmation.

---

## 7. Placing Orders on Behalf of Retailers

When visiting retail pharmacies in person, delivery partners can assist store owners in placing replenishment orders directly:

1. Tap **Place Order** in the delivery menu.
2. Select the verified retail pharmacy from the client list.
3. Search medicines using brand name or chemical salt.
4. Add required quantities to the order cart.
5. Tap **Submit Order**.
6. The order is immediately queued for warehouse picking and FEFO allocation.
