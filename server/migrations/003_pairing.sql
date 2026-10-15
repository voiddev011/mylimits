CREATE TABLE pair_requests (
 id uuid PRIMARY KEY, secret_hash text NOT NULL, user_code text UNIQUE NOT NULL,
 name text NOT NULL, approved_owner text REFERENCES owners(id),
 expires_at bigint NOT NULL, consumed_at bigint
);
CREATE INDEX pair_expiry ON pair_requests(expires_at);
ALTER TABLE auth_requests ADD COLUMN return_path text NOT NULL DEFAULT '/';
