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
import { PropertyInputSchema } from '@/lib/schemas';

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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const parsed = PropertyInputSchema.safeParse(body);
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
      title: val.title,
    };

    if (val.location !== undefined) insertData.location = val.location;
    if (val.price !== undefined) insertData.price = val.price;
    if (val.property_type !== undefined)
      insertData.property_type = val.property_type;
    if (val.bedrooms !== undefined) insertData.bedrooms = val.bedrooms;
    if (val.tags !== undefined) insertData.tags = val.tags;
    if (val.configuration !== undefined)
      insertData.configuration = val.configuration;
    if (val.builder_name !== undefined)
      insertData.builder_name = val.builder_name;
    if (val.project_name !== undefined)
      insertData.project_name = val.project_name;
    if (val.rera_id !== undefined) insertData.rera_id = val.rera_id;
    if (val.possession_status !== undefined)
      insertData.possession_status = val.possession_status;
    if (val.possession_date !== undefined)
      insertData.possession_date = val.possession_date;
    if (val.carpet_area !== undefined) insertData.carpet_area = val.carpet_area;
    if (val.facing !== undefined) insertData.facing = val.facing;

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
