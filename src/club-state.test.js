import test from "node:test";
import assert from "node:assert/strict";
import {
  clearLegacyCollections,
  displaySnapshot,
  clubRequest,
} from "./club-state.js";
test("retired local collections and backups are deleted without affecting unrelated preferences", () => {
  const values = new Map([
    ["bookbook-demo-v1", "old"],
    ["bookbook-member-demo-v1:a", "old"],
    ["bookbook-member-demo-v1:a:before-sample-cleanup-v3", "old"],
    ["theme", "dark"],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key: (i) => [...values.keys()][i],
    removeItem: (k) => values.delete(k),
  };
  clearLegacyCollections(storage);
  assert.deepEqual([...values], [["theme", "dark"]]);
  clearLegacyCollections(storage);
  assert.doesNotThrow(() =>
    clearLegacyCollections({
      get length() {
        throw Error("blocked");
      },
    }),
  );
});
test("member IDs determine ownership, even if a different member is named You", () => {
  const state = displaySnapshot(
    {
      revision: 0,
      members: [
        { id: "a", name: "Reader" },
        { id: "b", name: "You" },
      ],
      books: [{ id: "book", ownerId: "b" }],
      loans: [{ borrowerId: "b" }],
      picks: [{ chooserId: "b" }],
      queue: [{ chooserId: "a" }],
    },
    "a",
  );
  assert.equal(state.books[0].owner, "You");
  assert.equal(state.books[0].isMine, false);
  assert.equal(state.loans[0].isBorrower, false);
  assert.equal(state.queue[0].name, "Reader");
  assert.equal(state.picks[0].chooser, "You");
});
test("API failures and malformed snapshots cannot be mistaken for a successful save", async () => {
  await assert.rejects(
    clubRequest({ action: "addBook" }, async () =>
      Response.json({ error: { message: "Please log in" } }, { status: 401 }),
    ),
    { status: 401 },
  );
  await assert.rejects(
    clubRequest(null, async () => Response.json({})),
    /incomplete/,
  );
  await assert.rejects(
    clubRequest({ action: "addBook" }, async () => {
      throw Error("offline");
    }),
    /Could not confirm/,
  );
  const state = {
    revision: 3,
    members: [],
    books: [],
    loans: [],
    picks: [],
    queue: [],
  };
  assert.deepEqual(
    await clubRequest(null, async () => Response.json(state)),
    state,
  );
});

test("rotation view is bounded and old saved months remain editable outside the visible cycle", () => {
  const snapshot = {
    revision: 0,
    currentMonth: "2026-10",
    rotation: { anchorMonth: "2026-10", memberIds: ["a", "b"] },
    members: [
      { id: "a", name: "First" },
      { id: "b", name: "Second" },
    ],
    books: [],
    loans: [],
    picks: [],
    queue: [
      { month: "2026-01", chooserId: "a", bookId: null },
      { month: "2026-10", chooserId: "b", bookId: null },
    ],
  };
  const state = displaySnapshot(snapshot, "a");
  assert.deepEqual(
    state.queue.map((t) => t.month),
    ["2026-10", "2026-11"],
  );
  assert.equal(state.queue[0].name, "Second");
  assert.equal(state.queue[0].persisted, true);
  assert.equal(state.queue[1].persisted, false);
  assert.equal(state.selections[0].month, "2026-01");
  assert.deepEqual(
    displaySnapshot({ ...snapshot, currentMonth: "2026-11" }, "a")
      .rotationOrder,
    ["b", "a"],
  );
});

test("comment display uses member IDs for names and ownership", () => {
  const snapshot = {
    revision: 1,
    members: [
      { id: "a", name: "Reader" },
      { id: "b", name: "Reader" },
    ],
    books: [],
    loans: [],
    queue: [],
    picks: [],
    comments: [
      { id: "c1", bookId: "book", authorId: "a", body: "First" },
      { id: "c2", bookId: "book", authorId: "b", body: "Second" },
    ],
  };
  const state = displaySnapshot(snapshot, "a");
  assert.equal(state.comments[0].author, "Reader");
  assert.equal(state.comments[0].isMine, true);
  assert.equal(state.comments[1].isMine, false);
});
