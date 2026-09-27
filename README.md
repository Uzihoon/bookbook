# Bookbook

A responsive book-club frontend with dimensional book covers, a shared lending shelf, monthly reading history, and an editable chooser rotation.

![Bookbook desktop preview](docs/screenshots/desktop.png)

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Production: `npm run build`; serve with `npm run preview`. Logic checks: `npm test`.

## Frontend-only demo

No backend, login, or messages to other members. Sample people, books, selections, and requests are included. You are Jiwoo (shown as “You”). Browser localStorage retains changes on this device. Profile → Reset demo data restores the sample collection. Seed dates are September 2026.

Try adding a book, searching/filtering the shelf, requesting an available copy, accepting Sarah’s sample request, marking a handoff and return, choosing an upcoming book, changing the chooser order, or recording a previous monthly selection. New books use a typographic cover in a chosen color.

## Assets

Local cover images are retrieved from Open Library’s Covers API using the relevant ISBNs. Covers remain the property of their publishers and are included for this local prototype. Google Fonts provides DM Sans and Libre Caslon Display; system fallbacks remain usable offline. Icons: Lucide (ISC). No reference website code or artwork was copied.

## Structure

- `src/App.jsx`: views and accessible native dialog flows
- `src/model.js`: sample data and lending transitions
- `src/styles.css`: responsive design and CSS 3D book surfaces
- `src/model.test.js`: lending invariants

Before production, connect authenticated members and persistent data, enforce ownership/roles on the server, and replace the fixed demo month with club scheduling rules.
