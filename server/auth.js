import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
const derive = promisify(scrypt);
const COOKIE = "bookbook_session";
const TTL = 60 * 60 * 24 * 30;
const SCRYPT = { N: 65536, r: 8, p: 2, maxmem: 128 * 1024 * 1024 };
const digest = (value) => createHash("sha256").update(value).digest("hex");
const json = (body, status = 200, extra = {}) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
const fail = (status, code, message, extra) =>
  json({ error: { code, message } }, status, extra);
const unavailable = () =>
  fail(
    503,
    "AUTH_UNAVAILABLE",
    "Member login is not available yet. Please try again later.",
  );
const limited = () =>
  fail(
    429,
    "TOO_MANY_ATTEMPTS",
    "Too many attempts. Please wait 15 minutes before trying again.",
    { "Retry-After": "900" },
  );
function tokenFrom(request) {
  const tokens = (request.headers.get("cookie") || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.startsWith(COOKIE + "="));
  if (tokens.length !== 1) return null;
  const token = tokens[0].slice(COOKIE.length + 1);
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}
function cookie(request, token = "", seconds = TTL) {
  const secure =
    new URL(request.url).protocol === "https:" ||
    process.env.VERCEL === "1" ||
    process.env.NODE_ENV === "production";
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${secure ? "; Secure" : ""}`;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString("base64url");
  const key = await derive(password, salt, 64, SCRYPT);
  return `scrypt$${salt}$${key.toString("base64url")}`;
}
async function verifyPassword(password, encoded) {
  const [, salt, expected] = encoded.split("$");
  const key = await derive(password, salt, 64, SCRYPT);
  const reference = Buffer.from(expected, "base64url");
  return reference.length === key.length && timingSafeEqual(reference, key);
}
// Unknown names cost the same password derivation work as existing accounts.
const DUMMY_HASH =
  "scrypt$bookbook-dummy-salt$" + Buffer.alloc(64).toString("base64url");
function nameDetails(value) {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
  if (
    [...name].length < 2 ||
    [...name].length > 30 ||
    !/^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.-]*$/u.test(name)
  )
    return null;
  return { name, nameKey: name.toLowerCase() };
}
export function createAuth({
  store,
  getInviteCode = () => process.env.CLUB_INVITE_CODE,
} = {}) {
  async function member(request) {
    if (!store) throw new Error("AUTH_UNAVAILABLE");
    const token = tokenFrom(request);
    return token ? store.member(digest(token)) : null;
  }
  async function handle(request) {
    try {
      if (!["GET", "POST"].includes(request.method))
        return fail(405, "METHOD_NOT_ALLOWED", "Use GET or POST.", {
          Allow: "GET, POST",
        });
      if (!store) return unavailable();
      if (request.method === "GET")
        return json({ member: await member(request) });
      const url = new URL(request.url);
      if (
        request.headers.get("origin") !== url.origin ||
        request.headers.get("sec-fetch-site") === "cross-site"
      )
        return fail(
          403,
          "INVALID_ORIGIN",
          "Please use the login form on this website.",
        );
      if (
        request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json"
      )
        return fail(415, "INVALID_CONTENT_TYPE", "Send JSON data.");
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 4096)
        return fail(413, "TOO_LARGE", "The form is too large.");
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        return fail(
          400,
          "INVALID_FORM",
          "Please check the form and try again.",
        );
      }
      if (!body || typeof body !== "object" || Array.isArray(body))
        return fail(
          400,
          "INVALID_FORM",
          "Please check the form and try again.",
        );
      const action = url.searchParams.get("action");
      if (action === "logout") {
        const token = tokenFrom(request);
        if (token) await store.revoke(digest(token));
        return json({ member: null }, 200, {
          "Set-Cookie": cookie(request, "", 0),
        });
      }
      if (!["signup", "login"].includes(action))
        return fail(400, "INVALID_ACTION", "Choose login or join the club.");
      const details = nameDetails(body.name);
      if (!details)
        return fail(
          400,
          "INVALID_NAME",
          "Use a name of 2–30 characters: letters, numbers, spaces, dots, hyphens or underscores.",
        );
      const { name, nameKey } = details;
      const password = body.password;
      if (
        typeof password !== "string" ||
        [...password].length < (action === "signup" ? 12 : 1) ||
        [...password].length > 128
      )
        return fail(
          400,
          "INVALID_PASSWORD",
          action === "signup"
            ? "Use a password of 12–128 characters."
            : "Enter your password.",
        );
      // Durable limits apply across all serverless instances. The global budget
      // bounds hashing work and attempts to guess invite codes with many names.
      if (
        !(await store.limit("auth:global", 60, 900)) ||
        !(await store.limit(`${action}:name:${digest(nameKey)}`, 5, 900))
      )
        return limited();
      const token = randomBytes(32).toString("base64url");
      const tokenHash = digest(token),
        expiresAt = new Date(Date.now() + TTL * 1000);
      let current;
      if (action === "signup") {
        const invite = getInviteCode()?.trim();
        if (!invite || invite.length < 16) return unavailable();
        if (
          typeof body.inviteCode !== "string" ||
          !timingSafeEqual(
            Buffer.from(digest(body.inviteCode.trim()), "hex"),
            Buffer.from(digest(invite), "hex"),
          )
        )
          return fail(
            403,
            "INVALID_INVITE",
            "That club code isn’t valid. Ask your club organizer for the current code.",
          );
        const passwordHash = await hashPassword(password);
        try {
          current = await store.register({
            id: randomUUID(),
            name,
            nameKey,
            passwordHash,
            tokenHash,
            expiresAt,
          });
        } catch (error) {
          if (error.code === "23505")
            return fail(
              409,
              "NAME_TAKEN",
              "That name is already in use. Try adding a nickname or initial.",
            );
          throw error;
        }
      } else {
        const account = await store.find(nameKey);
        const valid = await verifyPassword(
          password,
          account?.password_hash || DUMMY_HASH,
        );
        if (!account || !valid)
          return fail(
            401,
            "INVALID_CREDENTIALS",
            "The name or password is incorrect.",
          );
        current = { id: account.id, name: account.name };
        await store.addSession(current.id, tokenHash, expiresAt);
      }
      // Revoke the previous browser session when switching accounts.
      const previous = tokenFrom(request);
      if (previous) await store.revoke(digest(previous));
      return json({ member: current }, action === "signup" ? 201 : 200, {
        "Set-Cookie": cookie(request, token),
      });
    } catch {
      return unavailable();
    }
  }
  return {
    handle,
    member,
    async searchAllowed(id) {
      return store.limit(`search:${id}`, 60, 60);
    },
  };
}
export function protectSearch(handler, auth) {
  return async (request) => {
    try {
      const member = await auth.member(request);
      if (!member)
        return fail(401, "LOGIN_REQUIRED", "Please log in to search books.");
      if (!(await auth.searchAllowed(member.id)))
        return fail(
          429,
          "SEARCH_RATE_LIMITED",
          "Please wait a minute before searching again.",
          { "Retry-After": "60" },
        );
      return await handler(request);
    } catch {
      return unavailable();
    }
  };
}
