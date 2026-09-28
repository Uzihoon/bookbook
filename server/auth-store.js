// Works with node-postgres and the isolated PostgreSQL engine used in tests.
// Every value is bound separately; no user input is interpolated into SQL.
export function createAuthStore(db) {
  return {
    async limit(key, max, seconds) {
      await db.query("DELETE FROM auth_limits WHERE expires_at <= now()");
      const { rows } = await db.query(
        `
        INSERT INTO auth_limits (key, attempts, expires_at)
        VALUES ($1, 1, now() + $2 * interval '1 second')
        ON CONFLICT (key) DO UPDATE SET attempts = auth_limits.attempts + 1
        RETURNING attempts`,
        [key, seconds],
      );
      return rows[0].attempts <= max;
    },
    async find(nameKey) {
      return (
        (await db.query("SELECT * FROM members WHERE name_key = $1", [nameKey]))
          .rows[0] || null
      );
    },
    async register({ id, name, nameKey, passwordHash, tokenHash, expiresAt }) {
      const { rows } = await db.query(
        `
        WITH new_member AS (
          INSERT INTO members (id, name, name_key, password_hash)
          VALUES ($1, $2, $3, $4) RETURNING id, name
        ), new_session AS (
          INSERT INTO sessions (token_hash, member_id, expires_at)
          SELECT $5, id, $6 FROM new_member
        ) SELECT id, name FROM new_member`,
        [id, name, nameKey, passwordHash, tokenHash, expiresAt],
      );
      return rows[0];
    },
    async addSession(memberId, tokenHash, expiresAt) {
      await db.query("DELETE FROM sessions WHERE expires_at <= now()");
      await db.query(
        "INSERT INTO sessions (token_hash, member_id, expires_at) VALUES ($1,$2,$3)",
        [tokenHash, memberId, expiresAt],
      );
    },
    async member(tokenHash) {
      return (
        (
          await db.query(
            `SELECT members.id, members.name FROM sessions JOIN members ON members.id=sessions.member_id WHERE token_hash=$1 AND expires_at > now()`,
            [tokenHash],
          )
        ).rows[0] || null
      );
    },
    async revoke(tokenHash) {
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash]);
    },
  };
}
