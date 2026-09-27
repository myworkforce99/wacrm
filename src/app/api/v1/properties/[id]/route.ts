import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { getPropertyById, PropertyError } from '@/lib/api/v1/properties';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'properties:read');
    const { id } = await params;
    const property = await getPropertyById(ctx.supabase, ctx.accountId, id);
    if (!property) return fail('not_found', 'Property not found', 404);
    return ok(property);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'properties:write');
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const existing = await getPropertyById(ctx.supabase, ctx.accountId, id);
    if (!existing) return fail('not_found', 'Property not found', 404);

    const updates: Record<string, unknown> = {};
    if ('title' in body && typeof body.title === 'string' && body.title.trim())
      updates.title = body.title.trim();
    if (
      'location' in body &&
      (typeof body.location === 'string' || body.location === null)
    )
      updates.location = body.location;
    if (
      'price' in body &&
      (typeof body.price === 'number' || body.price === null)
    )
      updates.price = body.price;
    if (
      'property_type' in body &&
      (typeof body.property_type === 'string' || body.property_type === null)
    )
      updates.property_type = body.property_type;
    if (
      'bedrooms' in body &&
      (typeof body.bedrooms === 'number' || body.bedrooms === null)
    )
      updates.bedrooms = body.bedrooms;
    if ('tags' in body && (Array.isArray(body.tags) || body.tags === null))
      updates.tags = Array.isArray(body.tags)
        ? body.tags.filter((t) => typeof t === 'string')
        : null;

    if (
      'configuration' in body &&
      (typeof body.configuration === 'string' || body.configuration === null)
    )
      updates.configuration = body.configuration;
    if (
      'builder_name' in body &&
      (typeof body.builder_name === 'string' || body.builder_name === null)
    )
      updates.builder_name = body.builder_name;
    if (
      'project_name' in body &&
      (typeof body.project_name === 'string' || body.project_name === null)
    )
      updates.project_name = body.project_name;
    if (
      'rera_id' in body &&
      (typeof body.rera_id === 'string' || body.rera_id === null)
    )
      updates.rera_id = body.rera_id;
    if (
      'possession_status' in body &&
      (typeof body.possession_status === 'string' ||
        body.possession_status === null)
    )
      updates.possession_status = body.possession_status;
    if (
      'possession_date' in body &&
      (typeof body.possession_date === 'string' ||
        body.possession_date === null)
    )
      updates.possession_date = body.possession_date;
    if (
      'carpet_area' in body &&
      (typeof body.carpet_area === 'number' || body.carpet_area === null)
    )
      updates.carpet_area = body.carpet_area;
    if (
      'facing' in body &&
      (typeof body.facing === 'string' || body.facing === null)
    )
      updates.facing = body.facing;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await ctx.supabase
        .from('properties')
        .update(updates)
        .eq('id', id)
        .eq('account_id', ctx.accountId);
      if (error) {
        console.error('[api/v1/properties] update error:', error);
        return fail('internal', 'Failed to update property', 500);
      }
    }

    const updatedProperty = await getPropertyById(
      ctx.supabase,
      ctx.accountId,
      id
    );
    return ok(updatedProperty);
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'properties:write');
    const { id } = await params;

    const existing = await getPropertyById(ctx.supabase, ctx.accountId, id);
    if (!existing) return fail('not_found', 'Property not found', 404);

    const { error } = await ctx.supabase
      .from('properties')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[api/v1/properties] delete error:', error);
      return fail('internal', 'Failed to delete property', 500);
    }

    return ok({ deleted: true });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
