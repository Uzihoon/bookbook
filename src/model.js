const active = ["pending", "accepted", "lent"];
export function requestBook(state, bookId) {
  const book = state.books.find((b) => b.id === bookId);
  if (!book || book.status !== "available")
    throw new Error("This copy is not available.");
  if (book.owner === "You") throw new Error("You cannot borrow your own book.");
  if (
    state.loans.some(
      (l) =>
        l.bookId === bookId &&
        l.borrower === "You" &&
        active.includes(l.status),
    )
  )
    throw new Error("You already requested this copy.");
  return {
    ...state,
    loans: [
      {
        id: crypto.randomUUID(),
        bookId,
        borrower: "You",
        status: "pending",
        date: new Date().toISOString(),
      },
      ...state.loans,
    ],
  };
}
export function updateLoan(state, id, status) {
  const loan = state.loans.find((l) => l.id === id);
  const transitions = {
    pending: ["accepted", "declined", "cancelled"],
    accepted: ["lent", "cancelled"],
    lent: ["returned"],
  };
  if (!loan || !transitions[loan.status]?.includes(status))
    throw new Error("Invalid loan transition.");
  const book = state.books.find((b) => b.id === loan.bookId);
  if (status === "accepted" && book.status !== "available")
    throw new Error("This copy is no longer available.");
  const availability = {
    accepted: "reserved",
    lent: "lent",
    returned: "available",
    cancelled: "available",
  };
  return {
    ...state,
    books: state.books.map((b) =>
      b.id === loan.bookId &&
      availability[status] &&
      !(status === "cancelled" && loan.status === "pending")
        ? { ...b, status: availability[status] }
        : b,
    ),
    loans: state.loans.map((l) =>
      l.id === id
        ? { ...l, status }
        : status === "accepted" &&
            l.bookId === loan.bookId &&
            l.status === "pending"
          ? { ...l, status: "declined" }
          : l,
    ),
  };
}
