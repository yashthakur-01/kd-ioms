<!-- generated-by: gsd-doc-writer -->
# API Reference

This document provides complete documentation of the KD-IOMS REST API (`/api/v1`), including authentication mechanisms, endpoint tables, response envelopes, error handling, and rate limits.

## Authentication

KD-IOMS uses JSON Web Tokens (JWT) for stateless API authentication and HTTP-only signed cookies for refresh token rotation:

- **Access Token**: Short-lived (default 15 minutes), passed in the HTTP `Authorization` header:
  ```
  Authorization: Bearer <access_token>
  ```
- **Refresh Token**: Long-lived (default 7 days), issued in a secure HTTP-only cookie named `refreshToken` during login or token refresh.
- **Role Enforcement**: Authenticated users have one of three roles:
  - `ADMIN` — Full access to inventory, users, pricing, approvals, settings, and financial reports.
  - `RETAILER` — Access to approved medicine catalog, personal orders, invoices, and profile.
  - `DELIVERY` — Access to assigned delivery runs, route details, and proof-of-delivery submission.
- **Mandatory Password Rotation**: When an administrator creates a staff user, the user is created with `force_password_change = true`. Downstream protected routes reject requests with `AUTH_PASSWORD_CHANGE_REQUIRED` (403) until the user executes `/api/v1/auth/change-password`.

## Endpoints Overview

All endpoints are mounted under the `/api/v1` base path.

### Authentication & Self

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Authenticate with username and password. Issues access token and refresh cookie. | Public (Rate Limited) |
| `POST` | `/api/v1/auth/refresh` | Rotate and issue a new access token using the HTTP-only refresh cookie. | Public |
| `POST` | `/api/v1/auth/logout` | Revoke the active refresh token and clear the refresh cookie. | Public |
| `POST` | `/api/v1/auth/change-password` | Update current user's password; clears `force_password_change`. | Yes (All Roles) |
| `GET` | `/api/v1/auth/me` | Fetch authenticated user profile and permissions. | Yes (All Roles) |

### System & Health

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service liveness probe and database connectivity check. | Public |

### User Management

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/users` | Create a new user (Staff or Retailer). | Admin |
| `GET` | `/api/v1/users` | List system users with pagination and role filters. | Admin |
| `GET` | `/api/v1/users/:userId` | Get user details by ID. | Admin |
| `PATCH` | `/api/v1/users/:userId` | Update user details or active status. | Admin |
| `POST` | `/api/v1/users/:userId/reset-password` | Reset a user's password and enforce rotation. | Admin |

### Product & Salt Management

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/salts` | List chemical salts with pagination. | Admin |
| `GET` | `/api/v1/salts/suggest` | Search salt names with fuzzy matching for autocomplete. | Admin |
| `POST` | `/api/v1/salts` | Register a new chemical salt formulation. | Admin |
| `PATCH` | `/api/v1/salts/:saltId` | Update salt details or active flag. | Admin |
| `GET` | `/api/v1/medicines` | List medicines with search, salt filter, and stock counts. | Yes (All Roles) |
| `POST` | `/api/v1/medicines` | Register a new medicine product. | Admin |
| `GET` | `/api/v1/medicines/:id` | Fetch detailed medicine record. | Yes (All Roles) |
| `PATCH` | `/api/v1/medicines/:id` | Update medicine information, MRP, or packaging size. | Admin |

### Stock Inwarding & Batches

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/stock/inward` | Inward a new supplier batch of medicines with invoice reference. | Admin |
| `POST` | `/api/v1/stock/scan/resolve` | Parse and resolve GS1 DataMatrix 2D barcode data. | Admin |
| `GET` | `/api/v1/stock/ledger` | Fetch immutable audit trail of stock ledger adjustments. | Admin |
| `GET` | `/api/v1/batches` | List batches with expiry dates and on-hand quantities. | Admin |
| `GET` | `/api/v1/batches/:batchId` | Fetch batch details, storage rack, and supplier information. | Admin |
| `PATCH` | `/api/v1/batches/:batchId/block` | Block or unblock a batch from being picked or ordered. | Admin |

### Retailer Accounts & Approval

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/retailers` | List registered retailers with status and credit filters. | Admin |
| `POST` | `/api/v1/retailers` | Register a new retailer account. | Public / Admin |
| `GET` | `/api/v1/retailers/:retailerId` | Fetch retailer profile, drug license, and tax identifiers. | Admin / Retailer |
| `POST` | `/api/v1/retailers/:retailerId/approve` | Approve a pending retailer registration. | Admin |
| `POST` | `/api/v1/retailers/:retailerId/reject` | Reject a retailer application with reason code. | Admin |

### Catalog & Pricing

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/catalog` | View wholesale catalog with dynamic stock flags and live prices. | Approved Retailer |
| `GET` | `/api/v1/catalog/:id` | View detailed product catalog item with volume discounts. | Approved Retailer |

### Orders & Allocation

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/orders` | Place a new order with items. Supports `Idempotency-Key`. | Retailer / Admin |
| `GET` | `/api/v1/orders` | List orders (Retailers see only their own orders; Admins see all). | Yes |
| `GET` | `/api/v1/orders/:orderId` | Get order details with line items and status history. | Yes |
| `POST` | `/api/v1/orders/:orderId/cancel` | Cancel an order while in `PLACED` status. | Retailer |
| `GET` | `/api/v1/orders/:orderId/pick-suggestions` | Get FEFO batch allocation recommendations. | Admin |
| `POST` | `/api/v1/orders/:orderId/approve` | Approve order, locking prices and allocating batches. | Admin |
| `POST` | `/api/v1/orders/:orderId/reject` | Reject order with reason notes. | Admin |

### Delivery & Proof-of-Delivery

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/delivery/trips` | List delivery trips and assigned manifests. | Admin / Delivery |
| `POST` | `/api/v1/delivery/trips` | Create a delivery trip and assign orders. | Admin |
| `POST` | `/api/v1/delivery/orders/:orderId/start` | Mark order in transit (`OUT_FOR_DELIVERY`). | Delivery / Admin |
| `POST` | `/api/v1/delivery/orders/:orderId/complete` | Complete delivery with recipient signature, OTP, or photo. | Delivery / Admin |
| `POST` | `/api/v1/delivery/orders/:orderId/fail` | Mark delivery attempt failed with reschedule notes. | Delivery / Admin |

### Invoices & Financials

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/invoices` | List generated invoices with balance and payment status. | Admin / Retailer |
| `GET` | `/api/v1/invoices/:invoiceId` | Get invoice breakdown with taxes and itemized pricing. | Admin / Retailer |
| `GET` | `/api/v1/invoices/:invoiceId/pdf` | Download signed PDF tax invoice document. | Admin / Retailer |
| `POST` | `/api/v1/invoices/:invoiceId/send` | Dispatch invoice copy via Email or WhatsApp. | Admin |

### Alerts, Settings & Dashboard

| Method | Path | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/alerts` | List inventory alerts (Low Stock, Near Expiry, Credit Limit). | Admin |
| `PATCH` | `/api/v1/alerts/:alertId/ack` | Acknowledge active inventory alert. | Admin |
| `GET` | `/api/v1/settings` | Retrieve system operational thresholds and defaults. | Admin |
| `PATCH` | `/api/v1/settings` | Update system operational thresholds and notification toggles. | Admin |
| `GET` | `/api/v1/dashboard/summary` | Retrieve administrative dashboard KPIs and operational metrics. | Admin |

## Request and Response Formats

All API responses follow a standard envelope structure.

### Standard Success Envelope

```json
{
  "success": true,
  "code": "ORDER_CREATED",
  "message": "Order placed successfully",
  "data": {
    "orderId": 1042,
    "status": "PLACED",
    "totalAmount": 15420.50
  },
  "meta": {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-10-20T12:30:00.000Z"
  }
}
```

### Standard Paginated List Envelope

```json
{
  "success": true,
  "code": "ORDER_LISTED",
  "message": "Orders retrieved",
  "data": [
    {
      "orderId": 1042,
      "retailerName": "Apothecary Plus",
      "totalAmount": 15420.50,
      "status": "PLACED"
    }
  ],
  "meta": {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-10-20T12:30:00.000Z",
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

### Standard Error Envelope

```json
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "Invalid request parameters",
  "errors": [
    {
      "path": "quantity",
      "message": "Quantity must be greater than zero"
    }
  ],
  "meta": {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "timestamp": "2026-10-20T12:30:00.000Z"
  }
}
```

## Error Codes

The system returns domain-specific machine codes in the `code` field:

| Error Code | HTTP Status | Semantic Meaning |
| :--- | :---: | :--- |
| `VALIDATION_ERROR` | 400 | Request parameters, query string, or body failed Zod schema validation. |
| `AUTH_REQUIRED` | 401 | Missing or invalid `Authorization: Bearer` access token. |
| `AUTH_TOKEN_EXPIRED` | 401 | Access token expired. The client should request a new token via `/auth/refresh`. |
| `AUTH_INVALID_CREDENTIALS` | 401 | Incorrect username or password submitted to `/auth/login`. |
| `AUTH_ACCOUNT_INACTIVE` | 403 | User account has been deactivated by an administrator. |
| `AUTH_PASSWORD_CHANGE_REQUIRED` | 403 | User must change temporary password before accessing protected resources. |
| `FORBIDDEN` | 403 | User lacks required role permission (e.g. Retailer attempting Admin operation). |
| `RETAILER_NOT_APPROVED` | 403 | Retailer account is pending verification or has been rejected. |
| `NOT_FOUND` | 404 | Requested entity (order, medicine, batch, user) does not exist. |
| `DUPLICATE_RESOURCE` | 409 | Resource with unique constraint already exists (e.g. username or barcode). |
| `INVALID_STATE_TRANSITION` | 400 | Attempted illegal state change (e.g. approving an already delivered order). |
| `INSUFFICIENT_STOCK` | 400 | Requested quantity exceeds unallocated available stock. |
| `IDEMPOTENCY_KEY_REUSED` | 409 | `Idempotency-Key` was submitted previously with differing request parameters. |
| `RATE_LIMITED` | 429 | Request rate exceeded allowed window. Check `X-RateLimit-*` headers. |
| `INTERNAL_ERROR` | 500 | Unhandled internal exception occurred. Stack trace is logged server-side. |

## Rate Limits

KD-IOMS implements in-memory sliding window rate limiting:

- **General API Limiter**: Applied globally across all `/api/v1` routes.
  - **Threshold**: 300 requests per 1 minute per IP.
- **Mutating Limiter**: Applied to stock inwarding and order operations.
  - **Threshold**: 120 write requests per 1 minute per IP.
- **Login Limiter**: Applied to `/api/v1/auth/login`.
  - **Threshold**: 10 authentication attempts per 15 minutes per IP.

When rate limits are exceeded, the API responds with HTTP 429 and response header `X-RateLimit-Reset` indicating the Unix epoch second when the window resets.
