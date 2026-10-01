import { clubMonth } from "../shared/rotation.js";
import { randomUUID } from "node:crypto";
const reply = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function problem(status, message) {
  throw Object.assign(new Error(message), { status });
}
const uuid = (v) => {
  if (
    typeof v !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  )
    problem(400, "Invalid record ID.");
  return v;
};
const month = (v) => {
  if (typeof v !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(v))
    problem(400, "Choose a valid month between 2000 and 2099.");
  return v;
};
function text(v, max, required = false) {
  if (v == null && !required) return "";
  if (
    typeof v !== "string" ||
    v.trim().length > max ||
    (required && !v.trim()) ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)
  )
    problem(400, "Please check the book details and text lengths.");
  return v.trim();
}
function url(v) {
  if (!v) return null;
  try {
    const u = new URL(v);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      u.href.length <= 2000
    )
      return u.href;
  } catch {}
  problem(400, "Book links must be valid HTTPS URLs.");
}
function names(v) {
  if (v == null) return [];
  if (!Array.isArray(v) || v.length > 30)
    problem(400, "Too many authors or translators.");
  return v.map((value) => text(value, 300, true));
}
function metadata(b) {
  if (!b || typeof b !== "object" || Array.isArray(b))
    problem(400, "Enter the book details.");
  if (!["available", "unlisted"].includes(b.status))
    problem(400, "Choose a valid availability.");
  if (!/^#[0-9a-f]{6}$/i.test(b.color || ""))
    problem(400, "Choose a valid cover color.");
  if (!["Fiction", "Nonfiction", "Memoir", "Poetry", "Other"].includes(b.genre))
    problem(400, "Choose a valid genre.");
  return {
    catalogId: text(b.catalogId, 300),
    authors: names(b.authors),
    translators: names(b.translators),
    genre: b.genre,
    color: b.color,
    note: text(b.note, 400),
    description: text(b.description, 6000),
    publisher: text(b.publisher, 300),
    isbn13: text(b.isbn13, 13),
    isbn10: text(b.isbn10, 10),
    publishedDate: text(b.publishedDate, 50),
    coverUrl: url(b.coverUrl),
    sourceUrl: url(b.sourceUrl),
    source: b.source === "kakao" ? "kakao" : null,
  };
}
// A single SQL statement gives all collections the same MVCC snapshot.
export async function clubSnapshot(db, now = new Date()) {
  const { rows } = await db.query(`SELECT revision,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name) ORDER BY created_at,id),'[]'::jsonb) FROM members) AS members,
 (SELECT coalesce(jsonb_agg(b.metadata || jsonb_build_object('id',b.id,'ownerId',b.owner_id,'title',b.title,'author',b.author,'status',coalesce((SELECT CASE WHEN l.status='accepted' THEN 'reserved' ELSE 'lent' END FROM club_loans l WHERE l.book_id=b.id AND l.status IN ('accepted','lent')),b.availability)) ORDER BY b.created_at DESC,b.id),'[]'::jsonb) FROM club_books b) AS books,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'bookId',book_id,'borrowerId',borrower_id,'status',status,'date',created_at) ORDER BY created_at DESC,id),'[]'::jsonb) FROM club_loans) AS loans,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('month',month,'chooserId',chooser_id,'bookId',book_id) ORDER BY month DESC),'[]'::jsonb) FROM club_selections WHERE kind='history') AS picks,
 (SELECT coalesce(jsonb_agg(jsonb_build_object('month',month,'chooserId',chooser_id,'bookId',book_id) ORDER BY month),'[]'::jsonb) FROM club_selections WHERE kind='upcoming') AS queue
  , (SELECT jsonb_build_object('anchorMonth',anchor_month,'memberIds',member_ids) FROM club_rotation WHERE id=1) AS rotation
  , (SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'bookId',book_id,'authorId',author_id,'body',body,'createdAt',created_at) ORDER BY created_at DESC,id),'[]'::jsonb) FROM club_comments) AS comments
 FROM club_state WHERE id=1`);
  if (!rows[0]) throw new Error("CLUB_SCHEMA_MISSING");
  return { ...rows[0], currentMonth: clubMonth(now) };
}
async function mutate(db, actor, body, now) {
  const getBook = async (id) => {
    const b = (
      await db.query("SELECT * FROM club_books WHERE id=$1", [uuid(id)])
    ).rows[0];
    if (!b) problem(404, "That book is no longer on the shelf.");
    return b;
  };
  const busy = async (id) =>
    (
      await db.query(
        "SELECT id FROM club_loans WHERE book_id=$1 AND status IN ('accepted','lent')",
        [id],
      )
    ).rows.length > 0;
  switch (body.action) {
    case "addComment": {
      const id = uuid(body.id);
      const book = await getBook(body.bookId);
      if (
        typeof body.body !== "string" ||
        !body.body.trim() ||
        body.body.trim().length > 2000
      )
        problem(400, "Write a comment between 1 and 2,000 characters.");
      const content = text(body.body, 2000, true);
      const existing = (
        await db.query("SELECT * FROM club_comments WHERE id=$1", [id])
      ).rows[0];
      if (existing) {
        if (
          existing.author_id !== actor ||
          existing.book_id !== book.id ||
          existing.body !== content
        )
          problem(
            409,
            "That comment was already submitted with different details.",
          );
        break;
      }
      await db.query(
        "INSERT INTO club_comments(id,book_id,author_id,body) VALUES($1,$2,$3,$4)",
        [id, book.id, actor, content],
      );
      break;
    }
    case "deleteComment": {
      const id = uuid(body.id);
      const comment = (
        await db.query("SELECT author_id FROM club_comments WHERE id=$1", [id])
      ).rows[0];
      if (!comment) problem(404, "That comment has already been removed.");
      if (comment.author_id !== actor)
        problem(403, "You can only delete your own comments.");
      await db.query("DELETE FROM club_comments WHERE id=$1", [id]);
      break;
    }
    case "addBook": {
      const b = body.book,
        meta = metadata(b);
      await db.query(
        "INSERT INTO club_books(id,owner_id,title,author,metadata,availability) VALUES($1,$2,$3,$4,$5,$6)",
        [
          uuid(b.id),
          actor,
          text(b.title, 300, true),
          text(b.author, 300, true),
          JSON.stringify(meta),
          b.status,
        ],
      );
      break;
    }
    case "availability": {
      const b = await getBook(body.bookId);
      if (b.owner_id !== actor)
        problem(403, "Only the owner can change this book.");
      if (!["available", "unlisted"].includes(body.status))
        problem(400, "Choose a valid availability.");
      if (await busy(b.id))
        problem(409, "Finish the current loan before changing availability.");
      await db.query("UPDATE club_books SET availability=$2 WHERE id=$1", [
        b.id,
        body.status,
      ]);
      if (body.status === "unlisted")
        await db.query(
          "UPDATE club_loans SET status='declined',updated_at=now() WHERE book_id=$1 AND status='pending'",
          [b.id],
        );
      break;
    }
    case "requestLoan": {
      const b = await getBook(body.bookId);
      if (b.owner_id === actor)
        problem(400, "You cannot borrow your own book.");
      if (b.availability !== "available" || (await busy(b.id)))
        problem(409, "This copy is not available.");
      await db.query(
        "INSERT INTO club_loans(id,book_id,borrower_id,status) VALUES($1,$2,$3,'pending')",
        [randomUUID(), b.id, actor],
      );
      break;
    }
    case "changeLoan": {
      const l = (
        await db.query(
          "SELECT l.*,b.owner_id,b.availability FROM club_loans l JOIN club_books b ON b.id=l.book_id WHERE l.id=$1",
          [uuid(body.loanId)],
        )
      ).rows[0];
      if (!l) problem(404, "That borrowing request was not found.");
      const lender = l.owner_id === actor,
        borrower = l.borrower_id === actor;
      if (body.status === "cancelled" ? !borrower : !lender)
        problem(403, "You cannot make that change to this loan.");
      const transitions = {
        pending: ["accepted", "declined", "cancelled"],
        accepted: ["lent", "cancelled"],
        lent: ["returned"],
      };
      if (!transitions[l.status]?.includes(body.status))
        problem(409, "This loan has changed. Refresh and try again.");
      if (
        body.status === "accepted" &&
        (l.availability !== "available" || (await busy(l.book_id)))
      )
        problem(409, "This copy is no longer available.");
      await db.query(
        "UPDATE club_loans SET status=$2,updated_at=now() WHERE id=$1",
        [l.id, body.status],
      );
      if (body.status === "accepted")
        await db.query(
          "UPDATE club_loans SET status='declined',updated_at=now() WHERE book_id=$1 AND id<>$2 AND status='pending'",
          [l.book_id, l.id],
        );
      break;
    }
    case "saveRotation": {
      const current = clubMonth(now);
      if (body.anchorMonth !== current)
        problem(
          409,
          "The calendar month changed. Refresh the club and review the rotation.",
        );
      if (
        !Array.isArray(body.memberIds) ||
        body.memberIds.length > 500 ||
        new Set(body.memberIds).size !== body.memberIds.length
      )
        problem(400, "Choose each rotation member once.");
      const ids = body.memberIds.map(uuid);
      const members = (
        await db.query("SELECT id FROM members WHERE id = ANY($1::uuid[])", [
          ids,
        ])
      ).rows;
      if (members.length !== ids.length)
        problem(400, "Choose existing club members.");
      await db.query(
        "UPDATE club_rotation SET anchor_month=$1, member_ids=$2 WHERE id=1",
        [current, ids],
      );
      break;
    }
    case "clearSelection": {
      const result = await db.query(
        "DELETE FROM club_selections WHERE month=$1 RETURNING month",
        [month(body.month)],
      );
      if (!result.rows.length)
        problem(404, "There is no saved selection for that month.");
      break;
    }
    case "saveTurn":
    case "saveSelection": {
      if (!["history", "upcoming"].includes(body.kind))
        problem(400, "Choose a valid reading plan.");
      const when = month(body.month),
        chooser = uuid(body.chooserId),
        bookId = body.bookId ? uuid(body.bookId) : null;
      if (body.kind === "history" && !bookId)
        problem(400, "Choose a book for the reading journal.");
      if (
        !(await db.query("SELECT id FROM members WHERE id=$1", [chooser])).rows
          .length
      )
        problem(400, "Choose an existing club member.");
      if (bookId) await getBook(bookId);
      if (body.action === "saveTurn") {
        const original = body.originalMonth ? month(body.originalMonth) : null;
        if (
          original &&
          !(
            await db.query(
              "SELECT month FROM club_selections WHERE kind=$1 AND month=$2",
              [body.kind, original],
            )
          ).rows.length
        )
          problem(409, "That saved month changed. Refresh and try again.");
        if (
          original !== when &&
          (
            await db.query("SELECT month FROM club_selections WHERE month=$1", [
              when,
            ])
          ).rows.length
        )
          problem(
            409,
            "That month already has a saved selection. Edit or clear it first.",
          );
        if (original && original !== when)
          await db.query(
            "DELETE FROM club_selections WHERE kind=$1 AND month=$2",
            [body.kind, original],
          );
      }
      await db.query(
        `INSERT INTO club_selections(kind,month,chooser_id,book_id,updated_by) VALUES($1,$2,$3,$4,$5)
   ON CONFLICT(kind,month) DO UPDATE SET chooser_id=excluded.chooser_id,book_id=excluded.book_id,updated_by=excluded.updated_by`,
        [body.kind, when, chooser, bookId, actor],
      );
      if (body.kind === "history")
        await db.query(
          "DELETE FROM club_selections WHERE kind='upcoming' AND month=$1",
          [when],
        );
      break;
    }
    case "swapTurns": {
      const first = month(body.month),
        second = month(body.otherMonth);
      const turns = (
        await db.query(
          "SELECT * FROM club_selections WHERE kind='upcoming' ORDER BY month",
        )
      ).rows;
      const i = turns.findIndex((t) => t.month === first),
        j = turns.findIndex((t) => t.month === second);
      if (i < 0 || j < 0 || Math.abs(i - j) !== 1)
        problem(409, "Choose neighboring turns to swap.");
      for (const [target, source] of [
        [turns[i], turns[j]],
        [turns[j], turns[i]],
      ])
        await db.query(
          "UPDATE club_selections SET chooser_id=$1,book_id=$2,updated_by=$3 WHERE kind='upcoming' AND month=$4",
          [source.chooser_id, source.book_id, actor, target.month],
        );
      break;
    }
    default:
      problem(400, "Unknown club action.");
  }
}
export function createClub({ db, auth, limit, now = () => new Date() }) {
  return async (request) => {
    let client;
    try {
      if (!["GET", "POST"].includes(request.method))
        return reply({ error: { message: "Use GET or POST." } }, 405);
      if (!db)
        problem(503, "The club database is unavailable. Please try again.");
      const member = await auth.member(request);
      if (!member) problem(401, "Please log in again to continue.");
      if (request.method === "GET") return reply(await clubSnapshot(db, now()));
      if (
        request.headers.get("origin") !== new URL(request.url).origin ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        problem(403, "Please use the form on this website.");
      if (limit && !(await limit(`club:${member.id}`, 60, 60)))
        problem(429, "Too many changes. Please wait a minute and try again.");
      if (
        request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json"
      )
        problem(415, "Send JSON data.");
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 16384)
        problem(413, "The form is too large.");
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        problem(400, "Invalid form data.");
      }
      if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0)
        problem(400, "Reload the collection before saving.");
      client = await db.connect();
      await client.query("BEGIN");
      await client.query(
        "SET LOCAL idle_in_transaction_session_timeout = '15s'",
      );
      await client.query("SET LOCAL lock_timeout = '4s'");
      const revision = (
        await client.query(
          "SELECT revision FROM club_state WHERE id=1 FOR UPDATE",
        )
      ).rows[0]?.revision;
      if (revision !== body.revision)
        problem(
          409,
          "Someone updated the club. The latest data has been loaded; review your change and save again.",
        );
      await mutate(client, member.id, body, now());
      await client.query(
        "UPDATE club_state SET revision=revision+1 WHERE id=1",
      );
      const state = await clubSnapshot(client, now());
      await client.query("COMMIT");
      return reply(state);
    } catch (error) {
      if (client)
        try {
          await client.query("ROLLBACK");
        } catch {}
      const status =
        error.status ||
        (["23505", "55P03", "40001"].includes(error.code)
          ? 409
          : error.code === "23503"
            ? 400
            : 503);
      if (status === 503)
        console.error("Club operation failed", {
          code: /^[A-Z0-9_]{1,40}$/.test(error.code || "")
            ? error.code
            : "UNAVAILABLE",
        });
      return reply(
        {
          error: {
            message: error.status
              ? error.message
              : status === 409
                ? "This record changed or the request already exists. Refresh and try again."
                : status === 400
                  ? "A selected book or member no longer exists."
                  : "The club could not save or load your data. Please try again.",
          },
        },
        status,
      );
    } finally {
      client?.release();
    }
  };
}
