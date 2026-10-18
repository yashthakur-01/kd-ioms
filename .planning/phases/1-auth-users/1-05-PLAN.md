# Plan 1-05: Frontend Auth, Features & Interactive Screens

**Phase:** Phase 1 — Authentication and Users  
**Plan ID:** `1-05`  
**Wave:** 5 (Frontend Integration)  
**Dependencies:** Plan `1-03`, Plan `1-04`  
**Responsible Developer:** `dev1`  

---

## 1. Objective

Build the frontend authentication lifecycle and administration screens: `AuthProvider` state synchronization with silent refresh, accessible `/login` page with error reference tracing, compulsory `/change-password` page, `/admin/users` directory table with filtering and pagination, and `/admin/users/new` creation flow with a single-view temporary password modal.

---

## 2. Tasks & Detailed Instructions

### Task 1: Auth Feature Layer (`frontend/src/features/auth/`)
- `schema.ts`:
  - `loginSchema`: client Zod schema matching backend constraints.
  - `changePasswordSchema`: client Zod schema with current password, new password, confirm password, and difference check.
- `api.ts`:
  - `login(payload)`: calls `apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(payload) })`.
  - `refresh()`: calls `apiFetch('/auth/refresh', { method: 'POST' })`.
  - `logout()`: calls `apiFetch('/auth/logout', { method: 'POST' })`.
  - `changePassword(payload)`: calls `apiFetch('/auth/change-password', { method: 'POST', body: JSON.stringify(payload) })`.
  - `getMe()`: calls `apiFetch('/auth/me')`.
- `hooks.ts`:
  - `useLogin()`: TanStack Query mutation hook.
  - `useLogout()`: TanStack Query mutation hook with query client cache clearing.
  - `useChangePassword()`: TanStack Query mutation hook.

### Task 2: Users Feature Layer (`frontend/src/features/users/`)
- `keys.ts`:
  - Query key factory: `usersKeys.all`, `usersKeys.lists()`, `usersKeys.list(filters)`, `usersKeys.detail(id)`.
- `schema.ts`:
  - `createUserSchema`: username, role (`RETAILER`, `DELIVERY`), phone, optional temporaryPassword.
  - `updateUserSchema`: phone, isActive.
- `api.ts`:
  - `listUsers(params)`: `apiFetch('/users', { query: params })`.
  - `createUser(payload)`: `apiFetch('/users', { method: 'POST', body: JSON.stringify(payload) })`.
  - `getUser(id)`: `apiFetch('/users/' + id)`.
  - `updateUser(id, payload)`: `apiFetch('/users/' + id, { method: 'PATCH', body: JSON.stringify(payload) })`.
  - `resetPassword(id)`: `apiFetch('/users/' + id + '/reset-password', { method: 'POST' })`.
- `hooks.ts`:
  - `useUsers(filters)`: `useQuery` fetching paginated users list.
  - `useCreateUser()`: `useMutation` invalidating `usersKeys.lists()`.
  - `useUpdateUser()`: `useMutation` invalidating user queries.
  - `useResetPassword()`: `useMutation` returning temporary password.

### Task 3: Auth Provider & Route Guards (`frontend/src/providers/AuthProvider.tsx`)
- Maintain React Context with:
  - `user: AuthUser | null`: contains `id`, `username`, `role`, `mustChangePassword`, `phone`.
  - `isLoading: boolean`: initially `true` while bootstrapping.
  - `login: (credentials) => Promise<void>`: stores access token via `setAccessToken` and updates state.
  - `logout: () => Promise<void>`: clears token via `setAccessToken(null)` and redirects to `/login`.
  - `refreshSession: () => Promise<void>`.
- Bootstrapping effect on mount:
  - Calls `api.refresh()`. If successful, sets in-memory token, calls `api.getMe()`, sets `user`.
  - If 401 or network error: sets `user = null`, clears token.
  - Sets `isLoading = false`.
- Compulsory password change enforcement:
  - If `user?.mustChangePassword === true && pathname !== '/change-password'`, automatically redirect to `/change-password`.

### Task 4: Interactive Login Screen (`frontend/src/app/(auth)/login/page.tsx`)
- Branded card with Kandarp Drugs logo/heading.
- Form inputs: Username, Password.
- Submit button with loading spinner and disabled state while submitting.
- Displays `ErrorBanner` or toast when login fails, displaying backend error message, error code, and `Ref: <requestId>`.
- Redirects successfully authenticated user to their role portal:
  - `ADMIN` -> `/dashboard`
  - `RETAILER` -> `/catalog`
  - `DELIVERY` -> `/pool`

### Task 5: Compulsory Change Password Screen (`frontend/src/app/(auth)/change-password/page.tsx`)
- Form inputs: Current Password, New Password, Confirm New Password.
- Password complexity checklist dynamically showing green checks:
  - At least 10 characters.
  - At least one letter.
  - At least one digit.
  - Must not match current password.
- Submitting successfully updates password, toasts success message, and redirects into role portal.

### Task 6: Admin User Directory Screen (`frontend/src/app/(admin)/users/page.tsx`)
- Header with "Users Management" title and "Create New User" button navigating to `/admin/users/new`.
- Filter bar:
  - Search input (searches username and phone with debouncing).
  - Role dropdown filter (`All Roles`, `Retailer`, `Delivery`).
  - Status dropdown filter (`All Status`, `Active`, `Inactive`).
- User Table using `Table` component:
  - Columns: Username, Role, Phone, Status (`Badge`), Password Status, Created Date, Actions.
  - Actions:
    - Status toggle switch (activate / deactivate).
    - "Reset Password" button opening `ConfirmDialog`.
- Reset Password Modal:
  - Displays newly generated memorable temporary password with a 1-click "Copy to Clipboard" button and clear guidance warning.
- Pagination component wired to `page` and `pageSize`.

### Task 7: Admin User Creation Screen (`frontend/src/app/(admin)/users/new/page.tsx`)
- Form with fields: Username, Role (Select: `Retailer`, `Delivery`), Phone, Optional custom password.
- On successful submission:
  - Opens `Modal` displaying the generated temporary password in bold monospace.
  - "Copy to Clipboard" button with confirmation state.
  - Warning note: "This temporary password will not be shown again. Please copy and share it securely with the user."
  - "Done" button navigating back to `/admin/users`.

### Task 8: Automated Tests
- Create `frontend/src/features/auth/__tests__/login.test.tsx`:
  - Renders login inputs and validates fields.
  - Handles successful login submission.
  - Renders error banner with reference ID on failure.
- Create `frontend/src/features/users/__tests__/users.test.tsx`:
  - Renders user table with received data.
  - Handles filter changes and pagination.

---

## 3. Verification & Acceptance Criteria ("Done When")

- [x] `/login` authenticates users, sets state, and redirects to designated role home.
- [x] Users with `mustChangePassword: true` are blocked from navigating away from `/change-password`.
- [x] `/admin/users` displays paginated, filterable user list with active/inactive toggles.
- [x] `/admin/users/new` creates user and displays temporary password once.
- [x] Password reset modal displays generated passphrase with copy button.
- [x] Frontend unit and component tests pass (`npm test --workspace=frontend`).
