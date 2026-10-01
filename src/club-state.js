import {
  clubMonth,
  rotationOrder,
  projectRotation,
} from "../shared/rotation.js";
// Retire browser-only collections and their old cleanup backups. Never import them.
export function clearLegacyCollections(storage) {
  try {
    const keys = Array.from({ length: storage.length }, (_, i) =>
      storage.key(i),
    );
    for (const key of keys)
      if (
        key === "bookbook-demo-v1" ||
        key?.startsWith("bookbook-member-demo-v1:")
      )
        storage.removeItem(key);
  } catch {
    /* Browser storage is optional; the database is the source of truth. */
  }
}
export function displaySnapshot(snapshot, memberId) {
  const names = new Map(snapshot.members.map((m) => [m.id, m.name]));
  const currentMonth = snapshot.currentMonth || clubMonth();
  const selections = [
    ...snapshot.queue.map((p) => ({ ...p, kind: "upcoming" })),
    ...snapshot.picks.map((p) => ({ ...p, kind: "history" })),
  ].map((p) => ({
    ...p,
    persisted: true,
    name: names.get(p.chooserId) || "Club member",
  }));
  const queue = snapshot.rotation
    ? projectRotation(snapshot.rotation, currentMonth, selections)
    : snapshot.queue;
  return {
    ...snapshot,
    currentMonth,
    selections,
    rotationOrder: rotationOrder(snapshot.rotation, currentMonth),
    books: snapshot.books.map((b) => ({
      ...b,
      owner: names.get(b.ownerId) || "Club member",
      isMine: b.ownerId === memberId,
    })),
    loans: snapshot.loans.map((l) => ({
      ...l,
      borrower: names.get(l.borrowerId) || "Club member",
      isBorrower: l.borrowerId === memberId,
    })),
    picks: snapshot.picks.map((p) => ({
      ...p,
      chooser: names.get(p.chooserId) || "Club member",
    })),
    queue: queue.map((p) => ({
      ...p,
      name: names.get(p.chooserId) || "Club member",
    })),
  };
}
export async function clubRequest(body, fetcher = fetch) {
  let response;
  try {
    response = await fetcher("/api/club", {
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      ...(body
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        : {}),
    });
  } catch {
    throw new Error(
      body
        ? "Could not confirm the save. Refresh the club before trying again."
        : "Could not load the club. Check your connection and retry.",
    );
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The club service is unavailable. Please retry.");
  }
  if (!response.ok)
    throw Object.assign(
      new Error(
        data.error?.message || "The club could not load or save your data.",
      ),
      { status: response.status },
    );
  if (
    !Number.isSafeInteger(data.revision) ||
    !["members", "books", "loans", "picks", "queue"].every((k) =>
      Array.isArray(data[k]),
    )
  )
    throw new Error("The club returned an incomplete response. Please retry.");
  return data;
}
