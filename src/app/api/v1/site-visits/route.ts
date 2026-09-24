import { requireApiKey } from '@/lib/auth/api-context';
import { ok, okList, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import {
  parseListParams,
  keysetFilter,
  buildPage,
} from '@/lib/api/v1/pagination';
import {
  SITE_VISIT_SELECT,
  serializeSiteVisit,
  SiteVisitError,
} from '@/lib/api/v1/site-visits';
import type { SiteVisitStatus } from '@/types';

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'site_visits:read');
    const { limit, cursor } = parseListParams(request);

    let query = ctx.supabase
      .from('site_visits')
      .select(SITE_VISIT_SELECT)
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    const kf = keysetFilter(cursor);
    if (kf) query = query.or(kf);

    const { data, error } = await query;
    if (error) {
      console.error('[api/v1/site-visits] list error:', error);
      return fail('internal', 'Failed to list site visits', 500);
    }

    const { items, nextCursor } = buildPage(
      (data ?? []) as unknown as Array<{ created_at: string; id: string }>,
      limit
    );
    return okList(
      items.map((r) => serializeSiteVisit(r as Record<string, unknown>)),
      nextCursor
    );
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'site_visits:write');

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const insertData: Record<string, unknown> = {
      account_id: ctx.accountId,
    };

    if (typeof body.contact_id === 'string') insertData.contact_id = body.contact_id;
    if (typeof body.property_id === 'string') insertData.property_id = body.property_id;
    if (typeof body.scheduled_at === 'string') insertData.scheduled_at = body.scheduled_at;
    if (typeof body.status === 'string') {
      const validStatuses: SiteVisitStatus[] = ['pending', 'confirmed', 'completed', 'no_show', 'rescheduled'];
      if (!validStatuses.includes(body.status as SiteVisitStatus)) {
        return fail('bad_request', 'Invalid status', 400);
      }
      insertData.status = body.status;
    }
    if (typeof body.notes === 'string') insertData.notes = body.notes;

    const { data, error } = await ctx.supabase
      .from('site_visits')
      .insert(insertData)
      .select(SITE_VISIT_SELECT)
      .single();

    if (error || !data) {
      console.error('[api/v1/site-visits] create error:', error);
      throw new SiteVisitError('Failed to create site visit', 500);
    }

    return ok(serializeSiteVisit(data as Record<string, unknown>), 201);
  } catch (err) {
    if (err instanceof SiteVisitError) {
      return fail(
        err.status === 400 ? 'bad_request' : 'internal',
        err.message,
        err.status
      );
    }
    return toApiErrorResponse(err);
  }
}
