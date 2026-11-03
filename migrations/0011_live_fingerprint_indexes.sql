-- The live console's change fingerprint (getLiveVersion) reads the newest row of
-- these tables every few seconds; plain created_at indexes make each max() an
-- index lookup instead of a table scan.
create index if not exists threads_created_idx on threads (created_at);
create index if not exists audit_created_idx on audit_log (created_at);
create index if not exists sos_locations_recorded_idx on sos_locations (recorded_at);
create index if not exists incidents_updated_idx on incidents (updated_at);
create index if not exists anonymous_updated_idx on anonymous_reports (updated_at);
