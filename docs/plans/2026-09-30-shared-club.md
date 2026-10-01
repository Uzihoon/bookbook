# Shared club persistence implementation plan

**Goal:** Make Bookbook's core club workflows persistent and shared across signed-in members and devices. Discard browser-only records as explicitly requested; preserve existing accounts.

**Architecture:** Keep the existing React/Vite frontend, Vercel Node functions, `pg`, and Neon. Add relational owned copies, loans, and monthly selections plus a shared revision. Serve a consistent authenticated snapshot and narrow POST commands at `/api/club`. Serialize writes in database transactions and require the displayed revision to prevent silent overwrites. No whole-state uploads or client-trusted identities. One invited club, no multi-club tenancy. All members may maintain monthly plans; only owners manage their copies and lender transitions, only borrowers make/cancel their own requests.

**Tech Stack:** React 19, Vite, Node 22, PostgreSQL/Neon, PGlite for isolated integration checks.

1. Add failing integration tests for authenticated reads, two-member persistence, owner enforcement, loan lifecycle, duplicate/conflicting requests, stale writes, safe validation, and monthly selections using actual member IDs.
2. Add an additive SQL migration and `/api/club` command handler/store. Keep auth/session data. Limit inputs, parameterize SQL, enforce same-origin JSON writes, use safe diagnostics, and return no secrets.
3. Replace local state mutations with a server-backed React hook: loading/error/retry, in-flight guarding, no false save success, refresh on focus and periodically, retain forms after failures. Delete only legacy Bookbook collection storage keys; never import them.
4. Wire book registration/availability, loans, monthly recording/planning/reordering, and a real member directory. Allow planning a turn before selecting a book. Show only permitted actions. Keep responsive design.
5. Verify unit/integration tests and production build. Run isolated browser workflows with multiple actual test accounts and a persistent test database; restart server to verify persistence. Check phone and desktop widths.
6. Verify migration on an isolated Neon branch, then apply the additive schema to production. Document environment/runbook and practical limits. Push, verify Vercel deployment and production authentication boundary; don't manufacture member records in production.

**Release boundary:** Core data and authorization must work. No email/notification delivery or self-service password recovery is promised. Small-club snapshots are acceptable initially; no storage in browser collections. Existing Neon restore policy remains unchanged and must be confirmed by the organizer for longer backup retention.

## Verification

- 36 tests pass on Node 22, including database-backed authorization and loan transitions; production build passes.
- A schema-only Neon branch accepted the migration twice. Two real authenticated accounts shared records across fresh route handlers; simultaneous writes returned one success and one conflict.
- Browser checks at 390px confirmed chooser selection and saving, Korean manual book registration, persisted login, and visibility after switching members. Screenshot: `docs/screenshots/shared-chooser-mobile.png` (isolated test data).
- Production migration created empty club tables and preserved the member count. No production test accounts or books were created.
