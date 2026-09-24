import { requireApiKey } from '@/lib/auth/api-context';
import { ok, okList, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import {
  parseListParams,
  keysetFilter,
  buildPage,
} from '@/lib/api/v1/pagination';
import {
  PROPERTY_SELECT,
  serializeProperty,
  PropertyError,
} from '@/lib/api/v1/properties';

export async function GET(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'properties:read');
    const { limit, cursor } = parseListParams(request);

    let query = ctx.supabase
      .from('properties')
      .select(PROPERTY_SELECT)
      .eq('account_id', ctx.accountId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(limit + 1);

    const kf = keysetFilter(cursor);
    if (kf) query = query.or(kf);

    const { data, error } = await query;
    if (error) {
      console.error('[api/v1/properties] list error:', error);
      return fail('internal', 'Failed to list properties', 500);
    }

    const { items, nextCursor } = buildPage(
      (data ?? []) as unknown as Array<{ created_at: string; id: string }>,
      limit
    );
    return okList(
      items.map((r) => serializeProperty(r as Record<string, unknown>)),
      nextCursor
    );
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requireApiKey(request, 'properties:write');

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    if (typeof body.title !== 'string' || !body.title.trim()) {
      return fail('bad_request', "'title' is required", 400);
    }

    const insertData: Record<string, unknown> = {
      account_id: ctx.accountId,
      title: body.title.trim(),
    };

    if (typeof body.location === 'string') insertData.location = body.location;
    if (typeof body.price === 'number') insertData.price = body.price;
    if (typeof body.property_type === 'string') insertData.property_type = body.property_type;
    if (typeof body.bedrooms === 'number') insertData.bedrooms = body.bedrooms;
    if (Array.isArray(body.tags)) insertData.tags = body.tags.filter((t) => typeof t === 'string');

    const { data, error } = await ctx.supabase
      .from('properties')
      .insert(insertData)
      .select(PROPERTY_SELECT)
      .single();

    if (error || !data) {
      console.error('[api/v1/properties] create error:', error);
      throw new PropertyError('Failed to create property', 500);
    }

    return ok(serializeProperty(data as Record<string, unknown>), 201);
  } catch (err) {
    if (err instanceof PropertyError) {
      return fail(
        err.status === 400 ? 'bad_request' : 'internal',
        err.message,
        err.status
      );
    }
    return toApiErrorResponse(err);
  }
}
