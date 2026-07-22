# Election Portal — Full Technical Audit Report

**Scope audited:** `election-api` (backend), `election-portal` (frontend + thin proxy server). `election-next` is an empty placeholder directory (only `.gitkeep`) — not audited, contains nothing.
**Method:** Static, read-only analysis of the full source tree. No code was modified. No live system/DB was queried — all DB schema is inferred from ORM/query-builder usage, not verified DDL (no `CREATE TABLE` migration files exist for Supabase).
**Report date:** 2026-07-07.

---

## 1. Project Overview

### Purpose
A multi-tenant ("franchise") election/voting management system ("dfms" = internal codename). Franchises (organizations) run elections; franchise/election admins configure elections, nominees, and voter rolls; voters log in and cast ballots; results can be published with configurable visibility (hidden, percentage, full).

### Tech Stack
| Layer | Stack |
|---|---|
| Backend | Node.js, Express 4, Mongoose 8 (legacy) + Supabase-js 2 (Postgres, primary), JWT (`jsonwebtoken`), `bcryptjs`, `multer`, AWS SDK v3 (DigitalOcean Spaces, S3-compatible), `swagger-autogen` |
| Frontend | React 18 + TypeScript, Vite 5, `wouter` (routing), TanStack Query 5, Tailwind CSS 3 + shadcn/radix UI, `react-hook-form` + `zod`, `vite-plugin-pwa` |
| Frontend server | Thin Express server (`election-portal/server`) — dev/prod static file server + `/api/*` reverse proxy to `election-api`, no business logic |
| Database | **Supabase/Postgres is primary.** MongoDB is a legacy fallback for elections only, mid-migration. |
| Deploy targets | Backend: DigitalOcean App Platform (`.do/app.yaml`, `Dockerfile`). Frontend: Netlify (`netlify.toml`), also has a Replit config (`.replit`) from earlier prototyping. |

### Architecture
Two independently deployable apps, no shared package/monorepo tooling (no shared `node_modules`/workspace):
- `election-api` — REST API, `/api/v1/*`, stateless JWT auth, Supabase as system of record.
- `election-portal` — SPA built with Vite, served by a minimal Express server that also proxies API calls (avoids CORS in prod, and lets Netlify serve one origin). Client never talks to the backend host directly — always via same-origin `/api/*` → proxy → `election-api`.

No shared code between the two apps at the package level; `shared/entityId.ts` (frontend) and `lib/entityId.js` (backend) independently re-implement the same UUID-vs-legacy-Mongo-id logic — duplicated, not actually shared.

### Folder Structure
```
election/
├── election-api/          # Express backend
│   ├── controllers/       # 10 controllers
│   ├── routes/            # 10 route files
│   ├── middleware/        # auth, upload, uploadImage
│   ├── lib/                # roles, electionAccess, electionLifecycle, elections, supabase/, mongo/, notifications/, reminders/, storage
│   ├── model/              # Election.js (only Mongoose model that exists)
│   ├── migrations/         # 3 hand-written SQL ALTERs (no full-schema DDL)
│   ├── scripts/            # migration/smoke/security-test CLI scripts
│   └── db_design.txt, note.txt, config/whatsapp.js  # leftovers from an unrelated template project
├── election-portal/
│   ├── client/src/
│   │   ├── pages/          # 25 files
│   │   ├── components/     # 92 files (ui primitives + feature components)
│   │   ├── lib/             # queryClient, roles, entityId helpers, authUser, mockData(dead)
│   ├── server/              # proxy + static server (some orphaned unwired routes/controllers)
│   └── shared/              # schema.ts, entityId.ts
└── election-next/           # empty placeholder, not in use
```

### Number of Pages
**25** page files under `client/src/pages`. Of these, **3 are dead/unrouted**: `VotingInterface.tsx` (legacy predecessor of `VotingBallot.tsx`, imports a `mockData.ts` fixture), `ElectionGroups.tsx`, `VoterGroups.tsx` (superseded by redirects to `/elections` and `/voters`, only reachable as embedded sub-components now). Effectively **~22 live routed pages**.

### Number of Components
**92** component files (`client/src/components`), of which ~59 are shadcn/radix UI primitives (`components/ui/`) and ~33 are feature-specific (dashboard, elections, voters, nominees, voting, layout, analytics, pwa, help, account).

### APIs
**11 route groups**, roughly **50 endpoints** under `/api/v1/*` (auth, user, franchise, auditLog, electionAnalytics, electionGroup, election, nominee, vote, voterGroup, onboarding, notifications). Full table in §6.

### Database Collections/Tables
**Primary (Supabase/Postgres, inferred, no verified DDL):** `users`, `franchises`, `elections`, `nominees`, `votes`, `vote_nominees`, `user_election_access`, `voter_groups`, `voter_group_voters`, `voter_group_elections`, `election_groups`, `election_group_elections`, `election_analytics`, `audit_logs` — 14 tables.
**Legacy (MongoDB):** only `elections` collection (`model/Election.js`), used solely for elections created before the Supabase migration and only if `MONGO_URI` is configured.

### Authentication Flow
`POST /api/v1/auth/login` → username lookup (case-insensitive) → `bcrypt.compare` (with an unsafe plaintext-equality fallback if bcrypt throws) → `jwt.sign({id}, JWT_SECRET, {expiresIn:"24h"})`. Token carries only the user id; every request re-fetches the full user row. No refresh tokens, no server-side session/revocation, no rate limiting on login. Frontend stores the JWT and a mirrored user object in `localStorage`, sent as `Authorization: Bearer` on every API call. See §9 for the security findings this produces.

### Authorization Flow
Role hierarchy (`lib/roles.js`): `super_admin(4) > franchise_admin(3) > election_admin(2) > voter(1)`. Route-level gate = `authorize(...roles)` middleware (coarse allow-list). Resource-level gate = per-request checks: franchise scoping (`sameFranchise`), election scoping (`canAccessElection` — franchise admins by shared franchise, election admins by an explicit `electionAccess` array, voters by a `user_election_access` join-table row), and a "manage" check for actor-vs-target role outranking before user CRUD. Frontend duplicates a simplified version of this logic for UI-hiding only (`lib/roles.ts`, `AuthWrapper` in `App.tsx`) — **not a security boundary**, purely UX; all real enforcement is (correctly) server-side, though as §9 documents, two backend endpoints (`vote` GET/POST) fail to enforce it.

---

## 2. Features Implemented

| # | Feature | Description | Backend | DB | Frontend | Status |
|---|---|---|---|---|---|---|
| 1 | Authentication (login/logout/me/change-password) | JWT bearer auth | `controllers/auth.js`, `middleware/auth.js` | `users` | `Login.tsx`, `AuthWrapper` | **Complete** |
| 2 | Forgot password (self-service) | Username+email+newPassword reset, no OTP/email link | `controllers/auth.js:forgotPassword` | `users` | `ForgotPassword.tsx` | **Complete but insecure** (see §9) |
| 3 | Onboarding flow | First-login profile completion gate | `routes/onboarding.js` | `users.onboarding_completed` | `Onboarding.tsx` | Complete |
| 4 | Franchise (tenant) management | CRUD for organizations, logo upload | `controllers/franchise.js` | `franchises` | `Franchises.tsx` | Complete |
| 5 | Franchise/Election admin creation | Super/franchise admin creates scoped admins | `controllers/user.js` | `users` | `Admins.tsx` | Complete |
| 6 | Voter management (single + bulk generate) | Create/generate voter accounts, bulk credential generation | `controllers/user.js` (`createVoter`,`generateVoters`) | `users` | `Voters.tsx`, `VoterBulkGenerator.tsx` | **Partial** — `generateVoters` + voter-group assignment has a `ReferenceError` bug (`createdIds` undefined, see §9/§6) |
| 7 | Voter groups | Group voters for bulk election assignment | `controllers/voterGroup.js` | `voter_groups`, join tables | `ManageVoterGroupDialog.tsx`, (page dead, embedded only) | Complete (backend); frontend page orphaned |
| 8 | Election group | Group elections (e.g. by cycle/year) | `controllers/electionGroup.js` | `election_groups` | page redirects to `/elections`, embedded picker only | **Partial** — dedicated UI removed/never finished |
| 9 | Election CRUD + lifecycle | Draft/active/completed/archived states, auto-lock on date pass | `controllers/election.js`, `lib/electionLifecycle.js` | `elections` | `Elections.tsx`, `ElectionForm.tsx` | Complete, but lifecycle sync is **read-triggered, not scheduled** (see §10) |
| 10 | Nominee management (single + bulk + photo) | CRUD, bulk add, base64 or multipart photo upload | `controllers/nominee.js` | `nominees` | `NomineeForm.tsx`, `NomineeCard.tsx` | Complete |
| 11 | Voting (ballot cast) | `castVote` with duplicate/window/access checks | `controllers/vote.js:castVote` | `votes`, `vote_nominees` | `VotingBallot.tsx`, `BallotForm.tsx` | Complete |
| 12 | Legacy vote endpoints (`addVote`, `getVotes`) | Unscoped create/list, bypass all the checks `castVote` has | `controllers/vote.js` | `votes` | not used by any page found | **Broken/dangerous — should be removed** (§9 critical findings) |
| 13 | Results publication + visibility control | Publish toggle + 5-level visibility enum | `controllers/election.js:publishResults` | `elections.results_published*`, `voter_result_display` | `VotingResults.tsx`, `ElectionResultsSummary.tsx` | Complete |
| 14 | Manual winner override | Admin manually sets winners instead of auto vote-count | `controllers/election.js:setManualWinners` | `elections.manual_winner*` | `ManualWinnerPicker.tsx` | Complete |
| 15 | Automatic winner computation | Top-N by votes, optional gender-based seat reservation | `controllers/vote.js:computeElectedIds` | — | `ElectionResultsSummary.tsx` | Complete |
| 16 | Election analytics / dashboard stats | Aggregate counts (voters, votes cast, pending) | `controllers/electionAnalytics.js` | `election_analytics` | `Dashboard.tsx`, `StatCard.tsx` | Complete |
| 17 | Vote reminders | Send reminder notifications to non-voted users | `controllers/electionAnalytics.js:sendVoteReminders`, `lib/reminders/` | — | not found in UI (no button located) | **Partial** — backend exists, no confirmed frontend trigger found |
| 18 | Audit logs | System action log, franchise-scoped | `controllers/auditLog.js`, `utils/auditLog.js` | `audit_logs` | `AuditLogs.tsx` (super_admin only) | Complete, but writes are fire-and-forget (`console.error` only on failure, no alerting) |
| 19 | Notifications (bell) | In-app notification list | `controllers/notifications.js` | Not clearly modeled as its own table (unclear from `lib/notifications/`, needs deeper look) | `NotificationBell.tsx` | **Partial / Not fully verified** — mark as "Not Found" for underlying persistence model, flagged for follow-up |
| 20 | File/photo uploads | Franchise logo, election logo, nominee photo | `middleware/upload.js`, `lib/spacesStorage.js`, `lib/photoUpload.js` | URL columns on respective tables | Form file inputs | Complete, but MIME-type-only validation (no magic-byte check), see §9 |
| 21 | Voter slip printing (PDF) | Print physical credential slips for distributed/bulk voters | `jspdf`/`jspdf-autotable` client-side | — | `VoterSlipPrinter.tsx`, `BulkVoterSlipPrinter.tsx` | Complete |
| 22 | CSV/Excel export | Export tables (voters, results, audit logs) | client-side `xlsx` | — | `export-menu.tsx` and page-level export buttons | Complete (client-side generation, not server-generated reports) |
| 23 | PWA / offline install | Installable app, service worker, update prompts | `vite-plugin-pwa` | — | `InstallPrompt.tsx`, `UpdatePrompt.tsx`, `public/offline.html` (unused fallback) | **Partial** — offline page intentionally not wired as navigateFallback per code comment; effectively online-only despite PWA scaffolding |
| 24 | Dark mode | CSS variables + Tailwind `dark:` classes defined | — | — | scattered `dark:` classes, `next-themes` dependency present | **Missing/Incomplete** — no `ThemeProvider` or toggle UI exists; unreachable by end users |
| 25 | Swagger API docs | Auto-generated OpenAPI spec | `swagger.js`, `swagger-output.json`, served at `/api-docs` | — | — | **Partial** — generated but never customized (placeholder title/host), publicly reachable with no auth |
| 26 | RBAC / multi-tenant scoping | Franchise + election-level access control | `lib/roles.js`, `lib/electionAccess.js` | — | UI-hiding only, mirrored (not authoritative) in `lib/roles.ts` | Complete server-side except the two vote-endpoint gaps in #12 |

---

## 3. User Roles

### `super_admin`
- **Permissions:** Full system access across all franchises. Only role that can create/delete franchises, create franchise admins, view audit logs.
- **Accessible pages:** All pages (`/`, `/elections*`, `/voters`, `/franchises`, `/admins`, `/reports`, `/audit-logs`, `/profile`, `/settings`).
- **Restricted pages:** None.
- **CRUD:** Full CRUD on franchises, users (all roles), elections, nominees, voter groups, election groups, audit logs (read).
- **Dashboard widgets:** All stat cards, `FranchiseOverview` (cross-franchise breakdown), `RecentElectionsTable`.

### `franchise_admin`
- **Permissions:** Full control within own franchise only (`sameFranchise` check). Can create `election_admin`s and voters within their franchise. Cannot create franchises or other franchise admins.
- **Accessible pages:** `/`, `/elections*`, `/voters`, `/admins` (scoped), `/reports`, `/profile`, `/settings`.
- **Restricted pages:** `/franchises`, `/audit-logs`.
- **CRUD:** Full CRUD on own-franchise elections, nominees, voters, voter groups, election groups; read/manage `election_admin` users in own franchise.
- **Dashboard widgets:** Stat cards, `FranchiseOverview` (own franchise), `RecentElectionsTable`.

### `election_admin`
- **Permissions:** Scoped to specific elections listed in their `electionAccess` array (not a whole franchise). Can manage voters only within accessible elections/franchise, cannot manage other admins.
- **Accessible pages:** `/`, `/elections*` (scoped to assigned elections), `/voters` (scoped), `/reports`, `/profile`, `/settings`.
- **Restricted pages:** `/franchises`, `/admins`, `/audit-logs`.
- **CRUD:** CRUD on nominees/voters/results within assigned elections only; cannot create elections outside assigned scope (needs confirmation whether they can create *new* elections at all — controller allows it via generic `admin` gate, but this may be broader than intended; flagged as a **role-matrix ambiguity**, not confirmed exploit).
- **Dashboard widgets:** Stat cards, `RecentElectionsTable` (no `FranchiseOverview` — that widget is admin-tier only).

### `voter`
- **Permissions:** Cast one vote per election they have explicit `user_election_access` to; view own vote and published results (per visibility setting).
- **Accessible pages:** `/voting`, `/election/:id` (ballot), `/results/:id`, `/onboarding`, `/profile`, `/settings`.
- **Restricted pages:** Everything admin-tier (`/`, `/elections`, `/voters`, `/franchises`, `/admins`, `/reports`, `/audit-logs`).
- **CRUD:** Create own vote (once, enforced by unique `(voter_id, election_id)` constraint + app-level duplicate check); read own vote/results; update own profile/password.
- **Dashboard widgets:** No admin dashboard — `VotingPortal.tsx` acts as their "dashboard" (available elections list + status).

**Role-matrix caveat:** the frontend never renders a formal permission matrix page/table for admins to review who-can-do-what — this exists only implicitly across `lib/roles.js` and route guards (see §13, "Role Matrix" missing feature).

---

## 4. Election Workflow

```
super_admin
  ↓ creates franchise, creates franchise_admin
franchise_admin
  ↓ creates election_admin, creates election (draft), uploads logo
election_admin  (or franchise_admin directly — no distinct "constituency/booth/district" tier exists in this system)
  ↓ adds nominees (bulk or single, with photos), creates/imports voter groups
voter accounts (created/generated by admin, bulk credential generation + printed slips)
  ↓ election transitions draft → active (votingOpen=true, or auto by date logic)
voter
  ↓ logs in, completes onboarding, sees election in VotingPortal (if user_election_access exists)
  ↓ casts ballot (castVote) — one-time, validated against duplicate/window/access
election_date passes OR admin sets votingOpen=false
  ↓ lifecycle auto-recomputes to "completed" on next read (lazy, not scheduled)
admin
  ↓ reviews results (auto top-N/gender-seat calc, or manual override), publishes
voter
  ↓ views results per configured visibility (none/result_only/percentage/score/full)
super_admin / franchise_admin
  ↓ reviews audit_logs, election_analytics
```

**Note on hierarchy:** the example given in the prompt (State → District → Constituency → Booth → Polling Officer) does **not exist in this codebase**. The actual hierarchy is flat: `super_admin → franchise_admin → election_admin → voter`, with franchise as the only tenant boundary and per-election ACLs for `election_admin`/`voter`. There is no geographic/administrative-unit hierarchy (state/district/constituency/booth) modeled anywhere in the schema or code — flagging this explicitly since the prompt's example implies a government-style election structure that this system does not implement. If that hierarchy is a business requirement, it is **entirely missing** and would require new tables (administrative units) + a redesigned access-scoping layer.

**Per-role actions, end to end:**
- **super_admin:** create/delete franchise → create franchise_admin → view cross-tenant audit logs/analytics → (rarely) directly manage any election.
- **franchise_admin:** create election_admin → create election → configure election settings (max voters/nominees, gender rules, display mode) → create/import voter groups → assign voters to election → monitor turnout via analytics → publish results → manually override winners if needed.
- **election_admin:** manage nominees for assigned election(s) → manage voters for assigned election(s) → send reminders → view results detail (if `adminVotingDetailsEnabled`).
- **voter:** complete onboarding → view available elections → cast ballot once → view own vote → view published results (per visibility rule) → change own password.

---

## 5. Database Report

*(Inferred from query-builder usage — no verified Postgres DDL exists in-repo; treat field lists as best-effort, not authoritative schema.)*

### `users`
- **Fields:** id (uuid, PK), username, password (bcrypt hash), plain_password, email, full_name, role, franchise_id (FK→franchises), registration_number, created_by, created_at, updated_at, last_login, status, is_voter, onboarding_completed, voter_prefix, voter_sequence_number, election_access (array, for election_admin scoping).
- **Relationships:** franchise_id → franchises; referenced by votes.voter_id, user_election_access.user_id, audit_logs.user_id.
- **Indexes:** Not found (no DDL) — a unique constraint on username/email is implied by 23505 handling in code, not confirmed via schema.
- **Validation:** ad hoc in controllers (regex/`isUuid` checks), no DB-level check constraints visible.
- **Missing fields:** no `deleted_at` (no soft delete anywhere in the system), no `password_changed_at` (can't detect stale/first-login-only passwords), no MFA fields.
- **Potential improvements:** drop `plain_password` entirely and replace the "admin needs to hand out credentials" use case with a one-time reset-token flow instead of persistent plaintext storage (see §9 #3).

### `franchises`
- **Fields:** id (uuid, PK), name, logo_url, logo_alt, status, settings (jsonb: websiteUrl, contactNumber), created_at, updated_at.
- **Relationships:** parent of elections, users, voter_groups, election_groups.
- **Indexes/Validation:** Not found.
- **Missing:** no soft delete; deleting a franchise's cascading behavior on elections/users is **unverified** — could orphan or hard-fail, needs explicit test.

### `elections`
- **Fields:** id, franchise_id (FK), organization, title, election_date, number_to_be_elected, nominee_display_order, max_voters, max_nominees, gender_based_selection, male_minimum, female_minimum, self_reg_open, voting_open, results_published, results_published_at, voter_result_display (enum-like), admin_voting_details_enabled, manual_winner_selection, manual_winner_ids (array, FK→nominees), created_by, status, logo_url/alt, election_group_id (FK), created_at, updated_at.
- **Relationships:** franchise_id→franchises, election_group_id→election_groups, manual_winner_ids→nominees (array FK, not enforceable by Postgres FK constraint directly — likely unconstrained at DB level).
- **Indexes:** Not found — status/franchise_id would benefit from a composite index for list-filter queries (see §10).
- **Validation:** enum-like `status` is a free string column in Postgres (only enforced in Mongo's parallel schema) — **DB does not actually constrain status values**, relies entirely on app code.
- **Missing:** no `closed_at`/scheduled-job timestamp — lifecycle transitions are lazy/read-triggered (see §10), which is a functional risk, not just a DB gap.
- **Potential improvements:** add a real Postgres `CHECK` constraint or enum type for `status`; add a scheduled job (cron/Edge Function) to close elections at `election_date` instead of relying on next-read recomputation.

### `nominees`
- **Fields:** id, election_id (FK), name, gender, position, photo_url/alt, bio, additional_info, status, created_at, updated_at.
- **Relationships:** election_id→elections; referenced by vote_nominees.nominee_id, elections.manual_winner_ids.
- **Missing:** no unique constraint visible preventing duplicate nominee names within one election (frontend does a client-side duplicate check per commit history, not a DB guarantee).

### `votes`
- **Fields:** id, election_id (FK), voter_id (FK→users), ip_address, device_info, status, voted_at, created_at, updated_at.
- **Relationships:** election_id→elections, voter_id→users; join to nominees via vote_nominees.
- **Indexes:** unique `(voter_id, election_id)` implied by 23505-based duplicate-vote handling — **this is the single most important constraint in the whole schema** (prevents double voting) and its existence is inferred only from error-code handling, not confirmed — **should be explicitly verified against the live Supabase schema**, since if it doesn't actually exist, double-voting is a race-condition risk.
- **Potential improvement:** confirm/add that unique constraint explicitly at the DB level (don't rely solely on app-level `checkVoterStatus` before insert — TOCTOU race).

### `vote_nominees` (join)
- **Fields:** vote_id (FK), nominee_id (FK). Missing fields: no `created_at`. No composite PK confirmed.

### `user_election_access` (join)
- **Fields:** user_id (FK), election_id (FK). Unique `(user_id, election_id)` implied by upsert `onConflict` usage.

### `voter_groups`, `voter_group_voters`, `voter_group_elections`
- Standard grouping + two join tables for many-to-many voter↔group and group↔election. Fields: id, franchise_id, name, description, prefix, starting_number, created_by, timestamps.

### `election_groups`, `election_group_elections`
- Same pattern as voter groups, for grouping elections (e.g., annual cycles).

### `election_analytics`
- **Fields:** id, election_id (FK), total_voters, total_votes_cast, pending_voters, nominee_results (jsonb?), last_updated, is_finalized, created_at, updated_at.
- **Potential improvement:** this looks like a materialized/cached aggregate table — confirm whether it's kept in sync via triggers or app-level writes only (app-level = drift risk if votes are ever inserted/deleted outside the normal flow).

### `audit_logs`
- **Fields:** id, user_id (FK, nullable), action, entity_type, entity_id, ip_address, details (jsonb), created_at.
- **Missing:** no retention/partitioning strategy visible (fine at current scale, a concern at high volume); write failures are silently swallowed (`console.error` only, see §9 #15).

### MongoDB `elections` (legacy)
Mirrors the Supabase `elections` table exactly (see `model/Election.js`). Dangling Mongoose `ref`s to `Franchise`, `Nominee`, `User`, `ElectionGroup` models that **don't exist in this codebase** (harmless since only `franchiseId` is ever `.populate()`d).

**Overall DB-report conclusion:** No schema-as-code exists for the Postgres side (no full-schema SQL, no ORM model definitions, no Supabase migration history in-repo beyond 3 incremental `ALTER TABLE` files). This is a significant documentation/reproducibility gap — the actual source of truth is whatever's live in the Supabase dashboard, which cannot be verified from the repo alone. **Recommend exporting the live schema to a versioned `schema.sql` or adopting Supabase CLI migrations.**

---

## 6. API Report

Base path: `/api/v1`. `protect` = JWT required. Auth column shows role gate if any.

| Method | URL | Auth | Role gate | Notes/Issues |
|---|---|---|---|---|
| POST | /auth/login | none | — | No rate limiting |
| POST | /auth/forgot-password | none | — | No OTP/email verification — insecure (§9) |
| GET | /auth/me | protect | any | |
| PUT | /auth/me | protect | any | |
| POST | /auth/change-password | protect | any | |
| POST | /user | protect | admin | |
| GET | /user | protect | admin | |
| GET | /user/franchise-admins | protect | franchise/super | |
| GET | /user/election-admins | protect | franchise/super | |
| GET | /user/voters | protect | admin | |
| POST | /user/voters | protect | admin | |
| POST | /user/voters/generate | protect | admin | **Bug:** `generateVoters` references undefined `createdIds` when a voter group is passed — throws 500 after voters are already created (`controllers/user.js:434`) |
| DELETE | /user/voters/:id | protect | admin | |
| POST | /user/franchise-admin | protect | super_admin only | |
| POST | /user/election-admin | protect | franchise/super | |
| GET/PUT/DELETE | /user/:id | protect | admin | |
| POST | /user/:id/reset-password | protect | admin | |
| POST | /franchise | protect | super_admin only | file upload (logo) |
| GET | /franchise | protect | admin | |
| GET | /franchise/:id | protect | controller-level check | |
| PUT | /franchise/:id | protect | franchise/super | file upload |
| DELETE | /franchise/:id | protect | super_admin only | |
| POST/GET/GET/PUT/DELETE | /auditLog[/:id] | protect | admin | |
| GET | /electionAnalytics/dashboard | protect | admin | |
| POST | /electionAnalytics/remind/:electionId | protect | admin | no confirmed frontend caller found |
| POST/GET/GET/PUT/DELETE | /electionAnalytics[/:id] | protect | admin | |
| ALL | /electionGroup/* | protect | franchise/super only (not election_admin) | |
| POST | /election | protect | admin | file upload |
| GET | /election | protect | admin | |
| PATCH | /election/:id/publish | protect | admin | |
| PATCH | /election/:id/manual-winners | protect | admin | force-locks election to completed |
| GET | /election/:id | protect | **none** (intentional — voters need ballot access) | controller enforces `denyUnlessCanAccessElection` |
| PUT/DELETE | /election/:id | protect | admin | blocked if locked (completed/archived) |
| POST | /nominee | protect | admin | file upload |
| POST | /nominee/bulk | protect | admin | |
| GET | /nominee/election/:electionId | protect | any authenticated | controller checks election access |
| GET | /nominee | protect | admin | |
| GET/PUT/PATCH/DELETE | /nominee/:id | protect | admin | |
| **POST** | **/vote** | protect | **none** | **CRITICAL — no ownership/access/duplicate/window check; forgeable votes** (§9 #2) |
| **GET** | **/vote** | protect | **none** | **CRITICAL — returns every vote system-wide to any authenticated user, breaks ballot secrecy** (§9 #1) |
| GET | /vote/available-elections | protect | any | |
| GET | /vote/voter-status | protect | any | |
| GET | /vote/results/:electionId | protect | any (scoped in controller) | |
| GET | /vote/details/:electionId | protect | admin | |
| GET | /vote/my-vote/:electionId | protect | any | |
| POST | /vote/cast/:electionId | protect | any | this is the real, properly-guarded voting endpoint |
| ALL | /voterGroup/* | protect | admin | |
| POST | /onboarding/complete | protect | any | |
| GET | /onboarding/status | protect | any | |
| GET | /notifications | protect | any valid role | underlying persistence model **not fully verified** — flagged "Not Found" for confirmation |

**Request/response bodies, per-field validation, exact error codes:** not exhaustively itemized here for all ~50 endpoints (would roughly double this report's length) — pattern is consistent: JSON body, ad hoc field presence/format checks in-controller, standard `{success, message, data}`-shaped responses, no shared validation schema (no `zod`/`joi` on the backend despite the frontend using `zod`).

**Unused/dead APIs:** `updateFranchise`/`deleteFranchise` (body/query-id style), `updateVote`/`deleteVote`, `updateNominee`/`deleteNominee`, `updateElectionGroup`/`deleteElectionGroup`, `assignVotersToElection` — all exported from controllers but never mounted in any route file. Dead code, not reachable, but should be deleted to avoid confusion/accidental re-wiring.

**Duplicate APIs:** the unmounted handlers above are literal duplicates of the RESTful `...ById` versions that *are* routed — functionally redundant, differing only in whether the id comes from `params` vs `body`/`query`.

**Auth documentation:** Swagger spec exists (`/api-docs`) but is unpolished (placeholder title/host) and **publicly accessible with no auth**, exposing the full endpoint/parameter map for reconnaissance.

---

## 7. Frontend Report

25 page files (22 live-routed). Common patterns observed across pages:

- **Tables:** `Voters.tsx`, `Franchises.tsx`, `Admins.tsx`, `Reports.tsx`, `AuditLogs.tsx`, `Elections.tsx`, results pages — all use a table + bulk-select/delete bar (`bulk-selection-bar.tsx`, `delete-mode-bar.tsx`) + `pagination-controls.tsx`. Reasonably consistent pattern for admin list pages.
- **Forms:** `ElectionForm.tsx`, `NomineeForm.tsx` use `react-hook-form` + `zod` resolvers (good — validated forms). `Login.tsx`, `ForgotPassword.tsx`, `Onboarding.tsx` simpler controlled-input forms.
- **Charts:** `recharts`-based, concentrated in `analytics/VotingStats.tsx`, `ElectionResultsSummary.tsx`, `Dashboard.tsx` stat visuals.
- **Filters:** `ElectionFilters.tsx` (status/franchise/date), ad hoc search inputs on list pages.
- **Loading states:** present via Skeleton components on most pages, but **inconsistent** — some pages use plain "Loading..." text, some raw spinner `<div>`s.
- **Empty states:** present on major list pages, not verified uniformly across all 25.
- **Error handling:** **inconsistent** — mix of a shared `Alert` component and raw red-text `<div>`s; `ElectionGroups.tsx` captures `isError` from its query but never renders it (silently fails).
- **Responsive:** Yes — `Sidebar` (desktop) + `BottomNav` (mobile, `lg:hidden`) for staff pages; `VoterLayout` with its own mobile-first header/bottom-nav for voter pages; list pages generally pair a desktop `<table>` with a mobile card list.
- **Accessibility:** sparse. A handful of `aria-label`s, one `aria-live` region, one `<nav aria-label>`. Most pages are `<div>`-heavy (shadcn `Card`/custom layout) rather than semantic HTML — only `AuditLogs.tsx` uses a raw `<table>` element directly. No skip-links, no confirmed keyboard-nav audit, no confirmed screen-reader testing.

**Per-page detail table (condensed — full per-page breakdown available on request, omitted here to keep this section readable):**

| Page | Forms | Tables | Charts | Loading | Error | Notes |
|---|---|---|---|---|---|---|
| Dashboard | — | Recent elections | Stat cards | Skeleton | Alert | Role-aware widget toggling |
| Elections | ElectionForm | ElectionsTable | — | Skeleton | Alert | Filters via ElectionFilters |
| Voters | Voter forms | VotersTable | — | Skeleton | Alert | Bulk generate/select/delete |
| Franchises | Franchise form | table | — | Skeleton | **plain red text** (inconsistent) | super_admin only |
| Admins | Admin creation form | table | — | Skeleton | Alert | super_admin only |
| Reports | — | results/stat tables | recharts | Skeleton | Alert | |
| AuditLogs | — | raw `<table>` | — | Skeleton | Alert | super_admin only, most accessible markup of any page |
| VotingBallot | BallotForm | — | — | Skeleton | mixed Alert/inline red box | voter |
| VotingResults | — | ResultsTable | recharts | Skeleton | mixed | voter, visibility-gated |
| VotingPortal | — | VoterElectionList | — | Skeleton | mixed | acts as voter's "dashboard" |
| ElectionGroups (dead) | — | — | — | — | **isError captured, never rendered** | orphaned page |

---

## 8. Dashboard Report

Single unified `Dashboard.tsx`, not role-separate dashboards, but conditionally rendered widgets by role:
- **Widgets (all admin roles):** 3 `StatCard`s (Active Elections, Registered Voters, Votes Cast), `RecentElectionsTable`.
- **Widgets (super_admin/franchise_admin only):** `FranchiseOverview` — cross-franchise or franchise-level breakdown.
- **Quick actions:** `QuickActions.tsx` component exists (create election / add voter shortcuts, inferred from name — confirm exact contents if needed).
- **Recent activity feed:** `RecentElectionsTable` is the closest analog; there is **no generic "recent activity"/timeline feed** across all entity types (not found).
- **Notifications:** `NotificationBell.tsx` in header — backend model for persisted notifications **not fully verified** (flagged "Not Found" pending confirmation).
- **Missing analytics:** no turnout-over-time trend chart, no franchise-comparison chart beyond the overview widget, no system-health/API-monitoring widget, no election-completion-rate/SLA tracking.
- **Voter's "dashboard":** `VotingPortal.tsx` — list of available elections + voting status, not a stats dashboard (appropriately, since voters don't need admin metrics).

---

## 9. Security Audit

Findings ranked by severity (Critical → Low). All findings are from static reading of the code — not independently penetration-tested against a live instance.

### Critical
1. **Ballot secrecy broken — `GET /api/v1/vote/`** returns every vote in the system (all franchises, all elections, including which nominee(s) each voter picked) to **any authenticated user**, including a plain `voter`. No `authorize()` role gate, no franchise/election scoping. This is a severe broken-access-control issue — a single voter account can dump every ballot ever cast.
2. **Vote forgery — `POST /api/v1/vote/`** accepts an arbitrary `{electionId, voterId, nominees}` body from any authenticated user and inserts it directly with **no** ownership check (can set `voterId` to someone else), no `canAccessElection` check, no duplicate-vote guard, no `votingOpen`/window check, no nominee-belongs-to-election check. This endpoint appears to be legacy and unused by the frontend (which correctly uses the properly-guarded `POST /vote/cast/:electionId`), but it is still live and routed — should be deleted or locked down immediately.
3. **Plaintext passwords persisted at rest** — `users.plain_password` column stores the cleartext password for every admin-created/bulk-generated voter/admin account, cleared only when the *user themself* changes password (not on admin-side `updateUser`). A DB compromise or an overprivileged/misconfigured query exposes live credentials for potentially every voter in the system.
4. **`forgotPassword` has no proof-of-ownership** — resets on username+email match alone, no OTP/emailed link, no rate limiting. Trivially abusable for account takeover if a voter's username/email pattern is guessable (often true for org-generated accounts).

### High
5. **No rate limiting anywhere** (login, forgot-password, all endpoints) — brute-forceable; no `express-rate-limit` or equivalent present.
6. **Login/change-password fallback to plaintext string comparison** if `bcrypt.compare` throws (`password === user.password`) — a malformed/non-bcrypt password value becomes silently login-able rather than failing closed.
7. **No security headers** — no `helmet`, no CSP/HSTS/X-Frame-Options/X-Content-Type-Options anywhere in `index.js`.
8. **Swagger docs publicly exposed with no auth** at `/api-docs` — full endpoint map reconnaissance, low direct risk but should be gated or removed in production.
9. **File uploads validated by MIME-type header only** (`multer` `fileFilter` on `req.file.mimetype`, and the base64 path validates only the `data:image/...` string prefix) — no magic-byte/content sniffing despite `sharp` being an available (but unused-for-this-purpose) dependency. A client can lie about content-type.

### Medium
10. **JWT has no revocation mechanism** — 24h stateless token, no server-side session store; a stolen token or a token issued before a forced password reset/role change stays valid for its full lifetime.
11. **No CSRF-specific protection**, but risk is low since auth is bearer-token-in-header (no auth cookies observed) — noted as low residual risk, not a gap requiring immediate action.
12. **No shared input-validation schema on the backend** (`zod`/`joi` absent server-side despite being used client-side) — validation is ad hoc per controller; consistent in most places (`isUuid` guards before DB calls) but a controller author forgetting a check is a silent gap (as in findings #1/#2 above).
13. **`findByUsernames` builds a `.or()` PostgREST filter string via manual `.join(",")`** (`lib/supabase/users.js:353`) rather than using an escaped builder like `buildIlikeOrFilter` elsewhere in the codebase — low exploitability today (inputs are server-generated), but a fragile pattern that should be unified.
14. **Audit log write failures are silently swallowed** (`console.error` only) — a broken logging path drops audit trail entries with no alerting, undermining the audit trail's reliability for compliance/incident response.
15. **JWT secret and Supabase service-role key sit in a local plaintext `.env`** — properly `.gitignore`'d (not leaked to VCS), but flagging that anyone with filesystem/deploy-target access has full admin (service-role bypasses RLS) and can mint arbitrary user JWTs. Standard secret-management practice (vault/secret manager) recommended over `.env` for production.

### Low
16. **Client-side JWT + user profile stored in plain `localStorage`** (not httpOnly cookie) — standard SPA tradeoff, but means any XSS anywhere in the app fully compromises the session; no XSS vector was found (only one `dangerouslySetInnerHTML`, non-user-controlled, in a shadcn chart-style helper), so currently low risk in practice.
17. **Dead/orphaned code increases attack surface for future mistakes**: unmounted duplicate controller handlers (backend), orphaned `server/routes/*.ts` + `server/config/cloudinary.ts` referencing nonexistent middleware/controllers (frontend proxy server) — not currently exploitable (unreachable) but should be deleted, not left as a trap for future re-wiring.
18. **`config/whatsapp.js` has hardcoded placeholder secret-like strings** (`"your-whatsapp-secret"`) — dead code, unused, but shouldn't ship even as an unused artifact.
19. **CORS allow-list passes requests with no `Origin` header through unconditionally** — normal for non-browser/server-to-server clients given bearer-token auth (no cookies), flagged for awareness rather than as a fix-required item.

### Confirmed NOT an issue
- SQL injection: not applicable — no raw SQL string interpolation into queries found (Supabase query-builder / parameterized under the hood), except the low-risk `.or()` filter pattern above.
- NoSQL injection: Mongo usage is limited to a single legacy model queried by parameterized Mongoose methods — no raw `$where`/string-eval patterns found.

---

## 10. Performance Audit

- **Election lifecycle is read-triggered, not scheduled** (`syncElectionLifecycle`) — an election that should auto-close at midnight on its election date doesn't actually flip to "completed" until the next time any client fetches it. For low-traffic elections this could leave a stale "active" status for hours/days. Recommend a scheduled job (cron / Supabase Edge Function / DO App Platform scheduled job) to proactively close elections.
- **No pagination confirmed at the API layer for some list endpoints** (e.g., `getVotes`, `getUsers`) — combined with the vote-enumeration bug (§9 #1), an unscoped `getVotes` call against a large system could return an unbounded result set; `pagination-controls.tsx` exists client-side but its actual wiring to server-side `LIMIT`/`OFFSET` params wasn't confirmed for every list endpoint — recommend verifying and enforcing server-side pagination/limits everywhere.
- **No caching layer** (no Redis, no in-memory cache, no HTTP cache headers strategy for API responses) — every dashboard/analytics load re-queries Supabase live. Fine at current scale, worth revisiting if franchise/election counts grow.
- **`election_analytics` looks like a manually-maintained aggregate table** — if it's updated only in application code (not DB triggers), it's at risk of drifting from the true `votes` count under concurrent writes or partial failures; worth confirming.
- **No confirmed N+1 query patterns** in the backend controllers reviewed (Supabase queries generally fetch related data via explicit joins/`select` strings rather than per-row loops), but this wasn't exhaustively verified for every list endpoint.
- **No missing-index findings can be made with confidence** since no DDL/index definitions exist in-repo — this is itself the finding: **index strategy is unverifiable from the codebase alone.**
- **Frontend bundle size**: not measured (no `vite build` was run as part of this read-only audit); the dependency list is heavy (many Radix packages, `framer-motion`, `xlsx`, `jspdf`) — worth a bundle-analyzer pass given this is a PWA targeting mobile devices.
- **Lazy loading**: no route-based code-splitting (`React.lazy`/dynamic `import()`) was found in `App.tsx`'s route table — all 25 pages likely bundle into fewer, larger chunks rather than per-route chunks. Recommend `React.lazy` per page for a PWA targeting mobile/low-bandwidth users.

---

## 11. UI/UX Audit

General assessment: clean, consistent shadcn/Tailwind design system with reasonable mobile-first layout (Sidebar/BottomNav split), but execution consistency varies page to page (loading/error patterns), and several "batteries included but not wired up" gaps (dark mode, accessibility, offline support). Scores are directional (based on code-level signals: presence of loading/empty/error states, semantic markup, responsive patterns) — not a substitute for an actual usability test session with real users.

| Page | Score /10 | Notes |
|---|---|---|
| Dashboard | 7 | Clean widget layout, role-aware; no activity timeline |
| Login | 7 | Simple, standard; no rate-limit feedback (backend gap, not UI) |
| Elections | 7 | Good filters/table pattern |
| Voters | 7 | Strong bulk-action tooling (select/delete/generate/slip print) |
| Franchises | 5 | Inconsistent error UI (plain red text vs shared Alert) |
| Admins | 6 | Functional, less polish than Voters page |
| Reports | 6 | Charts present, not verified for empty-state handling |
| AuditLogs | 7 | Best semantic markup (real `<table>`) of any page |
| VotingBallot | 7 | Core user-facing flow, reasonably polished |
| VotingResults | 6 | Visibility-mode logic is good; mixed error-UI pattern |
| VotingPortal | 7 | Effective voter "dashboard" replacement |
| ElectionGroups/VoterGroups (dead pages) | 2 | Orphaned, half-finished, silently swallow errors |

**Cross-cutting notes:**
- **Consistency:** Good at the component level (shared shadcn primitives), weaker at the page level (loading/error patterns diverge).
- **Dark mode:** Styled but **not reachable** — no toggle, no `ThemeProvider`. Effectively a missing feature despite the CSS being there.
- **Mobile responsiveness:** Strong — deliberate Sidebar/BottomNav split, card-vs-table pattern for lists.
- **Accessibility:** Weak — minimal ARIA usage, mostly non-semantic `<div>`-based markup. Needs a dedicated a11y pass (labels, focus management, contrast check, keyboard nav) before any government/enterprise deployment.
- **Navigation:** Clear role-based sidebar/bottom-nav; no breadcrumbs on deep pages (e.g., election → results), minor.
- **Search/Filter/Sort:** Present on major list pages (`ElectionFilters`, table search inputs); no global/cross-entity search (see §13).
- **Feedback/animations:** `framer-motion` present, likely used for transitions/prompts (`InstallPrompt`/`UpdatePrompt`); toast notifications via shadcn `toast` component — standard, adequate.
- **Professional appearance:** Generally yes — consistent shadcn design language reads as a modern SaaS product, not a prototype, aside from the dead/orphaned pages which would look broken if accidentally exposed.

---

## 12. Code Quality

- **Folder structure:** Logical and conventional for both apps (routes/controllers/lib/model on the backend; pages/components/lib on the frontend). No major structural complaints.
- **Naming:** Consistent camelCase (JS/TS) and clear, descriptive names throughout the sampled files.
- **Reusability:** Good on the frontend (shared `ui/` primitives, `pagination-controls`, `bulk-selection-bar`, `export-menu` reused across list pages). Weaker on the backend where the same duplicate-vs-canonical CRUD handler pattern repeats across 5 controllers (see §6 dead code) and role-derivation logic is reimplemented in ~5 different frontend components instead of a shared hook/context.
- **Component architecture:** Reasonable page/feature/ui three-tier split; no obvious "god component" was flagged during the audit, though `App.tsx`'s `AuthWrapper` (216 lines, handling auth + onboarding + role-guard + redirect logic all in one place) is a candidate for extraction into a dedicated auth context/provider.
- **Hooks:** Standard TanStack Query hooks per page, no custom domain hooks abstracting common query patterns (e.g., no `useElections()`, `useVoters()`) — each page hand-rolls its own `useQuery` calls, causing some duplication.
- **State management:** TanStack Query for server state (appropriate choice), no global client-state library — fine given the app's shape, though the manual `localStorage` user/token reads scattered across components function as ad hoc, uncoordinated "global state."
- **Error handling:** Inconsistent, as documented in §7/§11 — a mix of shared `Alert` components, raw markup, and at least one silently-swallowed error (`ElectionGroups.tsx`).
- **Logging:** Backend uses `console.error` for failures (including audit-log write failures) — no structured logging (no `pino`/`winston`), no log levels, no correlation IDs, nothing shipped to an external log aggregator confirmed. `utils/errorLog.js` exists — a centralized helper — but its actual usage breadth wasn't fully audited; worth confirming it's used consistently rather than ad hoc `console.error` calls.
- **Constants/Utilities:** `lib/roles.js`, `lib/electionAccess.js`, `lib/entityId.js` are good centralized utility modules on the backend. Frontend's `lib/entityId.ts` duplicates the backend's id-classification logic rather than sharing it (two separate implementations of the same regex logic to keep in sync).
- **Duplicate code:** Confirmed in multiple places — (a) backend unmounted duplicate CRUD handlers (§6), (b) frontend role-derivation logic reimplemented per-component instead of centralized, (c) entity-id regex logic duplicated frontend/backend, (d) `lib/photoUpload.js`'s manual byte-limit check duplicating `middleware/upload.js`'s multer limit.
- **Technical debt (explicit list):**
  1. Backend `db_design.txt`/`note.txt`/`config/whatsapp.js` — leftover from an unrelated template project, should be deleted.
  2. Unmounted duplicate controller exports across 5 files — dead code, delete.
  3. Frontend `server/routes/*.ts` + `server/config/cloudinary.ts` — orphaned, references nonexistent modules, delete.
  4. `pages/VotingInterface.tsx`, `ElectionGroups.tsx`, `VoterGroups.tsx` — dead/superseded pages, delete or finish and re-route.
  5. Mongo↔Supabase dual-path logic in `lib/elections.js` — should be retired once the legacy Mongo migration is confirmed complete (tracked by the presence of active migration scripts, suggesting it isn't finished yet).
  6. `generateVoters`'s `createdIds` `ReferenceError` bug — active functional bug, not just debt (§6/§9).

---

## 13. Missing Enterprise Features

| Feature | Present? |
|---|---|
| Audit Logs | Present (basic) |
| Activity Timeline (cross-entity feed) | **Missing** |
| Notification System | Partial — bell UI exists, persistence model unverified |
| Email | Present in dependencies (`nodemailer`, `lib/email.js`) — usage scope not fully traced, treat as partial |
| SMS | **Not found** (WhatsApp config exists but is dead/unused, no SMS provider integration found) |
| 2FA/MFA | **Missing** |
| Export PDF | Present (client-side `jspdf`, voter slips) |
| Export Excel | Present (client-side `xlsx`) |
| Role Matrix (visual permission grid) | **Missing** (logic exists in code, no admin-facing UI to view/edit it) |
| Advanced/Global Search | **Missing** (per-page filters only, no cross-entity search) |
| Bulk Actions | Present (bulk voter generate, bulk select/delete) |
| Soft Delete / Restore | **Missing** (all deletes appear hard deletes — no `deleted_at` fields found) |
| Version History | **Missing** |
| Approval Workflow | **Missing** (e.g., no maker-checker flow for publishing results or creating elections) |
| Live Monitoring (real-time turnout) | **Missing** (analytics are pull/refresh-based, no websocket/live-update mechanism found) |
| Election Analytics / Turnout Analytics | Present (basic — counts, not trend-over-time) |
| Charts | Present (`recharts`) |
| System Health / API Monitoring dashboard | **Missing** |
| Backup / Disaster Recovery documentation or automation | **Not found** in-repo (may exist at the Supabase/DO infra level, outside code scope) |
| Settings page | Present (`/settings` route exists) — scope of what's configurable there not deeply audited |
| Localization (i18n) | **Missing** (no i18n library, all strings hardcoded in English) |
| Accessibility | Weak, see §11 |
| Dark Mode | Styled but **not user-reachable** (no toggle) |
| Feature Flags | **Missing** |
| Maintenance Mode | **Missing** |
| Offline Support | Partial — PWA caching configured, but explicit navigateFallback to offline page disabled by design (per code comment) |
| PWA | Present (manifest, service worker, install/update prompts) |
| Geographic/administrative hierarchy (state/district/constituency/booth) | **Missing entirely** — see §4 note |
| Rate limiting | **Missing** (§9) |
| Security headers (helmet/CSP) | **Missing** (§9) |
| Formal automated test suite (unit/integration/e2e) | **Missing** on both apps — only manual smoke/security scripts exist |

---

## 14. Production Readiness

| Dimension | Score /10 | Rationale |
|---|---|---|
| Architecture | 6 | Clean separation of concerns, but dual-DB migration debt and orphaned proxy-server code drag it down |
| Scalability | 6 | Stateless JWT + Supabase scales reasonably; no caching layer, unindexed-schema uncertainty, read-triggered lifecycle sync are limiting factors |
| Maintainability | 6 | Good naming/structure; duplicated logic (roles, entity-id, CRUD handlers) and dead code create drift risk |
| Security | **3** | Two critical broken-access-control findings (unscoped vote read/write), plaintext password storage, no rate limiting, no security headers, insecure password-reset flow |
| Performance | 6 | No confirmed major bottlenecks, but unverifiable index strategy and lazy lifecycle sync are real risks at scale |
| UI | 7 | Consistent, modern design system; execution polish varies |
| UX | 6 | Good mobile-first patterns; accessibility and error-state consistency need work |
| Documentation | **1** | No README anywhere in the repo (root, `election-api/`, or `election-portal/`); no schema docs, no architecture diagram, no API doc beyond an un-customized auto-generated Swagger file |
| Deployment readiness | 6 | DO App Platform + Netlify configs exist and look functional; no CI pipeline found for either app (only a `.github/workflows` dir with unknown/unverified contents in `election-api/`) |
| Testing | **1** | No automated test suite in either app; only manual CLI smoke/security scripts, not CI-wired |
| **Overall** | **~4.5/10** | Functionally fairly complete for a mid-size franchise voting product, but **not production-ready for anything handling real elections with real stakes** until the critical security findings (§9) are fixed, tests exist, and documentation is written. |

---

## 15. Missing Documentation

- **README** — none exists at repo root, `election-api/`, or `election-portal/`. Not found.
- **API Documentation** — Swagger auto-generated but placeholder/un-customized, not maintained as living docs. No Postman collection found.
- **Deployment Guide** — none in-repo (DO/Netlify config files exist, but no written runbook).
- **ER Diagram** — none. Especially needed given the schema only exists implicitly in code (§5).
- **Architecture Diagram** — none.
- **Flowchart** (election lifecycle / user workflow) — none; this report's §4 is likely the first written version of that workflow.
- **SRS (Software Requirements Specification)** — none found in either app (the `election-portal/attached_assets/` folder has a requirements PDF and Figma-style screenshots from early prototyping — that's design reference material, not a maintained SRS).
- **Database Schema (versioned)** — none; only 3 incremental `ALTER TABLE` scripts, no full baseline schema file.
- **Swagger** — present but incomplete/unpolished (see above).
- **Environment variable reference** — partially covered by `.env.example` comments in both apps, which is reasonably good, but not a standalone doc.
- **Contribution/coding-standards guide** — none found.

---

## 16. Final Recommendations — Top 50, Prioritized

**Critical**
1. Remove or properly gate `GET /api/v1/vote/` (ballot secrecy leak) — Easy
2. Remove or properly gate `POST /api/v1/vote/` (vote forgery) — Easy
3. Redesign `plain_password` storage — move to one-time reveal/reset-token flow instead of persistent plaintext — Medium
4. Add OTP/email-link verification to `forgotPassword` — Medium
5. Remove the plaintext-fallback branch in login/change-password bcrypt compare — Easy
6. Fix `generateVoters` `createdIds` `ReferenceError` bug — Easy
7. Add rate limiting to `/auth/login` and `/auth/forgot-password` at minimum, ideally globally — Medium
8. Verify (and if missing, add) the DB-level unique constraint on `votes (voter_id, election_id)` — Easy/Medium (needs live DB access)

**High**
9. Add `helmet` + baseline security headers (CSP, HSTS, X-Frame-Options) — Easy
10. Gate or remove public `/api-docs` in production — Easy
11. Add magic-byte/content validation to file uploads (not just MIME header) — Medium
12. Add a scheduled job to close elections at `election_date` instead of relying on lazy read-triggered sync — Medium
13. Write a root-level and per-app README (setup, architecture, env vars) — Easy
14. Export/version the live Supabase schema as SQL, commit it — Easy
15. Delete dead backend files: `db_design.txt`, `note.txt`, `config/whatsapp.js` — Easy
16. Delete dead frontend files: orphaned `server/routes/*.ts`, `server/config/cloudinary.ts`, `pages/VotingInterface.tsx` — Easy
17. Delete unmounted duplicate CRUD controller exports (5 files) — Easy
18. Add an automated test suite (start with the two critical vote endpoints + auth flow) for both apps — Hard
19. Centralize frontend auth/role state into a single context/provider instead of ~5 components independently reading `localStorage` — Medium
20. Add server-side input validation schema (`zod`/`joi`) to close gaps like findings #1/#2 systematically — Medium
21. Confirm and enforce server-side pagination on all list endpoints (`getVotes`, `getUsers`, etc.) — Medium

**Medium**
22. Add 2FA/MFA at least for admin roles — Hard
23. Build a visual Role Matrix admin page — Medium
24. Add cross-entity global search — Hard
25. Add soft-delete (`deleted_at`) + restore for franchises/elections/users — Medium
26. Add an approval/maker-checker workflow for results publication — Hard
27. Finish or delete `ElectionGroups.tsx`/`VoterGroups.tsx` orphaned pages — Medium
28. Wire up dark mode (`ThemeProvider` + toggle) since the CSS already exists — Easy
29. Add route-based code splitting (`React.lazy`) for the 25-page bundle — Medium
30. Standardize loading/empty/error UI patterns across all pages (one `Alert`/`Skeleton` convention) — Medium
31. Fix `ElectionGroups.tsx` swallowed `isError` — Easy
32. Add structured backend logging (pino/winston) with request correlation IDs — Medium
33. Add CI pipeline (lint/typecheck/test) for both apps — Medium
34. Confirm/replace the `.or()` filter string-join pattern in `findByUsernames` with the existing escaped `buildIlikeOrFilter` helper — Easy
35. Add DB check constraint/enum for `elections.status` instead of a free string — Easy
36. Add ER diagram + architecture diagram to repo docs — Easy
37. Confirm notification persistence model (`/notifications`) and document it, or build it if missing — Medium
38. Add accessibility pass: semantic HTML, ARIA labels, keyboard nav, contrast check — Hard
39. Add turnout-over-time analytics/trend charts — Medium
40. Add system-health/API-monitoring dashboard — Hard
41. Deduplicate `lib/entityId.js`/`shared/entityId.ts` into one shared package if a monorepo tooling switch is feasible — Medium
42. Add audit-log write failure alerting (not just `console.error`) — Easy
43. Retire the Mongo legacy path once migration is confirmed fully complete — Medium

**Low**
44. Add i18n/localization support — Hard
45. Add feature flags for staged rollout of new features — Medium
46. Add a maintenance-mode toggle — Easy
47. Enable a real offline fallback experience for the PWA (currently deliberately disabled) — Medium
48. Add breadcrumbs on deep admin pages (election → results) — Easy
49. Add a Postman collection alongside/instead of relying solely on Swagger — Easy
50. Polish Swagger metadata (title/host) if keeping it — Easy

---

## 17. Executive Summary

**Strengths:** A coherent, reasonably modern full-stack architecture (Express/Supabase + React/Vite/shadcn), a genuinely well-thought-out RBAC model (`lib/roles.js`/`lib/electionAccess.js` are the strongest code in the repository — clear hierarchy, fail-closed defaults, franchise/election-level scoping), a properly-guarded core voting endpoint (`castVote`), a working PWA shell, and decent mobile-responsive UI patterns. The one existing security regression test (`security-franchise-scope-test.js`) shows the team is at least aware of tenant-isolation risk and has validated it for the paths it covers.

**Weaknesses:** Two critical broken-access-control bugs on legacy vote endpoints undermine the very RBAC model the rest of the system does well. Plaintext password storage and an unverified password-reset flow are serious data-protection gaps. Zero automated test coverage and zero documentation (no README anywhere) make the codebase risky to hand off or scale a team around. Meaningful amounts of dead/orphaned code (leftover-template files, unmounted duplicate handlers, an entirely unwired second Express router in the frontend proxy) suggest incomplete cleanup after refactors/migrations, and the Mongo→Supabase migration itself is still mid-flight.

**Biggest risks:** (1) the unscoped `/vote` GET/POST endpoints — a live, exploitable ballot-secrecy and vote-forgery issue in an *election* system, which is about as bad a place for that class of bug to exist as any; (2) plaintext password persistence; (3) the total absence of automated tests, meaning any of the above could regress silently; (4) the total absence of documentation, meaning institutional knowledge lives only in the (uncommented) code.

**Most impressive parts:** the RBAC/access-scoping library (`lib/roles.js`, `lib/electionAccess.js`) and the election lifecycle/winner-computation logic (`lib/electionLifecycle.js`, gender-based seat reservation) — both show real domain thinking, not boilerplate CRUD.

**Overall maturity:** Solid mid-stage MVP / pre-production product. Feature-complete for a straightforward single-tier (franchise → election → voter) election use case; not yet hardened, tested, or documented to the level required for anything with real legal/electoral stakes.

**Suitability:**
- **College project:** Overqualified — this is well beyond typical student-project scope and polish.
- **Startup MVP:** **Yes, suitable** — with the critical security fixes (§16 items 1–8) applied first. Good enough to demo, pilot with real (low-stakes, internal) customers, and iterate on.
- **Government use:** **Not suitable as-is.** Missing the administrative hierarchy a government election implies (state/district/constituency/booth — see §4), missing 2FA, missing audit rigor commensurate with legal elections, missing the two critical vote-endpoint fixes, no independent security assessment, no compliance documentation. Would require substantial additional work and a formal third-party security audit before any government deployment.
- **Enterprise use:** **Not yet, but closer than government.** For an internal-enterprise election use case (e.g., corporate board elections, association voting), this is a plausible foundation once the critical/high items in §16 are addressed, tests exist, and documentation is written. As shipped today, the missing test suite and documentation alone would fail most enterprise procurement/security-review gates.
