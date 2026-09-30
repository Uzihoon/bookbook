// IDs from the original sample collection; never match by title or person name.
const sampleBookIds = new Set([
  "midnight",
  "tomorrow",
  "crying",
  "creative",
  "coffee",
  "norwegian",
  "atomic",
  "morisaki",
]);
const sampleTurns = new Set(["You:2026-10", "Jamie:2026-11", "Alex:2026-12"]);
export const emptyState = () => ({
  version: 2,
  books: [],
  loans: [],
  picks: [],
  queue: [],
});

export function removeSampleData(state) {
  if (state.version >= 2) return state;
  const books = state.books.filter((book) => !sampleBookIds.has(book.id));
  const kept = new Set(books.map((book) => book.id));
  return {
    ...state,
    version: 2,
    books,
    loans: state.loans.filter(
      (loan) =>
        kept.has(loan.bookId) &&
        !["demo-request", "demo-loan"].includes(loan.id),
    ),
    picks: state.picks.filter((pick) => kept.has(pick.bookId)),
    queue: state.queue
      .filter(
        (turn) =>
          kept.has(turn.bookId) ||
          !sampleTurns.has(`${turn.name}:${turn.month}`),
      )
      .map((turn) => ({
        ...turn,
        bookId: kept.has(turn.bookId) ? turn.bookId : "",
      })),
  };
}
