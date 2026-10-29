import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { getSiteVisitById, SiteVisitError } from '@/lib/api/v1/site-visits';
import { SiteVisitPatchSchema } from '@/lib/schemas';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'site_visits:read');
    const { id } = await params;
    const siteVisit = await getSiteVisitById(ctx.supabase, ctx.accountId, id);
    if (!siteVisit) return fail('not_found', 'Site visit not found', 404);
    return ok(siteVisit);
  } catch (err) {
    return toApiErrorResponse(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'site_visits:write');
    const { id } = await params;

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const existing = await getSiteVisitById(ctx.supabase, ctx.accountId, id);
    if (!existing) return fail('not_found', 'Site visit not found', 404);

    const parsed = SiteVisitPatchSchema.safeParse(body);
    if (!parsed.success) {
      return fail(
        'bad_request',
        parsed.error.issues[0]?.message ?? 'Invalid input',
        400
      );
    }

    const updates: Record<string, unknown> = {};
    const val = parsed.data;
    if (val.contact_id !== undefined) updates.contact_id = val.contact_id;
    if (val.property_id !== undefined) updates.property_id = val.property_id;
    if (val.scheduled_at !== undefined) updates.scheduled_at = val.scheduled_at;
    if (val.status !== undefined) updates.status = val.status;
    if (val.notes !== undefined) updates.notes = val.notes;
    if (val.pickup_required !== undefined)
      updates.pickup_required = val.pickup_required;
    if (val.pickup_location !== undefined)
      updates.pickup_location = val.pickup_location;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await ctx.supabase
        .from('site_visits')
        .update(updates)
        .eq('id', id)
        .eq('account_id', ctx.accountId);
      if (error) {
        console.error('[api/v1/site-visits] update error:', error);
        return fail('internal', 'Failed to update site visit', 500);
      }
    }

    const updatedSiteVisit = await getSiteVisitById(
      ctx.supabase,
      ctx.accountId,
      id
    );
    return ok(updatedSiteVisit);
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireApiKey(request, 'site_visits:write');
    const { id } = await params;

    const existing = await getSiteVisitById(ctx.supabase, ctx.accountId, id);
    if (!existing) return fail('not_found', 'Site visit not found', 404);

    const { error } = await ctx.supabase
      .from('site_visits')
      .delete()
      .eq('id', id)
      .eq('account_id', ctx.accountId);

    if (error) {
      console.error('[api/v1/site-visits] delete error:', error);
      return fail('internal', 'Failed to delete site visit', 500);
    }

    return ok({ deleted: true });
  } catch (err) {
    return toApiErrorResponse(err);
  }
}
