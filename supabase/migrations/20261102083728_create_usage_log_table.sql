/*
# Create usage_log table for rate-limiting the generate-custom Edge Function

1. New Tables
   - `usage_log`
     - `id` (uuid, primary key, auto-generated)
     - `ip_hash` (text, not null) — SHA-256 hash of the visitor's IP; raw IP is never stored
     - `created_at` (timestamptz, defaults to now()) — used to scope counts to a 24-hour window

2. Security
   - Enable RLS on `usage_log`.
   - NO public policies — the table is locked down so anon and authenticated roles cannot read or write it.
   - Grant CRUD only to `service_role` (used by the Edge Function, which bypasses RLS).
   - anon and authenticated receive NO grants and NO policies, so the Data API cannot reach this table.

3. Index
   - Index on `created_at` for efficient 24-hour window queries.
   - Composite index on `ip_hash, created_at` for efficient per-visitor count queries.

4. Important Notes
   - The Edge Function uses the service role key, which bypasses RLS, so it can INSERT and SELECT freely.
   - Only hashed IPs are stored, never raw IPs, for privacy.
*/

CREATE TABLE IF NOT EXISTS usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;

-- No policies created: table is locked to all roles.
-- Only service_role (which bypasses RLS) can read/write, via the Edge Function.
GRANT SELECT, INSERT ON usage_log TO service_role;

CREATE INDEX IF NOT EXISTS idx_usage_log_created_at ON usage_log (created_at);
CREATE INDEX IF NOT EXISTS idx_usage_log_ip_hash_created_at ON usage_log (ip_hash, created_at);
