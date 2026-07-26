# Vote+ Project Release Readiness

**Owner:** Project management and release validation  
**Updated:** 2026-07-26  
**Primary platform:** Mobile web/PWA  
**Release standard:** A journey is complete only when its permissions, loading, empty, error, success, and mobile interaction states are verified.

## Roles and primary journeys

### Super administrator

- Sign in, session validation, sign out, and account switching
- Complete onboarding
- View global dashboard
- Create, edit, and remove franchises
- Create, reset, and remove franchise administrators
- View and manage elections across franchises
- View reports and audit logs
- Update profile and password

### Franchise administrator

- Sign in, onboarding, sign out, and account switching
- View organization-scoped dashboard
- Create and manage elections for their organization
- Create and manage election administrators
- Create, import, generate, edit, export, and group voters
- Assign voters and groups to elections
- Create and manage nominees
- Close elections, select winners, publish results, and export reports
- Update profile and password

### Election administrator

- Sign in and sign out
- View only assigned elections
- Manage nominees and eligible voters for assigned elections
- Monitor turnout and view permitted results
- Update profile and password
- Cannot create elections or manage other administrators

### Voter

- Sign in and sign out
- View assigned open elections
- Open ballot and review election rules
- Select the permitted number of nominees
- Review and confirm ballot
- Submit only once
- View vote status and permitted published results
- Update profile and password

## Cross-cutting release checks

| Area | Release requirement | Current status |
|---|---|---|
| Tenant isolation | No cross-organization records or assignments | Pass |
| Browser account isolation | Previous account data and cache cleared | Pass |
| Role navigation | Only complete, permitted journeys are visible | Pass after role-flow correction |
| Mobile touch controls | Minimum practical 44px targets | Pass |
| Mobile navigation | Safe-area aware and consistent | Pass |
| Forms | Consistent fields, errors, cancel/save actions | Pass |
| Dialogs | Bottom sheets on phones, centered on larger screens | Pass |
| Loading/empty/error states | Present on all primary data screens | Pass on primary journeys; edge screens need authenticated QA |
| Type safety | Frontend type check | Pass |
| Production build | Portal and PWA build | Pass |
| API syntax/startup | API validation and Supabase connection | Pass |
| Authenticated browser journeys | All four roles | Blocked by local-browser policy and unavailable test credentials |
| Double-vote database constraint | Unique voter/election vote | Migration approved and ready; database access is required to apply it |
| Password storage | Printable without normal-list exposure | Encrypted reprinting implemented; production migration requires database access |
| Login protection | Rate limiting and abuse protection | Pass for login rate limiting; structured monitoring still recommended |

## Release blockers

1. Provide production database access so the approved credential, unique-vote, and ballot-rule migrations can be applied.
2. Provide non-production test accounts for all four roles and an accessible test URL, then complete authenticated mobile browser testing.
3. Add structured security-event monitoring and complete a final accessibility and penetration test before a consequential election.

## Credential printing

- New voter credentials open immediately in the printable/PDF slip flow.
- Authorized organization administrators can later reprint the existing credential without resetting it.
- Recoverable credentials are encrypted at rest and excluded from ordinary voter-list responses.
- Every credential retrieval is organization-scoped and recorded in the audit log.
- The migration encrypts legacy readable credentials before removing the old plaintext column.

## Ballot configuration

Election creation and editing now provide two enforced choices:

- **Exactly N:** the voter must fill every configured position.
- **Up to N:** the voter must select at least one nominee and may stop below the configured limit.

Existing elections default to **Exactly N** when the migration is applied.

## Verification completed

- Tenant-isolation regression: pass
- Live relationship audit: pass, with zero invalid tenant relationships and zero duplicate votes
- Authentication/security boundary regression: pass
- Role-navigation regression: pass
- Frontend type check: pass
- Production PWA build: pass
- API startup and Supabase connection: pass
- Source formatting/whitespace validation: pass

## Change-control rule

No feature is considered released from code inspection alone. Any change affecting permissions, ballots, results, passwords, organization ownership, or voting eligibility must pass an automated regression check and an authenticated journey test before production approval.
