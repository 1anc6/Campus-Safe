import { getSql } from "@/backend/db";
import { audit } from "@/backend/core/helpers";
import { REDACTED_REPORTER } from "@/lib/access";

/** Days a resolved/closed report keeps its reporter and photo. */
export function retentionDays(): number {
  const n = Number(process.env.RETENTION_DAYS);
  return Number.isInteger(n) && n >= 30 ? n : 365;
}

/**
 * De-identify reports that have been resolved or closed for longer than the
 * retention period: the photo is deleted, the link to the student's account is
 * cut, and the anonymous tracking thread is emptied. What happened, where and
 * when stays, so campus statistics and hotspot maps keep working.
 */
export async function purgeExpiredReports(): Promise<{ incidents: number; anonymous: number }> {
  const sql = await getSql();
  const days = retentionDays();
  const expired = await sql<{ id: string }>`
    select id from incidents
    where status in ('resolved', 'closed') and redacted_at is null
      and updated_at < now() - make_interval(days => ${days})
    limit 500
  `;
  const ids = expired.map((r) => r.id);
  if (ids.length) {
    await sql`delete from incident_photos where incident_id = any(${ids}::text[])`;
    await sql`
      update incidents
      set user_id = ${REDACTED_REPORTER}, photo_data = null, redacted_at = now()
      where id = any(${ids}::text[])
    `;
  }
  // Anonymous reports carry no identity, but their replies can: clear old threads.
  const anon = await sql<{ id: string }>`
    delete from threads
    where kind = 'anonymous' and author_role <> 'system' and subject_id in (
      select id from anonymous_reports
      where status in ('resolved', 'closed') and updated_at < now() - make_interval(days => ${days})
    )
    returning subject_id as id
  `;
  const anonCount = new Set(anon.map((r) => r.id)).size;
  if (ids.length || anonCount) {
    await audit(
      null,
      "retention.purge",
      undefined,
      undefined,
      `${ids.length} incidents, ${anonCount} anonymous`,
    );
  }
  return { incidents: ids.length, anonymous: anonCount };
}
