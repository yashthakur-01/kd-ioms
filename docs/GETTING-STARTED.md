<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide provides step-by-step instructions for getting KD-IOMS running on your local machine for development and evaluation.

## Prerequisites

Before running the system, verify that you have the following prerequisites installed:

- **Node.js**: `Node.js >= 20.0.0`
- **npm**: `npm >= 10.0.0`
- **PostgreSQL**: `PostgreSQL >= 15.0` (Running locally via Homebrew/Docker, or a remote PostgreSQL instance on Supabase)
- **Git**: Recent version of Git

Verify your installed versions:

```bash
node -v
npm -v
psql --version
```

## Installation Steps

### 1. Clone the Repository

Clone the project repository to your local workstation:

```bash
git clone https://github.com/kd-pharma/kd-ioms.git
cd kd-ioms
```

### 2. Install Workspace Dependencies

KD-IOMS uses npm workspaces to coordinate packages between backend and frontend. Install all dependencies from the root:

```bash
npm install
```

### 3. Configure Backend Environment

Create a local `.env` configuration in the `backend/` directory by copying the provided example:

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` in your text editor and ensure the `DATABASE_URL` matches your local or Supabase database credentials:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
```

*(Optional)* If you plan to test PDF invoice uploading or delivery photos, supply your `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

### 4. Apply Database Migrations

Run the database migration runner to create tables, indexes, views, and constraints:

```bash
npm run db:migrate
```

### 5. Seed Initial Admin Account

Seed the default administrative user:

```bash
npm run seed:admin
```

This creates an administrator account with:
- **Username**: `admin`
- **Password**: `Admin@KD2026!`
- **Role**: `ADMIN`

## First Run

Start both the Express backend and the Next.js frontend concurrently using the root dev script:

```bash
npm run dev
```

The output will confirm both servers are listening:
- **Express Backend**: Listening on [http://localhost:5000](http://localhost:5000)
- **Next.js Frontend**: Ready at [http://localhost:3000](http://localhost:3000)

### Accessing the Web Application

1. Open your browser and navigate to [http://localhost:3000/login](http://localhost:3000/login).
2. Enter the seeded credentials (`admin` / `Admin@KD2026!`).
3. You will be directed to the administrator dashboard where you can manage products, salts, stock inwarding, retailer approvals, and orders.

### Testing the Health Endpoint

Verify that the backend is responding and connected to PostgreSQL:

```bash
curl http://localhost:5000/api/v1/health
```

Expected response:
```json
{
  "success": true,
  "code": "HEALTH_OK",
  "message": "Service healthy",
  "data": {
    "status": "pass",
    "uptimeSeconds": 15.2,
    "database": "connected"
  }
}
```

## Common Setup Issues

### Issue 1: Database Connection Refused or Timeout

**Symptom**: Backend logs `[DATABASE POOL ERROR]` or `ECONNREFUSED 127.0.0.1:5432`.  
**Cause**: PostgreSQL service is either not running locally, or the credentials in `backend/.env` are incorrect.  
**Solution**:
1. Check that PostgreSQL is running:
   ```bash
   # On macOS (Homebrew)
   brew services list
   
   # On Linux (systemd)
   sudo systemctl status postgresql
   
   # On Windows (PowerShell)
   Get-Service -Name postgresql*
   ```
2. Verify you can connect directly with `psql`:
   ```bash
   psql "postgresql://postgres:postgres@localhost:5432/postgres"
   ```
3. Update `backend/.env` with the correct host, port, username, and password.

### Issue 2: JWT Secrets Length Validation Error

**Symptom**: Backend terminates immediately with:
`[FATAL: ENVIRONMENT CONFIGURATION ERROR] - JWT_ACCESS_SECRET: JWT_ACCESS_SECRET must be at least 32 characters long`.  
**Cause**: A customized `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` in `.env` is shorter than the minimum requirement of 32 characters.  
**Solution**:
Generate a secure 32+ character string and update `backend/.env`:
```bash
# Generate a random 32-byte hexadecimal string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Issue 3: Port Conflicts (5000 or 3000 in use)

**Symptom**: Server crashes with `EADDRINUSE :::5000` or Next.js switches to port 3001.  
**Cause**: Another background process (AirPlay receiver on macOS, another Node.js instance, or Docker) is bound to port 5000 or 3000.  
**Solution**:
1. Identify and stop the conflicting process:
   ```bash
   # Find process on port 5000 (Linux/macOS)
   lsof -i :5000
   
   # Find process on port 5000 (Windows PowerShell)
   Get-NetTCPConnection -LocalPort 5000
   ```
2. Alternatively, set a different port in `backend/.env` (e.g. `PORT=5001`) and update `BACKEND_URL=http://localhost:5001` in your environment.

## Next Steps

Now that your local environment is running, explore the following documentation:

- [Development Workflow](DEVELOPMENT.md) — Coding standards, npm commands, and branch guidelines.
- [Testing Guide](TESTING.md) — How to run and write unit and integration test suites.
- [API Reference](API.md) — Complete endpoint reference for frontend and third-party integrations.
- [Architecture Overview](ARCHITECTURE.md) — High-level system design, database row locks, and ledger mechanics.
- [Configuration Reference](CONFIGURATION.md) — Detailed list of all backend and frontend settings.
