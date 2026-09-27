# Bookbook Frontend Implementation Plan

**Goal:** A responsive, local-only book-club frontend for sharing physical books and recording monthly selections and chooser order.

**Architecture:** React single-page app with library, monthly picks, and borrowing views. Local browser storage contains demo copies, loan requests and monthly selections. No API, authentication, or server integration. CSS perspective gives individual covers real depth while retaining accessible HTML controls.

**Tech Stack:** React, Vite, Lucide icons, CSS, Node test runner.

## Approved design
Warm cream, burgundy, editorial serif headings, realistic dimensional covers, generous whitespace, restrained physical movement. This extends the recommendation approved by the user. Mobile uses stacked panels, two-column shelves and accessible dialogs. Reduced-motion users receive still book views.

## Tasks
1. Scaffold Vite and document the local-only scope. Source: package.json, index.html, README.md.
2. Verify core lending behavior with a small state-model test: unavailable and owned books cannot be requested, duplicate requests fail, accept/lend/return state stays consistent. Source: src/model.js and src/model.test.js.
3. Implement the main shelf, detail and add-book dialogs, search and availability filters. Source: src/App.jsx, src/styles.css, src/main.jsx.
4. Add monthly archive, chooser ordering and book selection; implement incoming/outgoing borrowing views with local persistence.
5. Run tests and production build; inspect desktop/mobile rendering and exercise the main flows in the browser. Keep the local preview available.

## Validation
Run npm test and npm run build. Browser checks: add and search for a book; request a copy; approve and return a demo loan; edit an upcoming pick and order; refresh to confirm persistence; verify narrow-screen overflow, modal focus and reduced motion.
