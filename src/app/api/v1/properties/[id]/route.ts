import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { getPropertyById, PropertyError } from '@/lib/api/v1/properties';
import { PropertyPatchSchema } from '@/lib/schemas';

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
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const existing = await getPropertyById(ctx.supabase, ctx.accountId, id);
    if (!existing) return fail('not_found', 'Property not found', 404);

    const parsed = PropertyPatchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        'bad_request',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        400
      );
    }

    const updates: Record<string, unknown> = {};
    const val = parsed.data;
    if (val.title !== undefined) updates.title = val.title;
    if (val.location !== undefined) updates.location = val.location;
    if (val.price !== undefined) updates.price = val.price;
    if (val.property_type !== undefined)
      updates.property_type = val.property_type;
    if (val.bedrooms !== undefined) updates.bedrooms = val.bedrooms;
    if (val.tags !== undefined) updates.tags = val.tags;
    if (val.configuration !== undefined)
      updates.configuration = val.configuration;
    if (val.builder_name !== undefined) updates.builder_name = val.builder_name;
    if (val.project_name !== undefined) updates.project_name = val.project_name;
    if (val.rera_id !== undefined) updates.rera_id = val.rera_id;
    if (val.possession_status !== undefined)
      updates.possession_status = val.possession_status;
    if (val.possession_date !== undefined)
      updates.possession_date = val.possession_date;
    if (val.carpet_area !== undefined) updates.carpet_area = val.carpet_area;
    if (val.facing !== undefined) updates.facing = val.facing;

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
