import test from "node:test";
import assert from "node:assert/strict";
import { requestBook, updateLoan } from "./model.js";
const books = [
  { id: "a", owner: "Mina", status: "available" },
  { id: "b", owner: "You", status: "available" },
  { id: "c", owner: "Alex", status: "lent" },
];
test("request only another member’s available copy, once", () => {
  const state = { books, loans: [] };
  const requested = requestBook(state, "a");
  assert.equal(requested.loans[0].status, "pending");
  assert.equal(requested.books[0].status, "available");
  assert.throws(() => requestBook(requested, "a"), /already/);
  assert.throws(() => requestBook(state, "b"), /own/);
  assert.throws(() => requestBook(state, "c"), /available/);
});
test("accept, lend and return keep copy availability consistent", () => {
  const state = {
    books,
    loans: [
      { id: "r", bookId: "b", borrower: "Mina", status: "pending" },
      { id: "s", bookId: "b", borrower: "Alex", status: "pending" },
    ],
  };
  const accepted = updateLoan(state, "r", "accepted");
  assert.equal(accepted.books[1].status, "reserved");
  assert.equal(accepted.loans[1].status, "declined");
  const lent = updateLoan(accepted, "r", "lent");
  assert.equal(lent.books[1].status, "lent");
  const returned = updateLoan(lent, "r", "returned");
  assert.equal(returned.books[1].status, "available");
  assert.throws(() => updateLoan(state, "r", "returned"), /transition/);
});
test("cancelling accepted loan releases the copy; declining leaves it available", () => {
  const state = {
    books,
    loans: [{ id: "r", bookId: "a", borrower: "You", status: "accepted" }],
  };
  assert.equal(
    updateLoan(state, "r", "cancelled").books[0].status,
    "available",
  );
  assert.equal(
    updateLoan(
      { ...state, loans: [{ ...state.loans[0], status: "pending" }] },
      "r",
      "declined",
    ).books[0].status,
    "available",
  );
});
