import pg from "pg";
export function openDatabase(connectionString) {
  if (!connectionString?.trim()) return null;
  const pool = new pg.Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
    query_timeout: 7000,
    statement_timeout: 7000,
    allowExitOnIdle: true,
  });
  pool.on("error", () =>
    console.error("An idle database connection was lost."),
  );
  return pool;
}
