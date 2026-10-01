import test from "node:test";
import assert from "node:assert/strict";
import {
  clubMonth,
  addMonths,
  rotationOrder,
  projectRotation,
} from "../shared/rotation.js";
test("club month follows Vancouver across UTC month boundaries and daylight saving", () => {
  assert.equal(clubMonth(new Date("2026-10-01T02:00:00Z")), "2026-09");
  assert.equal(clubMonth(new Date("2026-10-01T07:00:00Z")), "2026-10");
  assert.equal(clubMonth(new Date("2027-01-01T07:30:00Z")), "2026-12");
  assert.equal(clubMonth(new Date("2027-01-01T08:00:00Z")), "2027-01");
});
test("rotation starts with the current month, wraps after a full cycle, and never grows", () => {
  const rotation = { anchorMonth: "2026-10", memberIds: ["a", "b", "c", "d"] };
  assert.deepEqual(rotationOrder(rotation, "2026-11"), ["b", "c", "d", "a"]);
  assert.deepEqual(rotationOrder(rotation, "2027-02"), ["a", "b", "c", "d"]);
  assert.deepEqual(rotationOrder(rotation, "2026-09"), ["d", "a", "b", "c"]);
  assert.equal(addMonths("2026-12", 1), "2027-01");
  const turns = projectRotation(rotation, "2027-01", []);
  assert.deepEqual(
    turns.map((t) => t.month),
    ["2027-01", "2027-02", "2027-03", "2027-04"],
  );
  assert.deepEqual(
    turns.map((t) => t.chooserId),
    ["d", "a", "b", "c"],
  );
  assert.equal(projectRotation(rotation, "2030-08", []).length, 4);
});
test("saved monthly choices take priority without changing the repeating order", () => {
  const rotation = { anchorMonth: "2026-10", memberIds: ["a", "b"] };
  const saved = [
    { kind: "upcoming", month: "2026-10", chooserId: "b", bookId: "book" },
    { kind: "history", month: "2026-09", chooserId: "b", bookId: "old" },
  ];
  const turns = projectRotation(rotation, "2026-10", saved);
  assert.equal(turns[0].chooserId, "b");
  assert.equal(turns[0].bookId, "book");
  assert.equal(turns[0].persisted, true);
  assert.equal(turns[1].persisted, false);
  assert.equal(turns[1].bookId, null);
  assert.deepEqual(
    projectRotation(rotation, "2026-12", saved).map((t) => t.chooserId),
    ["a", "b"],
  );
  assert.deepEqual(
    projectRotation(
      { anchorMonth: "2026-10", memberIds: [] },
      "2026-10",
      saved,
    ),
    [],
  );
  assert.equal(
    projectRotation(
      { anchorMonth: "2026-10", memberIds: ["a"] },
      "2027-10",
      [],
    )[0].chooserId,
    "a",
  );
});
