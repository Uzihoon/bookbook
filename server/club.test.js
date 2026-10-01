import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createClub } from "./club.js";
const db = new PGlite();
const a = randomUUID(),
  b = randomUUID(),
  c = randomUUID();
// Match node-postgres's checked-out-client transaction API in isolated tests.
const pool = {
  query: (...args) => db.query(...args),
  connect: async () => ({
    query: (...args) => db.query(...args),
    release() {},
  }),
};
let handler;
before(async () => {
  await db.exec(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
});
beforeEach(async () => {
  await db.exec(
    "TRUNCATE club_loans, club_selections, club_books, members CASCADE; UPDATE club_state SET revision=0 WHERE id=1; UPDATE club_rotation SET member_ids='{}' WHERE id=1",
  );
  for (const [id, name] of [
    [a, "First Reader"],
    [b, "Second Reader"],
    [c, "You"],
  ])
    await db.query(
      "INSERT INTO members(id,name,name_key,password_hash) VALUES($1,$2,$2,$3)",
      [id, name, "not-a-real-password"],
    );
  handler = createClub({
    db: pool,
    auth: {
      member: async (req) => {
        const id = req.headers.get("x-test-member");
        return [a, b, c].includes(id) ? { id } : null;
      },
    },
  });
});
after(() => db.close());
async function call(member, body, origin = "https://bookbook.test") {
  const r = await handler(
    new Request("https://bookbook.test/api/club", {
      method: body ? "POST" : "GET",
      headers: {
        ...(member ? { "x-test-member": member } : {}),
        ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
  return { status: r.status, data: await r.json() };
}
const book = () => ({
  id: randomUUID(),
  title: "한국 책",
  author: "An author",
  genre: "Fiction",
  note: "Please return it",
  status: "available",
  color: "#693746",
});
const add = async (owner = a) => {
  const copy = book();
  const result = await call(owner, {
    action: "addBook",
    revision: 0,
    book: { ...copy, ownerId: b },
  });
  assert.equal(result.status, 200);
  return copy;
};
test("shared state requires login and exposes only public member fields", async () => {
  assert.equal((await call(null)).status, 401);
  const { data } = await call(a);
  assert.equal(data.members.length, 3);
  assert.deepEqual(Object.keys(data.members[0]).sort(), ["id", "name"]);
  assert.deepEqual(data.books, []);
});
test("a book belongs to the authenticated member and persists across fresh handlers", async () => {
  const copy = await add();
  handler = createClub({ db: pool, auth: { member: async () => ({ id: b }) } });
  const { data } = await call(b);
  assert.equal(data.books[0].id, copy.id);
  assert.equal(data.books[0].ownerId, a);
  assert.equal(data.books[0].title, copy.title);
});
test("nonowners cannot change availability, stale writes cannot overwrite changes", async () => {
  const copy = await add();
  assert.equal(
    (
      await call(b, {
        action: "availability",
        revision: 1,
        bookId: copy.id,
        status: "unlisted",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(a, {
        action: "availability",
        revision: 0,
        bookId: copy.id,
        status: "unlisted",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(a, {
        action: "availability",
        revision: 1,
        bookId: copy.id,
        status: "unlisted",
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(b, { action: "requestLoan", revision: 2, bookId: copy.id }))
      .status,
    409,
  );
});
test("loan transitions require the right member and reserve only one borrower", async () => {
  const copy = await add();
  assert.equal(
    (await call(a, { action: "requestLoan", revision: 1, bookId: copy.id }))
      .status,
    400,
  );
  const first = await call(b, {
    action: "requestLoan",
    revision: 1,
    bookId: copy.id,
  });
  assert.equal(first.status, 200);
  const loan = first.data.loans[0];
  assert.equal(
    (await call(b, { action: "requestLoan", revision: 2, bookId: copy.id }))
      .status,
    409,
  );
  assert.equal(
    (await call(c, { action: "requestLoan", revision: 2, bookId: copy.id }))
      .status,
    200,
  );
  assert.equal(
    (
      await call(b, {
        action: "changeLoan",
        revision: 3,
        loanId: loan.id,
        status: "accepted",
      })
    ).status,
    403,
  );
  const accepted = await call(a, {
    action: "changeLoan",
    revision: 3,
    loanId: loan.id,
    status: "accepted",
  });
  assert.equal(accepted.status, 200);
  assert.equal(accepted.data.books[0].status, "reserved");
  assert.equal(
    accepted.data.loans.find((l) => l.borrowerId === c).status,
    "declined",
  );
  assert.equal(
    (
      await call(a, {
        action: "availability",
        revision: 4,
        bookId: copy.id,
        status: "unlisted",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(c, {
        action: "changeLoan",
        revision: 4,
        loanId: loan.id,
        status: "cancelled",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call(a, {
        action: "changeLoan",
        revision: 4,
        loanId: loan.id,
        status: "lent",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(b, {
        action: "changeLoan",
        revision: 5,
        loanId: loan.id,
        status: "returned",
      })
    ).status,
    403,
  );
  const returned = await call(a, {
    action: "changeLoan",
    revision: 5,
    loanId: loan.id,
    status: "returned",
  });
  assert.equal(returned.status, 200);
  assert.equal(returned.data.books[0].status, "available");
});
test("monthly plans use real members, permit an unchosen book, and are shared", async () => {
  assert.equal(
    (
      await call(a, {
        action: "saveSelection",
        revision: 0,
        kind: "upcoming",
        month: "2026-11",
        chooserId: b,
        bookId: null,
      })
    ).status,
    200,
  );
  assert.equal((await call(b)).data.queue[0].chooserId, b);
  assert.equal(
    (
      await call(a, {
        action: "saveSelection",
        revision: 1,
        kind: "history",
        month: "2026-10",
        chooserId: a,
        bookId: null,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(a, {
        action: "saveSelection",
        revision: 1,
        kind: "upcoming",
        month: "2026-13",
        chooserId: a,
        bookId: null,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(a, {
        action: "saveSelection",
        revision: 1,
        kind: "upcoming",
        month: "2026-12",
        chooserId: randomUUID(),
        bookId: null,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(a, {
        action: "saveSelection",
        revision: 1,
        kind: "upcoming",
        month: "2026-12",
        chooserId: c,
        bookId: null,
      })
    ).status,
    200,
  );
  const swap = await call(a, {
    action: "swapTurns",
    revision: 2,
    month: "2026-11",
    otherMonth: "2026-12",
  });
  assert.equal(swap.status, 200);
  assert.equal(swap.data.queue[0].chooserId, c);
});
test("writes reject cross-origin requests, oversized input, unsafe metadata and unknown actions", async () => {
  assert.equal(
    (
      await call(
        a,
        { action: "addBook", revision: 0, book: book() },
        "https://evil.test",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(a, {
        action: "addBook",
        revision: 0,
        book: { ...book(), coverUrl: "javascript:alert(1)" },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(a, {
        action: "addBook",
        revision: 0,
        book: { ...book(), note: "x".repeat(50000) },
      })
    ).status,
    413,
  );
  assert.equal(
    (await call(a, { action: "replaceEverything", revision: 0 })).status,
    400,
  );
  assert.equal(
    (
      await call(a, {
        action: "addBook",
        revision: 0,
        book: { ...book(), title: "" },
      })
    ).status,
    400,
  );
  assert.equal((await call(a)).data.revision, 0);
});

test("rotation is shared, validates members, and preserves saved history when someone is removed", async () => {
  const copy = await add();
  await call(a, {
    action: "saveSelection",
    revision: 1,
    kind: "history",
    month: "2026-01",
    chooserId: b,
    bookId: copy.id,
  });
  const { data: initial } = await call(a);
  assert.match(initial.currentMonth, /^20\d{2}-\d{2}$/);
  const saved = await call(a, {
    action: "saveRotation",
    revision: 2,
    anchorMonth: initial.currentMonth,
    memberIds: [b, a, c],
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(saved.data.rotation.memberIds, [b, a, c]);
  assert.deepEqual((await call(b)).data.rotation.memberIds, [b, a, c]);
  assert.equal(
    (
      await call(a, {
        action: "saveRotation",
        revision: 3,
        anchorMonth: initial.currentMonth,
        memberIds: [a, a],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(a, {
        action: "saveRotation",
        revision: 3,
        anchorMonth: initial.currentMonth,
        memberIds: [randomUUID()],
      })
    ).status,
    400,
  );
  const removed = await call(a, {
    action: "saveRotation",
    revision: 3,
    anchorMonth: initial.currentMonth,
    memberIds: [a, c],
  });
  assert.equal(removed.status, 200);
  assert.equal(removed.data.picks[0].chooserId, b);
  assert.equal(
    (
      await call(a, {
        action: "saveRotation",
        revision: 4,
        anchorMonth: "2000-01",
        memberIds: [a],
      })
    ).status,
    409,
  );
});
test("editing a saved turn moves it atomically and blocks occupied destination months", async () => {
  const copy = await add();
  await call(a, {
    action: "saveSelection",
    revision: 1,
    kind: "upcoming",
    month: "2026-11",
    chooserId: a,
    bookId: copy.id,
  });
  await call(a, {
    action: "saveSelection",
    revision: 2,
    kind: "history",
    month: "2026-12",
    chooserId: b,
    bookId: copy.id,
  });
  const command = {
    action: "saveTurn",
    revision: 3,
    kind: "upcoming",
    originalMonth: "2026-11",
    chooserId: a,
    bookId: copy.id,
  };
  assert.equal((await call(a, { ...command, month: "2026-12" })).status, 409);
  assert.equal((await call(a)).data.queue[0].month, "2026-11");
  const moved = await call(a, { ...command, month: "2027-01" });
  assert.equal(moved.status, 200);
  assert.equal(moved.data.queue.length, 1);
  assert.equal(moved.data.queue[0].month, "2027-01");
  assert.equal(moved.data.picks[0].month, "2026-12");
  assert.equal(
    (
      await call(a, {
        action: "saveTurn",
        revision: 4,
        kind: "upcoming",
        month: "2027-01",
        chooserId: b,
        bookId: null,
      })
    ).status,
    409,
  );
  const edited = await call(a, {
    action: "saveTurn",
    revision: 4,
    kind: "upcoming",
    originalMonth: "2027-01",
    month: "2027-01",
    chooserId: b,
    bookId: null,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.queue[0].chooserId, b);
});
test("clearing a month removes its selection but preserves books and rotation participants", async () => {
  const copy = await add();
  const initial = (await call(a)).data;
  await call(a, {
    action: "saveRotation",
    revision: 1,
    anchorMonth: initial.currentMonth,
    memberIds: [a, b],
  });
  await call(a, {
    action: "saveSelection",
    revision: 2,
    kind: "upcoming",
    month: "2026-11",
    chooserId: a,
    bookId: copy.id,
  });
  const cleared = await call(a, {
    action: "clearSelection",
    revision: 3,
    month: "2026-11",
  });
  assert.equal(cleared.status, 200);
  assert.deepEqual(cleared.data.queue, []);
  assert.equal(cleared.data.books.length, 1);
  assert.deepEqual(cleared.data.rotation.memberIds, [a, b]);
  assert.equal(
    (await call(a, { action: "clearSelection", revision: 4, month: "2026-11" }))
      .status,
    404,
  );
});

test("migration seeds future-first rotation once without changing saved selections", async () => {
  const { clubMonth, addMonths } = await import("../shared/rotation.js");
  const current = clubMonth();
  await db.query(
    "INSERT INTO club_selections(kind,month,chooser_id,updated_by) VALUES('upcoming',$1,$2,$2),('upcoming',$3,$4,$4)",
    [addMonths(current, 1), b, addMonths(current, -5), a],
  );
  await db.query("DELETE FROM club_rotation");
  const schema = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8",
  );
  await db.exec(schema);
  const seeded = (await call(a)).data;
  assert.equal(seeded.rotation.anchorMonth, addMonths(current, 1));
  assert.deepEqual(seeded.rotation.memberIds, [b, a, c]);
  assert.equal(seeded.queue.length, 2);
  await db.query("UPDATE club_rotation SET member_ids=$1 WHERE id=1", [[c, a]]);
  await db.exec(schema);
  assert.deepEqual((await call(a)).data.rotation.memberIds, [c, a]);
  assert.equal((await call(a)).data.queue.length, 2);
});
test("calendar advancement changes the projection month without writing records or increasing revision", async () => {
  let now = new Date("2026-10-01T06:59:59Z");
  handler = createClub({
    db: pool,
    auth: { member: async () => ({ id: a }) },
    now: () => now,
  });
  const before = (await call(a)).data;
  now = new Date("2026-10-01T07:00:00Z");
  const after = (await call(a)).data;
  assert.equal(before.currentMonth, "2026-09");
  assert.equal(after.currentMonth, "2026-10");
  assert.equal(before.revision, after.revision);
  assert.deepEqual(after.queue, []);
});
