// Identify sample books by ID so member-added copies with the same title survive.
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
// The demo allowed these two fictional people to swap any of its three turns.
const isLeftoverSampleTurn = (turn) =>
  ["Jamie", "Alex"].includes(turn.name) &&
  ["2026-10", "2026-11", "2026-12"].includes(turn.month);
export const emptyState = () => ({
  version: 3,
  books: [],
  loans: [],
  picks: [],
  queue: [],
});

export function removeSampleData(state) {
  if (state.version >= 3) return state;
  if (state.version === 2)
    return {
      ...state,
      version: 3,
      queue: state.queue.filter((turn) => !isLeftoverSampleTurn(turn)),
    };
  const books = state.books.filter((book) => !sampleBookIds.has(book.id));
  const kept = new Set(books.map((book) => book.id));
  return {
    ...state,
    version: 3,
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
          !isLeftoverSampleTurn(turn) &&
          (kept.has(turn.bookId) ||
            !sampleTurns.has(`${turn.name}:${turn.month}`)),
      )
      .map((turn) => ({
        ...turn,
        bookId: kept.has(turn.bookId) ? turn.bookId : "",
      })),
  };
}
