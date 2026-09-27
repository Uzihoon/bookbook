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

No real-device or cross-browser testing was performed. This is a frontend-only local demo; no real requests are delivered and there is no authentication or shared data backend.
