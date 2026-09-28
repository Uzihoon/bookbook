# Bookbook

A responsive book-club app with dimensional book covers, a shared lending shelf, monthly reading history, an editable chooser rotation, and a small Kakao book-search backend.

![Bookbook desktop preview](docs/screenshots/desktop.png)

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. `npm run dev` serves both the frontend and `/api/books`. Production build: `npm run build`. Logic checks: `npm test`. `npm run preview` previews static assets only; use the dev server or Vercel for book search.

## Invite-only member accounts

Joining takes a unique name, a password (12–128 characters), and the club code. Later logins use name and password only. Korean names are supported; names are case-insensitive and must be 2–30 characters after normalization. No email or social login is required.

### One-time database setup

1. Create a hosted PostgreSQL database (for example, [Neon](https://neon.com/)) and copy its pooled connection string with the provider’s TLS settings. Node.js 22 or newer is required.
2. Set `DATABASE_URL` in `.env.local`. Set `CLUB_INVITE_CODE` to a random private value of at least 16 characters. A random code has already been prepared in the local workspace; on a fresh clone, create your own. Never use a `VITE_` prefix.
3. Run `npm run db:migrate`, then restart `npm run dev`. Migrations create the member, session, and request-limit tables and can be run again safely. Without database configuration, authentication fails closed.
4. Open **Join the club**, create your account, and share only the invite code privately with clubmates. Each member chooses their own name and password.
5. Add `DATABASE_URL` and `CLUB_INVITE_CODE` to Vercel’s server environment variables before deploying. Use a separate database and invite code for untrusted/development previews; never point them at the production member database. Run the migration against each database before using it.

The code is reusable for this one club and required only for signup. Changing it blocks new registrations using the old code; existing members and sessions remain valid. Anyone with the current code can join, so distribute it privately. Removing the code closes registration while existing members can still log in.

Passwords are salted scrypt hashes, and session tokens are stored as SHA-256 digests. Sessions expire after 30 days and are carried by HttpOnly, SameSite cookies (Secure on HTTPS/production). Logout revokes the server session. POST requests require the same origin. Persistent request limits apply across function instances, and `/api/books` requires authentication.

Name changes, a password recovery UI, and member administration are not included in this first version. Keep database administration restricted to the organizer. Accounts are persistent; the bookshelf and lending data are still the local demo described below.

## Kakao book search setup

1. Create an app at [Kakao Developers](https://developers.kakao.com/) and copy its **REST API key** (not its JavaScript key).
2. Copy `.env.example` to `.env.local` if that file does not exist. Set `KAKAO_REST_API_KEY=your_key` in `.env.local` and restart `npm run dev`.
3. Log in, then open **Add a book → Search books** and search by Korean title, author, or ISBN. Select an edition and add your own copy.

Keep the key in server environment variables. Never prefix it with `VITE_`, commit it, or paste it into chat. `.env.local` is git-ignored. No Kakao login or JavaScript SDK is needed for this server-to-server search.

The endpoint validates queries, caps pagination, applies a seven-second timeout, and returns normalized metadata without exposing the key or upstream errors. Searches are debounced; stale requests are cancelled. Manual entry works even when search is unavailable. See [Kakao’s book-search documentation](https://developers.kakao.com/docs/ko/daum-search/dev-guide#search-book).

## Deploy on Vercel

1. Import `Uzihoon/bookbook` into your Vercel account and select the Vite framework preset. The root is this repository, the build command is `npm run build`, and the output directory is `dist`.
2. Add `KAKAO_REST_API_KEY`, `DATABASE_URL`, and `CLUB_INVITE_CODE` in project environment variables. Initialize the account schema with `npm run db:migrate` using the matching database connection. Keep preview databases separate from production.
3. Use Node.js 22.x and deploy the version containing both `api/auth.js` and `api/books.js`. Redeploy after changing environment variables. Vercel runs the API as Node.js functions; the browser uses the same origin, so no separate backend URL or CORS setup is needed.
4. Verify signup, logout, login, and Korean title/ISBN searches on the deployed site. Book search is member-only and limited to 60 requests per member per minute.

### Neon CLI setup

The app uses PostgreSQL through `pg`; `neon.ts` contains the minimal Neon configuration. Vercel hosts the app and API. `neon deploy` applies Neon service configuration; it does not deploy this website or create the SQL tables.

```sh
npm i -g neon@latest
neon login
neon link --project-id YOUR_PROJECT_ID --branch production -y --no-env-pull --no-config
neon config plan
neon deploy --no-env-pull
neon env pull --service postgres --file .env.neon
```

The explicit env file keeps local Acer database settings in `.env.local` intact. Both files are ignored by Git. Copy only the pooled `DATABASE_URL` value from `.env.neon` into Vercel's Production environment; keep all TLS parameters. Initialize Neon by running `server/schema.sql` in its SQL Editor. This creates empty tables and does not transfer existing accounts from another database. Use a separate database branch for previews and development.

## Club-data demo

Member accounts and book search have a backend. Lending and monthly picks remain a local demo, with sample people, books, selections, and requests. The signed-in member is shown as “You” in demo records. Browser localStorage retains these changes separately for each member on this device. Previous anonymous demo records are preserved under their original storage key; they are not automatically assigned to a new member. Profile → Reset demo data restores the sample collection. Seed dates are September 2026.

Try adding a book, searching/filtering the shelf, requesting an available copy, accepting Sarah’s sample request, marking a handoff and return, choosing an upcoming book, changing the chooser order, or recording a previous monthly selection. Catalog books retain their cover and edition metadata; manually entered books use a typographic cover in a chosen color.

## Assets

Local cover images are retrieved from Open Library’s Covers API using the relevant ISBNs. Covers remain the property of their publishers and are included for this local prototype. Google Fonts provides DM Sans and Libre Caslon Display; system fallbacks remain usable offline. Icons: Lucide (ISC). No reference website code or artwork was copied.

## Structure

- `src/Auth.jsx`: login, invite-only signup, and session checks
- `src/App.jsx`: views and accessible native dialog flows
- `src/AddBook.jsx`, `src/BookSearch.jsx`: catalog search and copy registration
- `src/catalog.js`: edition metadata and cover handling
- `api/auth.js`, `api/books.js`: Vercel function entry points
- `server/auth.js`, `server/auth-store.js`: authentication, sessions, and persistent request limits
- `server/schema.sql`, `scripts/migrate.js`: Postgres account schema and migration command
- `server/book-search.js`: Kakao proxy, validation, normalization, and errors
- `vite.config.js`: local API middleware and server-only environment loading
- `src/model.js`: sample data and lending transitions
- `src/styles.css`: responsive design and CSS 3D book surfaces
- `src/*.test.js`, `server/*.test.js`: lending, catalog, and API checks

Next: migrate club data to the database, enforce ownership/roles on those operations, and replace the fixed demo month with club scheduling rules.
