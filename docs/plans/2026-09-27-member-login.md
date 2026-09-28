# Invite-only member login implementation plan

**Goal:** Join with a unique name, password and club code; subsequent login needs name and password only.

**Architecture:** Existing Vite frontend and Vercel Node endpoints use Postgres for members, opaque sessions and durable request limits. A reusable server-only invite code gates account creation. Names use Unicode normalization and case-insensitive uniqueness. Passwords are salted scrypt hashes; only token digests are persisted. HttpOnly, SameSite cookies carry sessions. Existing book-search API requires a session. Missing database configuration fails closed. Club data remains explicitly labeled, member-scoped local demo data until its separate migration.

**Tech stack:** React, Node crypto, node-postgres, Postgres; PGlite for isolated SQL integration tests.

1. Write failing integration tests in `server/auth.test.js` for signup, validation, login, sessions, CSRF, throttling and protected search. Use real SQL via in-memory PGlite. Confirm failure against stubs.
2. Implement `server/auth.js`, `server/auth-store.js`, `server/database.js`, and `server/schema.sql`. Add an explicit migration command; never silently fall back to ephemeral storage in production.
3. Add `/api/auth` dispatch and session-gated `/api/books`. Share the same routes through local Vite middleware with bounded POST bodies and server-only env loading.
4. Build `src/Auth.jsx`, wrap App, identify the signed-in member and add logout. Isolate browser demo data by member ID without claiming it is shared. Match the existing cream/burgundy design and test mobile widths.
5. Run tests and production build, inspect browser signup/login/error flows using an isolated test database, document the database/env setup and limitations. No external accounts, deployment, or secret disclosure.

Scope choices: single club; one rotatable reusable invitation code, signup only; 30-day fixed sessions; name changes, email, password recovery UI and shared club data are follow-up work. Database provider is pending user input; SQL works with hosted Postgres, including Neon.
