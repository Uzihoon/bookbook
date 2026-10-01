# Book comments implementation plan

**Goal:** Signed-in club members can discuss a bookshelf entry inside its book-details popup; comments persist across devices and refreshes.

**Architecture:** Add an indexed comments table to the existing PostgreSQL schema and include comments in the authenticated club snapshot. Reuse revision-protected transactions, request limits, and session/origin checks. Bind authors to the authenticated member. Client-generated comment IDs make unchanged retries idempotent. Render plain text with author and Vancouver timestamp; only authors can delete their comments after an inline confirmation.

**Tech stack:** React, existing Vercel Node API, PostgreSQL/Neon, Node tests/PGlite.

## Steps

1. Extend `server/club.test.js` with persistence, author spoofing, invalid input, idempotent retry, book association, and deletion authorization cases. Run tests to observe missing functionality.
2. Add `club_comments` in `server/schema.sql`, snapshot projection and `addComment`/`deleteComment` actions in `server/club.js`, and display names/ownership in `src/club-state.js`. Run API tests.
3. Add `src/BookComments.jsx` below the details in `src/App.jsx`, plus responsive styles. Show ten newest initially, older comments on demand, empty/loading/error states, draft preservation and own-comment deletion confirmation.
4. Test on an isolated schema-only Neon branch with synthetic members. Verify migration idempotence, API persistence, and desktop/mobile UI. Run full tests and build.
5. Apply additive production schema while checking existing record counts, commit/push, verify Vercel routes, and remove test resources. Existing production records are preserved.

## Verification

- All 53 automated tests pass, including persistence, author spoofing, invalid content, duplicate retry, deletion authorization, and display ownership by ID.
- Isolated Neon integration passed using real sessions, two synthetic members, repeated schema application, shared reads, idempotent posting, and authorized deletion.
- Browser posted a Korean multiline comment and verified it after a full reload. Another member's comment has no Delete action. Own-comment deletion requires inline confirmation.
- Mobile checked at 390×844: page and dialog have no horizontal overflow, text wraps, and controls remain reachable. Screenshot uses test data only.
- Production migration preserved existing records; comments release deployed successfully.
- Reproduced the preceding rotation CI failure on Node 22.23.3 (tzdata 2026c): the test incorrectly assumed winter UTC-8 in January 2027. Vancouver adopted permanent UTC-7 in March 2026. The winter test now uses January 2026, where UTC-8 historically applied, while the application continues to use `America/Vancouver` from runtime timezone data.
