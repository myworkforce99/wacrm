import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { canMoveDeal } from '@/lib/auth/roles';
import type { DealStatus } from '@/types';

/**
 * PATCH /api/deals/[id]
 *
 * Handles four distinct update cases:
 *   1. Stage move (stage_id only) — agents moving a card on the board.
 *   2. Status change (status only or status + lost metadata) — Mark as Won/Lost/Reopen.
 *   3. Full field edit (title, value, contact, notes, etc.) — from the deal form.
 *   4. Any combination of the above in one call.
 *
 * Security:
 *   - Requires at least 'agent' role.
 *   - canMoveDeal() enforces that an agent can only edit their own deals
 *     (deals assigned to them or whose linked conversation is theirs).
 *     Admins/owners bypass this check.
 *
 * Lifecycle semantics (enforced server-side, not trusted from client):
 *   - When status → 'won' or 'lost': closed_at is frozen to NOW() if not
 *     already set. If reverting (status → 'open'): closed_at is cleared
 *     and reopened_count is incremented.
 *   - When status → 'lost': lost_from_stage_id is captured from the
 *     deal's current stage_id (never from the request body, so the client
 *     cannot fake the snapshot).
 *   - last_activity_at is always bumped to NOW() on any PATCH.
 *   - stage_id changes are blocked for non-open deals to prevent board
 *     pollution if a closed deal somehow leaks onto the UI.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await requireRole('agent');
  } catch (err) {
    return toErrorResponse(err);
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // deals.assigned_to stores profiles.id — join to resolve the agent's user_id
  // so canMoveDeal can compare against ctx.userId (auth UUID).
  const { data: deal, error: dealError } = await supabaseAdmin()
    .from('deals')
    .select(
      'assigned_to, contact_id, stage_id, status, closed_at, reopened_count, assignee:profiles!deals_assigned_to_fkey(user_id)'
    )
    .eq('id', id)
    .eq('account_id', ctx.accountId)
    .single<{
      assigned_to: string | null;
      contact_id: string | null;
      stage_id: string;
      status: string | null;
      closed_at: string | null;
      reopened_count: number;
      assignee: { user_id: string }[] | { user_id: string } | null;
    }>();

  if (dealError || !deal) {
    return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
  }

  const { data: conv } = await supabaseAdmin()
    .from('conversations')
    .select('assigned_agent_id')
    .eq('contact_id', deal.contact_id)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Resolve the deal assignee's user_id from the joined profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assigneeProfile = (deal as any).assignee;
  const dealAssigneeUserId: string | null = Array.isArray(assigneeProfile)
    ? (assigneeProfile[0]?.user_id ?? null)
    : (assigneeProfile?.user_id ?? null);

  if (
    !canMoveDeal(
      ctx.role,
      dealAssigneeUserId,
      conv?.assigned_agent_id,
      ctx.userId
    )
  ) {
    return NextResponse.json(
      {
        error: 'DEAL_NOT_YOURS',
        message:
          'You can only move your own deals. Ask your admin to reassign it first.',
      },
      { status: 403 }
    );
  }

  // ── Lifecycle field management ─────────────────────────────────────────
  // These fields are computed server-side; client values for them are
  // stripped (except lost_reason_id / lost_note which the client supplies).

  const incomingStatus = body.status as DealStatus | undefined;
  const currentStatus = deal.status as DealStatus | undefined;

  // Build the safe update payload from the allowed client fields
  const {
    // lifecycle fields the client is allowed to set
    status: _statusRaw, // captured as incomingStatus above — not used here directly
    lost_reason_id,
    lost_note,
    re_engage_on,
    won_value,
    // regular fields
    title,
    value,
    currency,
    contact_id,
    pipeline_id,
    notes,
    expected_close_date,
    assigned_to,
    stage_id: incomingStageId,
  } = body;
  void _statusRaw; // acknowledged via incomingStatus

  // Block stage moves for non-open deals: a closed deal card should not
  // appear on the board, so dragging it is already impossible in the UI.
  // Guard here in case of direct API calls.
  if (
    incomingStageId !== undefined &&
    currentStatus &&
    currentStatus !== 'open'
  ) {
    return NextResponse.json(
      {
        error: 'CLOSED_DEAL_STAGE_MOVE',
        message:
          'Cannot move a closed deal to a different stage. Reopen it first.',
      },
      { status: 422 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: Record<string, any> = {
    last_activity_at: new Date().toISOString(),
  };

  // Regular editable fields — only include if present in body
  if (title !== undefined) updatePayload.title = title;
  if (value !== undefined) updatePayload.value = value;
  if (currency !== undefined) updatePayload.currency = currency;
  if (contact_id !== undefined) updatePayload.contact_id = contact_id;
  if (pipeline_id !== undefined) updatePayload.pipeline_id = pipeline_id;
  if (notes !== undefined) updatePayload.notes = notes;
  if (expected_close_date !== undefined)
    updatePayload.expected_close_date = expected_close_date;
  if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to;
  if (incomingStageId !== undefined) updatePayload.stage_id = incomingStageId;

  // Status transition logic
  if (incomingStatus !== undefined) {
    updatePayload.status = incomingStatus;

    if (
      (incomingStatus === 'won' || incomingStatus === 'lost') &&
      currentStatus !== incomingStatus
    ) {
      // Freeze closed_at only on the first close (don't overwrite on re-close)
      updatePayload.closed_at = deal.closed_at ?? new Date().toISOString();

      if (incomingStatus === 'lost') {
        // Snapshot the current stage at time of loss (immutable after this)
        updatePayload.lost_from_stage_id = deal.stage_id;
        // Accept reason + note from client
        if (lost_reason_id !== undefined)
          updatePayload.lost_reason_id = lost_reason_id;
        if (lost_note !== undefined) updatePayload.lost_note = lost_note;
        if (re_engage_on !== undefined)
          updatePayload.re_engage_on = re_engage_on;
      }

      if (incomingStatus === 'won') {
        if (won_value !== undefined) updatePayload.won_value = won_value;
      }
    }

    if (incomingStatus === 'open' && currentStatus !== 'open') {
      // Reopen: clear close-specific fields, increment counter
      updatePayload.closed_at = null;
      updatePayload.lost_reason_id = null;
      updatePayload.lost_note = null;
      updatePayload.lost_from_stage_id = null;
      updatePayload.re_engage_on = null;
      // won_value kept intentionally for historical reference
      updatePayload.reopened_count = (deal.reopened_count ?? 0) + 1;
    }
  }

  const { error } = await supabaseAdmin()
    .from('deals')
    .update(updatePayload)
    .eq('id', id)
    .eq('account_id', ctx.accountId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
