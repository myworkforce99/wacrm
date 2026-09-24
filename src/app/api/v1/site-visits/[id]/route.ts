import { requireApiKey } from '@/lib/auth/api-context';
import { ok, fail, toApiErrorResponse } from '@/lib/api/v1/respond';
import { getSiteVisitById, SiteVisitError } from '@/lib/api/v1/site-visits';
import type { SiteVisitStatus } from '@/types';

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
    if (!body || typeof body !== 'object') {
      return fail('bad_request', 'Request body must be a JSON object', 400);
    }

    const existing = await getSiteVisitById(ctx.supabase, ctx.accountId, id);
    if (!existing) return fail('not_found', 'Site visit not found', 404);

    const updates: Record<string, unknown> = {};
    if (
      'contact_id' in body &&
      (typeof body.contact_id === 'string' || body.contact_id === null)
    )
      updates.contact_id = body.contact_id;
    if (
      'property_id' in body &&
      (typeof body.property_id === 'string' || body.property_id === null)
    )
      updates.property_id = body.property_id;
    if (
      'scheduled_at' in body &&
      (typeof body.scheduled_at === 'string' || body.scheduled_at === null)
    )
      updates.scheduled_at = body.scheduled_at;
    if ('status' in body && typeof body.status === 'string') {
      const validStatuses: SiteVisitStatus[] = [
        'pending',
        'confirmed',
        'completed',
        'no_show',
        'rescheduled',
      ];
      if (!validStatuses.includes(body.status as SiteVisitStatus)) {
        return fail('bad_request', 'Invalid status', 400);
      }
      updates.status = body.status;
    }
    if (
      'notes' in body &&
      (typeof body.notes === 'string' || body.notes === null)
    )
      updates.notes = body.notes;

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
