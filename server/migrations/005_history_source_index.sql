-- Bound per-source retention/latest checks without scanning every account's history.
CREATE INDEX snapshots_source_time ON snapshots(owner_id,connection_id,observed_at DESC,id DESC);
