-- Additive: existing website/native accounts and historical snapshots are unchanged.
CREATE TABLE hosted_connections (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES owners(id), provider text NOT NULL CHECK(provider IN ('openai','claude')),
 method text NOT NULL, subject text NOT NULL, workspace text NOT NULL DEFAULT '', alias text NOT NULL DEFAULT '',
 capabilities jsonb NOT NULL, state text NOT NULL DEFAULT 'active', generation integer NOT NULL DEFAULT 0,
 fetched_at bigint, provider_observed_at bigint, next_eligible_at bigint,
 error_code text, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id), UNIQUE(owner_id,provider,method,subject,workspace)
);
CREATE TABLE hosted_attempts (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES owners(id), provider text NOT NULL,
 request_id uuid NOT NULL, reconnect_id uuid, generation integer NOT NULL DEFAULT 0,
 state text NOT NULL DEFAULT 'pending', proof_hash text NOT NULL, expires_at bigint NOT NULL,
 connection_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,request_id), UNIQUE(owner_id,id),
 FOREIGN KEY(owner_id,reconnect_id) REFERENCES hosted_connections(owner_id,id),
 FOREIGN KEY(owner_id,connection_id) REFERENCES hosted_connections(owner_id,id)
);
CREATE INDEX hosted_attempt_expiry ON hosted_attempts(state,expires_at);
CREATE TABLE hosted_readings (
 id uuid PRIMARY KEY, owner_id text NOT NULL, connection_id uuid NOT NULL, generation integer NOT NULL,
 fetched_at bigint NOT NULL, provider_observed_at bigint, meters jsonb NOT NULL,
 FOREIGN KEY(owner_id,connection_id) REFERENCES hosted_connections(owner_id,id)
);
CREATE INDEX hosted_reading_page ON hosted_readings(owner_id,connection_id,fetched_at DESC,id DESC);
CREATE TABLE hosted_credentials (
 owner_id text NOT NULL, connection_id uuid NOT NULL, generation integer NOT NULL, envelope jsonb NOT NULL,
 PRIMARY KEY(owner_id,connection_id), FOREIGN KEY(owner_id,connection_id) REFERENCES hosted_connections(owner_id,id)
);
CREATE TABLE hosted_jobs (
 owner_id text NOT NULL, connection_id uuid NOT NULL, generation integer NOT NULL,
 available_at bigint NOT NULL, lease_token uuid, lease_until bigint, attempts integer NOT NULL DEFAULT 0,
 PRIMARY KEY(owner_id,connection_id), FOREIGN KEY(owner_id,connection_id) REFERENCES hosted_connections(owner_id,id)
);
