CREATE TABLE owners (id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE devices (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES owners(id), name text NOT NULL,
 token_hash text UNIQUE NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id,id)
);
CREATE TABLE accounts (
 id uuid PRIMARY KEY, owner_id text NOT NULL REFERENCES owners(id), device_id uuid NOT NULL,
 source_id text NOT NULL, provider text NOT NULL, name text NOT NULL, plan text,
 deleted_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,device_id) REFERENCES devices(owner_id,id),
 UNIQUE(owner_id,device_id,source_id), UNIQUE(owner_id,id)
);
CREATE TABLE connections (
 id uuid PRIMARY KEY, owner_id text NOT NULL, account_id uuid NOT NULL, device_id uuid NOT NULL,
 source_id text NOT NULL, workspace_id text, kind text NOT NULL DEFAULT 'snapshot-import',
 enabled boolean NOT NULL DEFAULT true, generation integer NOT NULL DEFAULT 0,
 status text NOT NULL DEFAULT 'snapshot-only', message text, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(owner_id,account_id) REFERENCES accounts(owner_id,id),
 FOREIGN KEY(owner_id,device_id) REFERENCES devices(owner_id,id),
 UNIQUE(owner_id,device_id,source_id,account_id), UNIQUE(owner_id,id)
);
CREATE TABLE snapshots (
 id uuid PRIMARY KEY, owner_id text NOT NULL, account_id uuid NOT NULL, connection_id uuid NOT NULL,
 device_id uuid NOT NULL, source_snapshot_id text NOT NULL,
 observed_at bigint NOT NULL CHECK(observed_at>=0), received_at bigint NOT NULL CHECK(received_at>=0),
 payload jsonb NOT NULL, FOREIGN KEY(owner_id,account_id) REFERENCES accounts(owner_id,id),
 FOREIGN KEY(owner_id,connection_id) REFERENCES connections(owner_id,id),
 FOREIGN KEY(owner_id,device_id) REFERENCES devices(owner_id,id),
 UNIQUE(owner_id,device_id,source_snapshot_id)
);
CREATE INDEX snapshots_page ON snapshots(owner_id,account_id,observed_at DESC,id DESC);
CREATE TABLE preferences (owner_id text PRIMARY KEY REFERENCES owners(id), revision integer NOT NULL DEFAULT 0, data jsonb NOT NULL DEFAULT '{}');
CREATE TABLE sessions (token_hash text PRIMARY KEY, owner_id text NOT NULL REFERENCES owners(id), expires_at timestamptz NOT NULL);
CREATE TABLE auth_requests (state_hash text PRIMARY KEY, binding_hash text NOT NULL, verifier text NOT NULL, nonce text NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE jobs (
 id uuid PRIMARY KEY, owner_id text NOT NULL, connection_id uuid NOT NULL, generation integer NOT NULL,
 kind text NOT NULL, status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0,
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, lease_token uuid,
 FOREIGN KEY(owner_id,connection_id) REFERENCES connections(owner_id,id)
);
CREATE UNIQUE INDEX one_active_job ON jobs(owner_id,connection_id) WHERE status IN ('queued','running');
