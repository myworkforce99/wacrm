import type { SupabaseClient } from '@supabase/supabase-js';
import type { SiteVisit, SiteVisitStatus } from '@/types';

export const SITE_VISIT_SELECT = '*';

export class SiteVisitError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'SiteVisitError';
    this.status = status;
  }
}

export function serializeSiteVisit(row: Record<string, unknown>): SiteVisit {
  return {
    id: row.id as string,
    account_id: row.account_id as string,
    contact_id: (row.contact_id as string | null) ?? null,
    property_id: (row.property_id as string | null) ?? null,
    scheduled_at: (row.scheduled_at as string | null) ?? undefined,
    status: row.status as SiteVisitStatus,
    notes: (row.notes as string | null) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getSiteVisitById(
  db: SupabaseClient,
  accountId: string,
  siteVisitId: string
): Promise<SiteVisit | null> {
  const { data, error } = await db
    .from('site_visits')
    .select(SITE_VISIT_SELECT)
    .eq('id', siteVisitId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return serializeSiteVisit(data as Record<string, unknown>);
}
