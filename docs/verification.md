# Frontend verification

Verified September 27, 2026.

- Production build: `npm run build` passes.
- Lending model: `npm test` passes all 3 tests. Checks duplicate and own-copy requests, unavailable copies, conflicting requests, valid transitions, and availability after cancellation/return.
- Browser: added a book, refreshed and searched for it, confirmed persistence.
- Browser: requested the featured book and confirmed a pending request in Borrowing.
- Browser: accepted Sarah’s sample request, marked the copy handed over, marked it returned, and confirmed the history entry.
- Browser: reordered Jamie’s turn, selected an upcoming book, and recorded a past month.
- Responsive inspection: 320, 390, 768, and 1440 CSS-pixel widths; no horizontal overflow in narrow layouts. Native add-book dialog inspected at 320 pixels.
- All 8 cover images loaded with valid dimensions.
- Demo restored to the original sample records after testing.

Screenshots: `docs/screenshots/desktop.png` and `docs/screenshots/mobile.png`.

No real-device or cross-browser testing was performed. Lending and monthly picks remain local demo data; no real borrowing requests are delivered and there is no authentication or shared data backend.

## Kakao search integration

Verified September 27, 2026.

- `npm test`: 14 tests pass, covering lending, separate owned-copy IDs, preserved Korean metadata, ISBN normalization, validation, upstream errors, timeouts, deduplication, and safe cover URLs.
- `npm run build`: passes. Built frontend assets contain neither the server key variable nor the test secret.
- `.env.local` is ignored by Git; `.env.example` contains no credential.
- Local HTTP check: `/api/books?query=test` returns a safe 503 configuration message when the key is absent.
- Browser: searched a Korean title against the normal dev server and verified the missing-key message and manual fallback.
- Browser integration: a separate temporary server injected a Kakao-shaped fixture through the real handler. Korean search results rendered, edition selection populated metadata, saving created an owned copy, and the copy remained after reload. Manual registration also passed. The fixture server was then stopped; no fixture data is included in the production search path.
- Responsive check: selected edition at 390px and manual form at 320px fit without document or dialog horizontal overflow.
- Production deployment and live Kakao responses are **not verified**: they require the user’s Kakao REST API key and Vercel account setup.

Search UI screenshot: `docs/screenshots/book-search.png`.

## Invite-only member login

Verified September 27, 2026. This section supersedes the earlier frontend-only authentication status.

- `npm test`: all 27 tests pass. Auth tests run the real schema and SQL against isolated PostgreSQL (PGlite), including concurrent duplicate signup, Unicode name uniqueness, invalid invite codes, password verification, hashed session storage, expiry, logout/revocation, session rotation, CSRF rejection, durable limits, safe database-error handling, and protected book search.
- `npm run build`: passes. Built JavaScript contains neither the names nor the configured values of the server secrets. `git diff --check` passes.
- Browser against a temporary local test database: invalid code rejected; valid code registered a Korean-named member; profile displayed that member; session survived refresh; logout returned to the login screen; subsequent login succeeded with only name and password.
- The join form was checked at 320px and 390px without horizontal overflow. Browser error log was empty. Screenshots: `docs/screenshots/join-club.png`, `docs/screenshots/join-mobile.png` (test environment, empty registration form).
- Temporary test server stopped. Test credentials and accounts were never used with a production database.
- `CLUB_INVITE_CODE` is generated in git-ignored `.env.local`. The Acer PostgreSQL connection was subsequently configured through a local SSH tunnel; the schema migration succeeded, all three tables were found, and a session lookup returned `{ "member": null }`. No test account was created in that database. Neon and Vercel production deployment require separate verification.
- Accounts use the shared database; books, loans, monthly picks, and sample people remain member-scoped browser demo data. No password recovery or member administration UI is included yet.

## Neon setup and publication checks

Verified September 27, 2026.

- Linked the workspace to the supplied Neon project's `production` branch. The minimal `neon.ts` plan and apply both reported no infrastructure changes; PostgreSQL is the only configured service.
- Saved pooled and direct connection strings in ignored `.env.neon`, preserving the Acer settings in `.env.local`. Local Neon context and agent tooling are also ignored.
- Confirmed that the Neon public schema was empty, then ran the existing schema migration over the direct connection.
- Verified all three tables through the pooled connection. The app's auth handler queried Neon for an invalid session and returned HTTP 200 with `{ "member": null }`; unauthenticated book search returned HTTP 401. No test accounts were created.
- Vercel deployment and end-to-end signup on the public site remain unverified. Installed MCP configuration still requires client OAuth sign-in before MCP tools can be used; the CLI is authenticated.

## Sample-data cleanup

Verified September 29, 2026.

- Removed the built-in book collection, borrowing records, monthly history, and picking rotation. New member collections start empty.
- Added a one-time migration keyed by the original sample IDs that preserves member-added books and related records. Legacy local data is backed up before cleanup when storage is available. Removed the action that restored demo data.
- Automated checks cover clean initial state, preservation of member additions (including matching sample titles), dependent-record cleanup, and repeated loads. All 33 tests pass.
- Isolated browser preview: empty shelf, journal, picking order, borrowing list, and first-book guidance render; adding a book, recording the first monthly read, and scheduling an upcoming pick work and survive reload. No real accounts or database rows were created.
- Mobile widths 320 and 390 have no horizontal overflow. Browser error log is empty. Screenshot: `docs/screenshots/empty-shelf.png`.
- Club books, loans, and picks remain browser-local; shared persistence is not included in this change.
