# Election Portal Audit Update

**Date:** 2026-07-26  
**Scope:** `election-portal` and `election-api`  
**Purpose:** Revalidate the existing July audit against the current code, correct stale findings, apply safe high-priority fixes, and record remaining production blockers.

## Executive summary

The portal is a substantial, generally coherent election-management product with strong mobile-first foundations and broad administrator/voter functionality. It is not yet ready for a high-stakes production election without further security, database, and end-to-end testing work.

This pass fixed current access-control, authentication, onboarding, build, performance, typing, and accessibility defects. The frontend now passes its type check and production build. All backend JavaScript passes syntax validation.

A follow-up tenant-isolation pass also confirmed that the configured live database currently contains **zero cross-organization relationships** across user/election access, voter groups, election groups, and recorded votes. The application now rejects attempts to create those relationships.

The remaining largest risks are persistent plaintext voter passwords, lack of automated tests and login rate limiting, an unverified database-level double-vote constraint, incomplete authenticated browser testing, and a ballot-rule ambiguity that requires a product decision.

## Corrections to the older audit

The previous `ELECTION_AUDIT_REPORT.md` is useful background, but several findings were stale:

- The self-service forgot-password endpoint is already disabled with HTTP 410. The UI correctly directs users to an administrator.
- The bulk voter-generation `createdIds` crash is already fixed; the current implementation uses the IDs returned from `insertMany`.
- The root vote endpoints were no longer voter-accessible, but they still allowed any administrator to create arbitrary votes and list ballots without election/franchise scoping. They have now been removed from routing.
- The frontend build had not previously been measured. It did build, but the type-check command was broken and the application shipped all routed pages in one large startup bundle.

## Fixes applied in this pass

### Voting and authentication security

- Removed the legacy `GET /api/v1/vote/` and `POST /api/v1/vote/` routes.
- Restricted voter-only endpoints (`available-elections`, `voter-status`, `my-vote`, and `cast`) to the `voter` role.
- Removed the plaintext password-comparison fallback. Malformed password hashes now fail closed.
- Disabled the Express technology signature.
- Added baseline API response headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: no-referrer`
  - restrictive camera, microphone, and geolocation permissions
- API documentation is no longer exposed in production unless `ENABLE_API_DOCS=true`.

### Account and organization isolation

- Centralized logout and account switching cleanup. Authentication, stored user data, onboarding state, notification state, preferences, and all cached API queries are cleared before another account is stored.
- Other tabs now react to login/logout storage changes and discard their cached account data.
- Inactive accounts are rejected on every protected request, even if an older JWT has not expired.
- Non-super administrators can no longer override their organization by submitting another `franchiseId`.
- A user, election, voter group, or election group cannot be moved to another organization after creation.
- Election and voter assignments are checked against the owning organization before they are stored.
- Cross-organization assignment is rejected even for a super administrator; super administrators retain global viewing/management authority but cannot create mixed-tenant relationships.
- Election-admin and voter access now requires both an assignment and a matching organization.
- Legacy mismatched voter-group and election-group relations are filtered from responses instead of being returned.
- Dashboard voter counts for election administrators are now organization-scoped.
- Added repeatable tenant-isolation regression and live integrity audit commands.

### Frontend correctness

- Restored administrator onboarding enforcement. It had been hardcoded off even though the API status check still ran.
- Removed shared-device onboarding state from `localStorage`; onboarding status now comes from the authenticated account.
- Corrected active-code TypeScript defects involving entity IDs, nullable passwords/statuses, voter-group exports, file saving, election creation, and Vite configuration.
- Isolated obsolete prototype files from the active type-check surface.

### Performance

- Added route-level lazy loading for all pages.
- Reduced the shared application JavaScript from approximately **1,685 KB** to approximately **290 KB** before compression.
- The largest remaining route chunk is the voter-management screen at approximately **531 KB** before compression; PDF/Excel tooling is the likely main contributor.
- The PWA still precaches approximately **4.1 MB**, so installed-app cache weight remains an optimization opportunity.

### Accessibility and interaction

- Added accessible naming to the mobile navigation menu button.
- Changed the mobile sidebar backdrop into a keyboard-focusable close button.
- Added selected-state semantics and explicit accessible names to nominee-selection controls.

### Mobile-first design consistency

- Standardized the administrator and voter shells on the same background, header height, safe-area handling, content width, and 64px mobile navigation.
- Increased global buttons, form fields, selectors, menu items, and icon actions to mobile-friendly touch dimensions.
- Standardized cards, popovers, menus, tabs, inputs, text areas, checkboxes, alerts, and dialogs through shared primitives.
- Dialogs and confirmation prompts now open as bottom sheets on phones and centered modals on larger screens.
- Added reusable page-header and page-content primitives and applied them to the highest-traffic administrator screens.
- Reworked mobile page actions so primary actions use clear labels and expand when space is limited.
- Replaced the voter-management text tabs with a compact segmented control.
- Made election-workspace tabs horizontally scrollable instead of wrapping into irregular rows.
- Reduced mobile election-form padding and gaps, improved file-name wrapping, and made save/cancel actions consistently sized.
- Hid the low-priority product footer on phones to keep attention on the task and fixed navigation.
- Removed the obsolete external development banner from the production HTML.

## Verification results

| Check | Result |
|---|---|
| Frontend TypeScript check | Pass |
| Frontend production build | Pass |
| PWA service-worker generation | Pass |
| Backend JavaScript syntax validation | Pass |
| Supabase connection through local API | Pass |
| Tenant-isolation regression test | Pass |
| Live tenant relationship integrity audit | Pass: 0 invalid relationships |
| Older credential-based cross-franchise script | Blocked: configured test credentials were rejected |
| Authenticated browser flow test | Not completed |

The local API requires Node 20+ for the current Supabase client, while one legacy JWT dependency fails on Node 26. Node 24 successfully starts the API and connects to Supabase. The portal also requires Node 20+.

## Current design assessment

### Strengths

- Clear blue-and-white product identity and consistent shared component primitives.
- Strong mobile structure: bottom navigation, mobile cards, responsive tables, safe-area spacing, and large touch targets.
- Voter flow includes selection progress, review, final confirmation, loading, empty, and error states.
- Administrator pages cover elections, franchises, administrators, voters, voter groups, nominees, results, reports, and audit logs.
- Login and voter-facing screens use concise copy and strong primary actions.

### Design gaps

- Dark-mode styles exist but no theme provider or theme control is available; several administrator layouts also hardcode white backgrounds. Dark mode should either be completed across every screen or removed until it is consistent.
- Loading, empty, and error presentation still varies between pages.
- Deep election-management screens need consistent breadcrumbs or a persistent election context header.
- The onboarding screen uses an older visual style and is less polished on small screens than the main portal.
- Several dense administration flows depend on dialogs and large tables; they need authenticated mobile usability testing with realistic data.
- Focus order, contrast, dialog announcements, and full keyboard navigation require a dedicated WCAG 2.2 AA pass.

## Current functionality assessment

### Working or substantially implemented

- Login, logout, current-user profile, and password change
- Franchise and administrator management
- Election create/edit/lifecycle controls
- Nominee create/bulk import/photo handling
- Voter create/generate/import/grouping and credential-slip output
- Voter election list, ballot review, vote submission, and results
- Election analytics, reports, manual winners, result publication controls
- Notifications, audit logs, PWA install/update behavior
- PDF and Excel exports

### Remaining high-priority risks

1. **Plaintext voter passwords remain stored in `users.plain_password`.** This is the highest remaining code-level security risk. Credentials should be one-time-return values, not durable database fields.
2. **No rate limiting** protects login or other authentication endpoints.
3. **Double-vote protection is not schema-verifiable from the repository.** Confirm a real unique database constraint on `(voter_id, election_id)`.
4. **Only tenant-isolation regression coverage has been added.** A broader unit/integration/E2E suite is still needed for vote, result-publication, and user-management workflows.
5. **The older credential-based cross-franchise test accounts are stale.** The new deterministic tenant-isolation test and live read-only relationship audit pass, but an authenticated multi-role browser test still needs replacement accounts.
6. **No complete Supabase schema migration history** exists in source control.
7. **Election lifecycle changes are read-triggered**, not reliably scheduled.
8. **File validation trusts declared MIME type** rather than verifying file signatures/content.
9. **JWTs remain valid for up to 24 hours** without revocation after password or role changes.
10. **The ballot rule is ambiguous:** the API accepts one-to-N selections, while the current voter UI requires exactly N. This must be explicitly decided before changing behavior because it affects election validity.

## Recommended release gate

Do not use the system for a consequential election until all of these are complete:

1. Remove persistent plaintext passwords and migrate existing records.
2. Confirm/add the database unique vote constraint.
3. Add authentication rate limiting and structured security logging.
4. Add automated authorization and ballot-integrity tests.
5. Replace the stale test accounts and pass the cross-franchise regression suite.
6. Run authenticated end-to-end tests for all four roles on desktop and mobile.
7. Decide and document whether ballots require exactly N selections or allow up to N.
8. Export and version the production Supabase schema.
9. Complete a WCAG 2.2 AA accessibility pass.
10. Conduct a final penetration test and restore/backup drill.

## Overall readiness

| Area | Current assessment |
|---|---|
| Feature breadth | Strong |
| Visual design | Good foundation; inconsistent edge screens |
| Mobile UX | Strong foundation; authenticated QA still required |
| Accessibility | Partial |
| Frontend build health | Pass |
| Backend syntax/startup | Pass on Node 24 |
| Automated testing | Insufficient |
| Security | Improved in this pass; major password/DB risks remain |
| High-stakes production readiness | Not yet approved |
