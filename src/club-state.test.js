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
