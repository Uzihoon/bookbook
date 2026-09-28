import { defineConfig, loadEnv } from "vite";
import { createRoutes } from "./server/routes.js";
import { apiMiddleware } from "./server/vite-api.js";
export default defineConfig(({ mode }) => {
  // Read on the server only. Never place secrets in define or VITE_ variables.
  const fileEnv = loadEnv(mode, process.cwd(), "");
  const env = Object.fromEntries(
    ["DATABASE_URL", "CLUB_INVITE_CODE", "KAKAO_REST_API_KEY"].map((key) => [
      key,
      process.env[key] || fileEnv[key],
    ]),
  );
  return {
    plugins: [
      {
        name: "local-api",
        configureServer(server) {
          server.middlewares.use(apiMiddleware(createRoutes(env)));
        },
      },
    ],
  };
});
