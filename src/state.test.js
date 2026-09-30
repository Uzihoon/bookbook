import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, removeSampleData } from "./state.js";

test("new members start with an empty collection", () => {
  const state = emptyState();
  for (const field of ["books", "loans", "picks", "queue"])
    assert.deepEqual(state[field], []);
  state.books.push({ id: "new" });
  assert.deepEqual(emptyState().books, []);
});

test("cleanup removes sample records and preserves member additions", () => {
  const added = {
    id: "member-copy",
    title: "The Midnight Library",
    owner: "You",
  };
  const saved = {
    books: [
      { id: "midnight", title: "The Midnight Library", owner: "Mina" },
      added,
    ],
    loans: [
      { id: "demo-loan", bookId: "midnight" },
      { id: "test-request", bookId: "midnight" },
      { id: "real-request", bookId: added.id },
    ],
    picks: [
      { month: "2026-09", bookId: "midnight", chooser: "Mina" },
      { month: "2026-10", bookId: added.id, chooser: "You" },
    ],
    queue: [
      { name: "You", month: "2026-10", bookId: "" },
      { name: "Jamie", month: "2026-11", bookId: added.id },
      { name: "Alex", month: "2026-12", bookId: "midnight" },
      { name: "Jiwoo", month: "2027-01", bookId: "" },
    ],
  };
  const result = removeSampleData(saved);
  assert.deepEqual(result.books, [added]);
  assert.deepEqual(result.loans, [saved.loans[2]]);
  assert.deepEqual(result.picks, [saved.picks[1]]);
  assert.deepEqual(result.queue, [saved.queue[3]]);
  assert.equal(saved.books.length, 2);
  assert.deepEqual(removeSampleData(result), result);
});

test("new records are never removed on subsequent loads", () => {
  const state = {
    ...emptyState(),
    queue: [
      { name: "You", month: "2026-10", bookId: "" },
      { name: "Jamie", month: "2026-11", bookId: "" },
    ],
  };
  assert.deepEqual(removeSampleData(state), state);
});

test("follow-up cleanup removes reordered sample people and preserves their selected books", () => {
  const book = { id: "member-copy", title: "My book", owner: "You" };
  for (const version of [undefined, 2]) {
    const state = {
      version,
      books: [book],
      loans: [],
      picks: [],
      queue: [
        { name: "Jamie", month: "2026-10", bookId: book.id },
        { name: "Alex", month: "2026-11", bookId: "" },
        { name: "You", month: "2026-12", bookId: book.id },
        { name: "Jiwoo", month: "2027-01", bookId: book.id },
        { name: "Jamie", month: "2027-02", bookId: book.id },
      ],
    };
    const result = removeSampleData(state);
    assert.deepEqual(result.queue, state.queue.slice(2));
    assert.deepEqual(result.books, [book]);
    assert.equal(result.version, 3);
    assert.deepEqual(removeSampleData(result), result);
  }
});
