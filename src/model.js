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
export const seed = {
  books: [
    {
      id: "midnight",
      title: "The Midnight Library",
      author: "Matt Haig",
      owner: "Mina",
      genre: "Fiction",
      status: "available",
      cover: "midnight",
      color: "#1e2d44",
      note: "A beautiful reminder of all the lives we could live. Our September pick.",
      description:
        "Between life and death there is a library, and within that library, the shelves go on forever. Every book offers a chance to try another life you could have lived.",
    },
    {
      id: "tomorrow",
      title: "Tomorrow, and Tomorrow, and Tomorrow",
      author: "Gabrielle Zevin",
      owner: "Sarah",
      genre: "Fiction",
      status: "available",
      cover: "tomorrow",
      color: "#d39e52",
      note: "One of my favorites. Take your time with it.",
    },
    {
      id: "crying",
      title: "Crying in H Mart",
      author: "Michelle Zauner",
      owner: "Alex",
      genre: "Memoir",
      status: "available",
      cover: "crying",
      color: "#eae0c7",
      note: "A moving story about family, food, and finding your way home.",
    },
    {
      id: "creative",
      title: "The Creative Act",
      author: "Rick Rubin",
      owner: "You",
      genre: "Nonfiction",
      status: "available",
      cover: "creative",
      color: "#c9bda8",
      note: "Best read slowly, a few pages at a time.",
    },
    {
      id: "coffee",
      title: "Before the Coffee Gets Cold",
      author: "Toshikazu Kawaguchi",
      owner: "Daniel",
      genre: "Fiction",
      status: "lent",
      cover: "coffee",
      color: "#8aafaf",
      note: "A little café, a little time travel.",
    },
    {
      id: "norwegian",
      title: "Norwegian Wood",
      author: "Haruki Murakami",
      owner: "You",
      genre: "Fiction",
      status: "available",
      cover: "norwegian",
      color: "#b9382d",
      note: "Happy to lend this to anyone in the club.",
    },
    {
      id: "atomic",
      title: "Atomic Habits",
      author: "James Clear",
      owner: "Jamie",
      genre: "Nonfiction",
      status: "available",
      cover: "atomic",
      color: "#dad1b8",
      note: "Lots of practical ideas, and a few pencil marks.",
    },
    {
      id: "morisaki",
      title: "Days at the Morisaki Bookshop",
      author: "Satoshi Yagisawa",
      owner: "Mina",
      genre: "Fiction",
      status: "available",
      cover: "morisaki",
      color: "#ecd171",
      note: "For anyone who has ever found comfort in a bookshop.",
    },
  ],
  loans: [
    {
      id: "demo-request",
      bookId: "creative",
      borrower: "Sarah",
      status: "pending",
      date: "2026-09-24",
    },
    {
      id: "demo-loan",
      bookId: "coffee",
      borrower: "You",
      status: "lent",
      date: "2026-09-19",
    },
  ],
  picks: [
    { month: "2026-09", bookId: "midnight", chooser: "Mina" },
    { month: "2026-08", bookId: "tomorrow", chooser: "Sarah" },
    { month: "2026-07", bookId: "crying", chooser: "Alex" },
    { month: "2026-06", bookId: "morisaki", chooser: "Daniel" },
  ],
  queue: [
    { name: "You", month: "2026-10", bookId: "" },
    { name: "Jamie", month: "2026-11", bookId: "" },
    { name: "Alex", month: "2026-12", bookId: "" },
  ],
};
