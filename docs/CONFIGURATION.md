<!-- generated-by: gsd-doc-writer -->
# Configuration Reference

This guide details all environment variables, configuration files, default values, and runtime options for KD-IOMS.

## Environment Variables

Environment variables are loaded and validated at startup using Zod schemas (`backend/src/config/env.ts`). If any required variable fails validation, the application terminates immediately with a descriptive diagnostic error.

### Backend Variables

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Optional | `development` | Runtime environment mode (`development`, `test`, `production`). In production, SSL is enabled for database connections and stricter security checks apply. |
| `PORT` | Optional | `5000` | Port number on which the Express HTTP server listens. |
| `APP_ORIGIN` | Optional | `http://localhost:3000` | Allowed CORS origin for cross-origin browser requests. |
| `DATABASE_URL` | **Required** | `postgresql://postgres:postgres@localhost:5432/postgres` | PostgreSQL connection URI. Supports local instances and hosted platforms (e.g. Supabase connection poolers). |
| `JWT_ACCESS_SECRET` | **Required** | Development fallback | Secret key used to sign short-lived JWT access tokens. Must be at least 32 characters long. In production, this must be set to a secure, randomly generated string. |
| `JWT_REFRESH_SECRET` | **Required** | Development fallback | Secret key used to sign long-lived refresh tokens. Must be at least 32 characters long. In production, this must be set to a secure, randomly generated string. |
| `ACCESS_TOKEN_EXPIRES_IN` | Optional | `15m` | Lifetime of issued JWT access tokens (e.g. `15m`, `1h`). |
| `REFRESH_TOKEN_EXPIRES_IN` | Optional | `7d` | Lifetime of issued refresh tokens (e.g. `7d`, `30d`). |
| `COOKIE_SECRET` | Optional | Development fallback | Secret string used to sign HTTP-only cookies in `cookie-parser`. |
| `COOKIE_SECURE` | Optional | `false` | When `true`, cookies are only transmitted over HTTPS connections. Set to `true` in production deployments. |
| `COOKIE_SAME_SITE` | Optional | `lax` | SameSite policy for auth cookies (`lax`, `strict`, `none`). |
| `LOG_LEVEL` | Optional | `info` | Minimum log severity level emitted by Pino (`fatal`, `error`, `warn`, `info`, `debug`, `trace`). |
| `ADMIN_USERNAME` | Optional | `admin` | Username for the primary administrative seed script (`npm run seed:admin`). |
| `ADMIN_PASSWORD` | Optional | `Admin@KD2026!` | Initial password for the seeded admin user. Must be at least 10 characters long. |
| `REFRESH_TOKEN_PEPPER` | Optional | `kd-ioms-refresh-pepper-2026` | Additional pepper applied during refresh token hashing. |
| `SMTP_HOST` | Optional | None | Hostname for the outbound SMTP email server (e.g., `smtp.gmail.com` or SendGrid/Postmark). |
| `SMTP_PORT` | Optional | `587` | Port number for the outbound SMTP server. |
| `SMTP_SECURE` | Optional | `false` | Whether to enforce TLS/SSL connection to SMTP host. |
| `SMTP_USER` | Optional | None | Username / API key for SMTP authentication. |
| `SMTP_PASS` | Optional | None | Password / API secret for SMTP authentication. |
| `EMAIL_FROM` | Optional | None | Sender address displayed on automated transactional emails (e.g., invoices). |
| `WHATSAPP_PHONE_NUMBER_ID`| Optional | None | Meta Cloud API Phone Number ID for WhatsApp order alerts. |
| `WHATSAPP_ACCESS_TOKEN` | Optional | None | Meta Cloud API Bearer Access Token with WhatsApp messaging permissions. |
| `WHATSAPP_API_VERSION` | Optional | `v20.0` | Meta Graph API version for WhatsApp endpoints. <!-- VERIFY: {WHATSAPP_API_VERSION default version string} --> |
| `WHATSAPP_VERIFY_TOKEN` | Optional | None | Webhook verification token for incoming WhatsApp webhooks. |
| `SUPABASE_URL` | Optional | None | Base URL for your Supabase project (e.g. `https://<ref>.supabase.co`). Required for PDF invoice and photo uploads. |
| `SUPABASE_SERVICE_ROLE_KEY`| Optional | None | Service role administrative API key for Supabase Storage operations. |
| `SUPABASE_STORAGE_BUCKET` | Optional | `invoices` | Storage bucket name for generated PDF invoices. |
| `SUPABASE_DELIVERY_BUCKET`| Optional | `delivery-photos` | Storage bucket name for delivery confirmation photos. |

### Frontend Variables

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `BACKEND_URL` | Optional | `http://localhost:5000` | Target URL used by `frontend/next.config.ts` to rewrite `/api/v1/:path*` requests to the Express backend. |

## Config File Format

KD-IOMS utilizes native TypeScript configuration modules to ensure full type-safety and immediate startup validation:

### Backend Schema Validation (`backend/src/config/env.ts`)

The backend parses environment variables using Zod:

```typescript
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // ... optional notification & cloud storage keys
});
```

### Next.js API Proxy (`frontend/next.config.ts`)

The frontend uses Next.js route rewrites to proxy client requests to the backend:

```typescript
async rewrites() {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:5000";
  return [
    {
      source: "/api/v1/:path*",
      destination: `${backendUrl}/api/v1/:path*`,
    },
  ];
}
```

## Required vs Optional Settings

### Critical Startup Requirements

The backend process will fail to start (`process.exit(1)`) if:
- `DATABASE_URL` is empty or invalid.
- `JWT_ACCESS_SECRET` is shorter than 32 characters.
- `JWT_REFRESH_SECRET` is shorter than 32 characters.
- Any integer port cannot be coerced into a valid number.

### Graceful Degradation for Integrations

If external service keys are omitted:
- **Email Notifications**: If `SMTP_HOST` or `SMTP_USER` is missing, emails are skipped or logged as warnings without halting core transaction workflows.
- **WhatsApp Alerts**: If `WHATSAPP_PHONE_NUMBER_ID` or `WHATSAPP_ACCESS_TOKEN` is missing, WhatsApp messaging operations fail gracefully with warnings.
- **Supabase Storage**: If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is not configured, invoice PDF generation stores files locally or flags storage errors without crashing order processing.

## Per-Environment Overrides

### Development

In local development (`NODE_ENV=development`):
- Default secrets provide zero-config startup.
- `COOKIE_SECURE=false` allows cookie transmission over plain HTTP (`localhost`).
- Database connections bypass SSL validation for local PostgreSQL.
- Verbose debug logs are enabled (`LOG_LEVEL=debug` or `info`).

### Production

In production environments (`NODE_ENV=production`):
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must be set via platform secret managers.
- `COOKIE_SECURE=true` ensures auth cookies are only sent over HTTPS.
- Database connections automatically enable SSL (`rejectUnauthorized: false` for managed cloud poolers).
- `APP_ORIGIN` must match the canonical production frontend domain.
