ALTER TABLE connections ADD COLUMN verified_identity_hash text;
ALTER TABLE jobs ADD COLUMN error_code text;
CREATE INDEX ready_jobs ON jobs(status,available_at,lease_until);
CREATE TABLE encrypted_credentials (
 owner_id text NOT NULL, connection_id uuid NOT NULL, generation integer NOT NULL,
 revision integer NOT NULL, envelope jsonb NOT NULL,
 PRIMARY KEY(owner_id,connection_id),
 FOREIGN KEY(owner_id,connection_id) REFERENCES connections(owner_id,id)
);
CREATE TABLE provider_budgets (provider text PRIMARY KEY, window_start bigint NOT NULL, attempts integer NOT NULL DEFAULT 0);
CREATE TABLE connection_cleanup (
 owner_id text NOT NULL,connection_id uuid NOT NULL,generation integer NOT NULL,
 attempts integer NOT NULL DEFAULT 0,available_at bigint NOT NULL,expires_at bigint NOT NULL,
 PRIMARY KEY(owner_id,connection_id),FOREIGN KEY(owner_id,connection_id) REFERENCES connections(owner_id,id)
);
