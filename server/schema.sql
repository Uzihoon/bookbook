BEGIN;
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  name_key text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_member_idx ON sessions(member_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_limits_expiry_idx ON auth_limits(expires_at);
CREATE TABLE IF NOT EXISTS club_state (
  id integer PRIMARY KEY CHECK (id = 1),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0)
);
INSERT INTO club_state(id) VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS club_books (
  id uuid PRIMARY KEY,
  owner_id uuid NOT NULL REFERENCES members(id),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 300),
  author text NOT NULL CHECK (length(author) BETWEEN 1 AND 300),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability text NOT NULL DEFAULT 'available' CHECK (availability IN ('available','unlisted')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS club_books_owner_idx ON club_books(owner_id);
CREATE TABLE IF NOT EXISTS club_loans (
  id uuid PRIMARY KEY,
  book_id uuid NOT NULL REFERENCES club_books(id),
  borrower_id uuid NOT NULL REFERENCES members(id),
  status text NOT NULL CHECK (status IN ('pending','accepted','lent','returned','declined','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS club_loans_active_copy_idx ON club_loans(book_id) WHERE status IN ('accepted','lent');
CREATE UNIQUE INDEX IF NOT EXISTS club_loans_request_idx ON club_loans(book_id,borrower_id) WHERE status IN ('pending','accepted','lent');
CREATE INDEX IF NOT EXISTS club_loans_borrower_idx ON club_loans(borrower_id);
CREATE TABLE IF NOT EXISTS club_selections (
  kind text NOT NULL CHECK (kind IN ('history','upcoming')),
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  chooser_id uuid NOT NULL REFERENCES members(id),
  book_id uuid REFERENCES club_books(id),
  updated_by uuid NOT NULL REFERENCES members(id),
  CHECK (kind = 'upcoming' OR book_id IS NOT NULL),
  PRIMARY KEY (kind,month)
);
COMMIT;
