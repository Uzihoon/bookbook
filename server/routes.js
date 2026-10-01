import { createClub } from "./club.js";
import { openDatabase } from "./database.js";
import { createAuthStore } from "./auth-store.js";
import { createAuth, protectSearch } from "./auth.js";
import { createBookSearchHandler } from "./book-search.js";
export function createRoutes(
  env = process.env,
  db = openDatabase(env.DATABASE_URL),
) {
  const auth = createAuth({
    store: db ? createAuthStore(db) : null,
    getInviteCode: () => env.CLUB_INVITE_CODE,
  });
  return {
    "/api/auth": auth.handle,
    "/api/club": createClub({
      db,
      auth,
      limit: db ? createAuthStore(db).limit : null,
    }),
    "/api/books": protectSearch(
      createBookSearchHandler({ getApiKey: () => env.KAKAO_REST_API_KEY }),
      auth,
    ),
  };
}
let routes;
export function handleApi(request) {
  routes ||= createRoutes();
  const route = routes[new URL(request.url).pathname];
  return route
    ? route(request)
    : Response.json({ error: { message: "Not found." } }, { status: 404 });
}
