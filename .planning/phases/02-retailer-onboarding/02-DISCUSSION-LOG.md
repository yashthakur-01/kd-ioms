# Phase 2: Retailer Onboarding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-18  
**Phase:** 2-Retailer Onboarding  
**Areas discussed:** Onboarding Navigation & Catalog Gating, Profile Resubmission & Lock Policy, Admin Review Workflow & Rejection Presets, Live Verification State Synchronization  

---

## Onboarding Navigation & Catalog Gating

| Option | Description | Selected |
|--------|-------------|:--------:|
| Strict Redirect & Locked Nav | Redirect unapproved retailers directly to /profile. BottomNav items (Catalog, Cart, Orders) are disabled with a lock badge until APPROVED. | ✓ |
| Guard Screen on Gated Routes | Allow clicking nav items, but render a dedicated 'KYC Verification Required' card on /catalog, /cart, /orders with a direct link to complete/view profile. | |
| You decide | Antigravity picks the cleanest UX pattern aligned with tech.md. | |

**User's choice:** Strict Redirect & Locked Nav  
**Notes:** Prevents unverified access at both the route navigation and API middleware levels.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Clean Read-Only Inspector | When PENDING or APPROVED, inputs are rendered in a clean read-only summary card with a prominent status banner (Amber for PENDING, Emerald for APPROVED) and quick-copy buttons for GSTIN & Drug License. | ✓ |
| Disabled Inputs with Lock Icons | Keep standard input elements visible on screen but disabled/grayed out with lock indicators and the status banner above. | |
| You decide | Choose the most polished and standard Tailwind layout. | |

**User's choice:** Clean Read-Only Inspector  
**Notes:** Cleaner mobile presentation than disabled form inputs.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Intercept & Redirect | When an API call fails with 403 RETAILER_NOT_APPROVED, apiFetch or React Query triggers an informative toast ('Verification required: Please complete KYC profile') and navigates to /profile. | ✓ |
| In-Page Error Banner | Keep user on current page and render an ErrorBanner with an action button 'Go to Profile'. | |
| You decide | Whatever provides the smoothest fallback experience. | |

**User's choice:** Intercept & Redirect  
**Notes:** Guarantees deep-linked attempts or bookmarks smoothly redirect to the KYC page.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Prominent Success Callout | Display a green 'Account Verified' banner with an immediate primary CTA button 'Browse Catalog & Order', while BottomNav lock icons vanish and links activate. | ✓ |
| Minimal Badge Change | Just switch the status badge from amber 'Pending' to green 'Approved' and unlock navigation links without an extra callout. | |
| You decide | Choose whichever feels more encouraging for first-time retailers. | |

**User's choice:** Prominent Success Callout  
**Notes:** High-clarity celebratory UX to encourage immediate catalog exploration.

---

## Profile Resubmission & Lock Policy

| Option | Description | Selected |
|--------|-------------|:--------:|
| Persistent Red Alert Card & Pre-filled Form | Display a prominent red 'Application Needs Attention' banner detailing the admin's exact rejection remarks, directly above a pre-filled editable form with a 'Resubmit for Review' button. | ✓ |
| Alert Modal on Load | Show an alert dialog with the rejection comments when opening the page, which dismisses to the editable form. | |
| You decide | Antigravity picks the standard responsive design pattern. | |

**User's choice:** Persistent Red Alert Card & Pre-filled Form  
**Notes:** Avoids annoying popups while keeping rejection feedback visible during editing.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Informational Lock Card with Support Callout | Display a locked badge with clear instructions to contact Kandarp Drugs admin/support (phone & email) for any verified business detail changes. Direct edits remain blocked. | ✓ |
| 'Request Change' Button | Include a button that opens a pre-addressed mailto or WhatsApp link to support with the shop's license number pre-filled. | |
| You decide | Cleanest approach aligned with pharmaceutical compliance. | |

**User's choice:** Informational Lock Card with Support Callout  
**Notes:** Complies with pharmaceutical regulations requiring verified identities and drug licenses.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Field-Level Error with Help Context | Attach the 409 error directly to the offending field (Drug License or GSTIN) with message: 'Already registered with another account. Contact admin if you believe this is an error.' | ✓ |
| Top-of-Form Error Banner Only | Show a generic top alert banner without field-level targeting. | |
| You decide | Follow existing FieldError and FormField conventions. | |

**User's choice:** Field-Level Error with Help Context  
**Notes:** Clear feedback pinpointing whether GSTIN or Drug License triggered the conflict.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Instant Transition to Read-Only Inspector | Immediately switch to the read-only summary view with the amber 'Under Verification' banner and a success toast ('KYC details submitted for review'). | ✓ |
| Keep Form Editable with Success Message | Stay in the form view with inputs still editable until admin takes action. | |
| You decide | Whatever feels most natural and prevents accidental re-submissions. | |

**User's choice:** Instant Transition to Read-Only Inspector  
**Notes:** Prevents accidental double submissions and confirms submission immediately.

---

## Admin Review Workflow & Rejection Presets

| Option | Description | Selected |
|--------|-------------|:--------:|
| Tabbed Queue with Badge Counts | Distinct tabs for 'Pending Review (N)', 'Approved', 'Rejected', and 'All', with search by shop name/drug license and quick actions per row. | ✓ |
| Unified Table with Filter Dropdown | A single master table with status filter dropdown, search input, and pagination. | |
| You decide | Pick whichever matches the admin users dashboard pattern. | |

**User's choice:** Tabbed Queue with Badge Counts  
**Notes:** Ensures pending applications are the primary focus for admin review.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Quick-Select Preset Chips + Textarea | Provide common rejection chips ('Invalid Drug License format', 'GSTIN and shop name mismatch', 'Incomplete address details') that fill a 5–300 character textarea with live character counter. | ✓ |
| Freeform Textarea Only | Simple dialog with a blank textarea and live character counter (min 5, max 300 chars). | |
| You decide | Whatever ensures fast, consistent admin turnaround. | |

**User's choice:** Quick-Select Preset Chips + Textarea  
**Notes:** Balances standardized feedback with custom admin explanation.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Confirmation Modal with Summary | Clicking 'Approve' opens a ConfirmDialog summarizing shop name, drug license, and GSTIN before final commit to avoid accidental approvals. | ✓ |
| Direct 1-Click Approval | Instant approval with button spinner and toast notification, without a secondary confirmation modal. | |
| You decide | Cleanest balance between safety and admin speed. | |

**User's choice:** Confirmation Modal with Summary  
**Notes:** Critical safety gate before granting ordering permissions.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Dedicated Detail Page (/admin/retailers/[userId]) | A full detail page displaying the retailer KYC profile, user account information, audit timestamps, and sticky Approve / Reject action buttons. | ✓ |
| Slide-Over Drawer on List Page | A side drawer that slides out over the retailer queue without navigating away from the table. | |
| You decide | Align strictly with tech.md specifications. | |

**User's choice:** Dedicated Detail Page (/admin/retailers/[userId])  
**Notes:** Matches `tech.md` Section 7.5 and provides sufficient room for inspection.

---

## Live Verification State Synchronization

| Option | Description | Selected |
|--------|-------------|:--------:|
| Window Focus Refetch Only | Only check status when the user switches tabs or refocuses the window, without an active timer. | ✓ |
| Smart Polling (10s interval) + Focus Refetch | React Query polls GET /retailers/me every 10s only while status is PENDING. Polling stops immediately upon approval. | |
| You decide | Antigravity picks the most battery/network-efficient interval. | |

**User's choice:** Window Focus Refetch Only  
**Notes:** Eliminates background polling traffic while keeping the application responsive to user activity.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Manual 'Check Status' Button in Banner | Add a visible 'Check Verification Status' button with a spinner inside the pending alert card, giving retailers instant on-demand status checks without page reload. | ✓ |
| No Button | Rely purely on tab refocus / window focus events to refresh the query. | |
| You decide | Whatever provides the best UX. | |

**User's choice:** Manual 'Check Status' Button in Banner  
**Notes:** Perfect complement to focus refetching for users waiting on the screen.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Dedicated useRetailerProfile Query Hook | Encapsulate profile and status in a dedicated hook with query key ['retailers', 'me']. RetailerLayout and BottomNav subscribe directly, unlocking navigation reactively as soon as the cache updates. | ✓ |
| Store inside AuthProvider context | Synchronize approvalStatus into the global AuthContext alongside user role and credentials. | |
| You decide | Standard React Query cache-driven architecture. | |

**User's choice:** Dedicated useRetailerProfile Query Hook  
**Notes:** Idiomatic TanStack Query architecture with centralized cache invalidation.

| Option | Description | Selected |
|--------|-------------|:--------:|
| Celebratory Toast Notification | Trigger a celebratory toast ('🎉 Your KYC is approved! Catalog access is now unlocked.') when the status transitions from PENDING to APPROVED. | ✓ |
| Silent Banner Update Only | Update the status badge and banner in place without a floating toast. | |
| You decide | Pick whichever feels best. | |

**User's choice:** Celebratory Toast Notification  
**Notes:** Immediate positive feedback confirming that features have unlocked.

---

## Antigravity's Discretion
- None — all key decisions were explicitly chosen by the user.

## Deferred Ideas
- Automated GSTIN lookup via external Government/ClearTax API (future phase).
- PDF / image upload for physical drug license certificates (future phase).
