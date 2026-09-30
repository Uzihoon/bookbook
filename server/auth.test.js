import test, { before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { createAuth, protectSearch } from "./auth.js";
import { createAuthStore } from "./auth-store.js";
const db = new PGlite();
const code = "our-private-club-2026";
const password = "a long bookish password";
const origin = "https://bookbook.test";
let auth;
before(async () => {
  await db.exec(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
});
beforeEach(async () => {
  await db.exec("TRUNCATE members, sessions, auth_limits CASCADE");
  auth = createAuth({ store: createAuthStore(db), getInviteCode: () => code });
});
after(() => db.close());
function req(action, body, cookie, requestOrigin = origin) {
  return new Request(`${origin}/api/auth${action ? "?action=" + action : ""}`, {
    method: action ? "POST" : "GET",
    headers: {
      ...(action
        ? { "Content-Type": "application/json", Origin: requestOrigin }
        : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(action ? { body: JSON.stringify(body || {}) } : {}),
  });
}
const signup = (name = "지우", inviteCode = code) =>
  auth.handle(req("signup", { name, password, inviteCode }));
const cookieOf = (r) => r.headers.get("set-cookie")?.split(";")[0];
for (const inviteCode of ["x", "READ2026", "x".repeat(129)]) {
  test(`signup accepts a matching ${inviteCode.length}-character invite code`, async () => {
    auth = createAuth({
      store: createAuthStore(db),
      getInviteCode: () => inviteCode,
    });
    assert.equal((await signup("지우", "incorrect-code")).status, 403);
    const response = await signup("지우", inviteCode);
    assert.equal(response.status, 201);
    assert.equal((await response.json()).member.name, "지우");
  });
}
test("signup requires the club code and never creates an account for an invalid code", async () => {
  const r = await signup("지우", "wrong-code");
  assert.equal(r.status, 403);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM members")).rows[0].n,
    0,
  );
});
test("signup stores a password hash and opaque session, and returns only safe member fields", async () => {
  const r = await signup();
  assert.equal(r.status, 201);
  const data = await r.json();
  assert.equal(data.member.name, "지우");
  assert.deepEqual(Object.keys(data.member).sort(), ["id", "name"]);
  const cookie = r.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  const member = (await db.query("SELECT * FROM members")).rows[0];
  assert.notEqual(member.password_hash, password);
  assert.match(member.password_hash, /^scrypt\$/);
  const session = (await db.query("SELECT * FROM sessions")).rows[0];
  assert.ok(!cookie.includes(session.token_hash));
  const me = await auth.handle(req(null, null, cookieOf(r)));
  assert.equal((await me.json()).member.id, data.member.id);
});
test("names are unique after Unicode normalization and case folding", async () => {
  assert.equal((await signup(" Jiwoo ")).status, 201);
  assert.equal((await signup("ＪＩＷＯＯ")).status, 409);
  const r = await auth.handle(req("login", { name: "jiWOO", password }));
  assert.equal(r.status, 200);
});
test("login needs no invite code and uses generic failure for unknown name or wrong password", async () => {
  await signup();
  const bad = await auth.handle(
    req("login", { name: "지우", password: "wrong password" }),
  );
  const missing = await auth.handle(
    req("login", { name: "없는이름", password }),
  );
  assert.equal(bad.status, 401);
  assert.deepEqual(await bad.json(), await missing.json());
  assert.equal(
    (await auth.handle(req("login", { name: "지우", password }))).status,
    200,
  );
});
test("logout revokes sessions and expiry blocks authentication", async () => {
  const r = await signup();
  const cookie = cookieOf(r);
  const loggedOut = await auth.handle(req("logout", {}, cookie));
  assert.equal(loggedOut.status, 200);
  assert.match(loggedOut.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(await auth.member(req(null, null, cookie)), null);
  const fresh = await auth.handle(req("login", { name: "지우", password }));
  await db.query("UPDATE sessions SET expires_at=now()-interval '1 second'");
  assert.equal(await auth.member(req(null, null, cookieOf(fresh))), null);
});
test("cross-origin, missing-origin, and malformed requests are rejected before account creation", async () => {
  assert.equal(
    (
      await auth.handle(
        req(
          "signup",
          { name: "지우", password, inviteCode: code },
          null,
          "https://evil.test",
        ),
      )
    ).status,
    403,
  );
  const noOrigin = req("signup", { name: "지우", password, inviteCode: code });
  noOrigin.headers.delete("origin");
  assert.equal((await auth.handle(noOrigin)).status, 403);
  const malformed = req("signup", {});
  malformed.headers.set("content-type", "text/plain");
  assert.equal((await auth.handle(malformed)).status, 415);
  assert.equal((await signup("a")).status, 400);
  assert.equal(
    (
      await auth.handle(
        req("signup", { name: "지우", password: "short", inviteCode: code }),
      )
    ).status,
    400,
  );
  assert.equal(
    (await auth.handle(new Request(origin + "/api/auth", { method: "DELETE" })))
      .status,
    405,
  );
});
test("persistent throttling survives a new handler instance", async () => {
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await auth.handle(req("login", { name: "지우", password }))).status,
      401,
    );
  auth = createAuth({ store: createAuthStore(db), getInviteCode: () => code });
  const blocked = await auth.handle(req("login", { name: "지우", password }));
  assert.equal(blocked.status, 429);
  assert.ok(blocked.headers.get("retry-after"));
});
test("invite rotation affects new signups but leaves existing logins usable", async () => {
  await signup();
  auth = createAuth({
    store: createAuthStore(db),
    getInviteCode: () => code + "-new",
  });
  assert.equal((await signup("민아")).status, 403);
  assert.equal(
    (await auth.handle(req("login", { name: "지우", password }))).status,
    200,
  );
});
test("missing configuration fails closed without echoing secrets", async () => {
  const missing = createAuth({ store: null, getInviteCode: () => "" });
  const r = await missing.handle(
    req("signup", { name: "지우", password, inviteCode: code }),
  );
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes(code));
  const closed = createAuth({
    store: createAuthStore(db),
    getInviteCode: () => "",
  });
  assert.equal(
    (
      await closed.handle(
        req("signup", { name: "지우", password, inviteCode: code }),
      )
    ).status,
    503,
  );
});
test("book search requires a valid server session", async () => {
  let calls = 0;
  const run = protectSearch(async () => {
    calls++;
    return Response.json({ books: [] });
  }, auth);
  const url = origin + "/api/books?query=한강";
  assert.equal((await run(new Request(url))).status, 401);
  assert.equal(calls, 0);
  const r = await signup();
  assert.equal(
    (await run(new Request(url, { headers: { Cookie: cookieOf(r) } }))).status,
    200,
  );
  assert.equal(calls, 1);
});

test("a new login rotates the browser session and a tampered cookie is rejected", async () => {
  const joined = await signup();
  const oldCookie = cookieOf(joined);
  const login = await auth.handle(
    req("login", { name: "지우", password }, oldCookie),
  );
  assert.equal(login.status, 200);
  assert.notEqual(cookieOf(login), oldCookie);
  assert.equal(await auth.member(req(null, null, oldCookie)), null);
  const tampered = cookieOf(login).slice(0, -1) + "!";
  assert.equal(await auth.member(req(null, null, tampered)), null);
  assert.ok(await auth.member(req(null, null, cookieOf(login))));
});
test("concurrent signup cannot create duplicate members or orphan sessions", async () => {
  const replies = await Promise.all([signup("민아"), signup("민아")]);
  assert.deepEqual(replies.map((r) => r.status).sort(), [201, 409]);
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM members")).rows[0].n,
    1,
  );
  assert.equal(
    (await db.query("SELECT count(*)::int AS n FROM sessions")).rows[0].n,
    1,
  );
});
test("database errors fail closed and never leak connection details", async () => {
  const broken = createAuth({
    store: {
      member: async () => {
        throw new Error("postgres://private-secret@example/db");
      },
    },
    getInviteCode: () => code,
  });
  const r = await broken.handle(
    req(null, null, "bookbook_session=" + "a".repeat(43)),
  );
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes("private-secret"));
});
