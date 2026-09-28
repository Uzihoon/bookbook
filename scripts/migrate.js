import { loadEnvFile } from "node:process";
import { readFile } from "node:fs/promises";
import { openDatabase } from "../server/database.js";
try {
  loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const db = openDatabase(process.env.DATABASE_URL);
if (!db) {
  console.error("Set DATABASE_URL in .env.local before running db:migrate.");
  process.exitCode = 1;
} else {
  try {
    await db.query(
      await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
    );
    console.log("Member, session and request-limit tables are ready.");
  } catch {
    console.error(
      "Migration failed. Check the database connection, permissions and SQL schema. No connection secrets were logged.",
    );
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
