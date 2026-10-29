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
import { SiteVisitInputSchema } from '@/lib/schemas';

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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const parsed = SiteVisitInputSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        'bad_request',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        400
      );
    }

    const val = parsed.data;
    const insertData: Record<string, unknown> = {
      account_id: ctx.accountId,
      status: val.status,
      pickup_required: val.pickup_required,
    };

    if (val.contact_id !== undefined) insertData.contact_id = val.contact_id;
    if (val.property_id !== undefined) insertData.property_id = val.property_id;
    if (val.scheduled_at !== undefined)
      insertData.scheduled_at = val.scheduled_at;
    if (val.notes !== undefined) insertData.notes = val.notes;
    if (val.pickup_location !== undefined)
      insertData.pickup_location = val.pickup_location;

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
