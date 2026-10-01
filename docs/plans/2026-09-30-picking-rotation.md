# Repeating picking rotation implementation plan

**Goal:** Keep one repeating member order, advance it by calendar month, and provide explicit controls for monthly selections and rotation membership.

**Architecture:** Store a fixed member order and its anchor month separately from saved monthly books. Project one cycle beginning at the server's current club month; never create rows just because time passed. Saved selections remain dated exceptions, and journal history stays intact. Reuse the existing authenticated, revision-checked transaction API.

**Tech stack:** React, Vercel Node functions, PostgreSQL/Neon, Node 22 tests with PGlite.

## Tasks

1. Confirm club timezone and deletion scope. Calendar-based advancement is approved. Define whether clearing a selection and removing a rotation participant are separate controls.
2. Add deterministic month arithmetic and rotation projection tests: month/year rollover, full cycles, current month first, bounded list size, saved selections, and empty/single-member order.
3. Add an additive rotation schema. Initialize the existing order starting with current/future planned months, wrap earlier planned people to the end, and include remaining registered members. Preserve all existing selections, members, books, and loans.
4. Add transaction-protected commands for saving rotation order and moving/deleting monthly selections. Reject duplicate destination months and stale writes. Do not change historical picks as a side effect of changing rotation membership.
5. Replace the unbounded picking-order list with one projected cycle. Add rotation management and month edit/delete controls, specific duplicate errors, and save-in-progress guards. Preserve URL navigation and current journal behavior.
6. Test month rollover, overrides, deletion, duplicate rejection, and two-member concurrency using an isolated database. Check desktop/mobile forms in the browser. Run all tests and production build.
7. Test the migration on a schema-only Neon branch, apply the additive production migration, push, and verify Vercel. No production test records or deletion of real selections.

## Confirmed choices

Use America/Vancouver for calendar advancement. Offer separate selection clearing and participant removal. Saved monthly choices are explicit exceptions to the generated order; clearing a selection restores the default rotation assignment. Removing a participant does not erase that person's saved picks. A separate saved-months dialog keeps old and distant-future entries accessible. Editing a saved month moves that entry, and any occupied destination is rejected. Existing journal record/edit behavior stays unchanged.

## Verification

- All 49 automated tests pass on Node 22; production Vite build and diff whitespace checks pass.
- Isolated Neon branch verified schema idempotence, authenticated shared reads, duplicate rejection, atomic month moves, simultaneous revision conflicts, clearing selections, and preservation of books and rotation membership.
- Browser verified occupied-month blocking, moving a saved selection, member removal/reordering persistence, access to old saved months, and the clear confirmation. At 390×844 the page has no horizontal overflow and the editor fits the viewport. Screenshot uses synthetic test accounts.
- Additive production migration completed; all 5 members, 6 books, 0 loans, and 8 selections retained, with the selection digest unchanged.
