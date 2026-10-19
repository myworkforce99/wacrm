import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns all contact IDs linked to an agent via:
 * 1. Deals where `assigned_to` matches agent's profile ID or user ID.
 * 2. Conversations where `assigned_agent_id` matches agent's user ID.
 */
export async function getAgentAssignedContactIds(
  supabase: SupabaseClient,
  userId: string,
  profileId?: string | null
): Promise<string[]> {
  const agentProfileIds = [profileId, userId].filter(Boolean) as string[];

  const [dealsRes, convsRes] = await Promise.all([
    supabase
      .from('deals')
      .select('contact_id')
      .in('assigned_to', agentProfileIds)
      .not('contact_id', 'is', null),
    supabase
      .from('conversations')
      .select('contact_id')
      .eq('assigned_agent_id', userId)
      .not('contact_id', 'is', null),
  ]);

  const dealContactIds = (
    dealsRes.data
      ?.map((d: { contact_id: string | null }) => d.contact_id)
      .filter(Boolean) ?? []
  ) as string[];

  const convContactIds = (
    convsRes.data
      ?.map((c: { contact_id: string | null }) => c.contact_id)
      .filter(Boolean) ?? []
  ) as string[];

  return Array.from(new Set([...dealContactIds, ...convContactIds]));
}

/**
 * Builds the PostgREST `.or(...)` filter condition for agent contact isolation.
 * Combines:
 * - Direct ownership: `user_id.eq.${userId}` (and `user_id.eq.${profileId}` if distinct)
 * - Indirect assignment: `id.in.(${targetContactIds})`
 */
export function buildAgentContactFilter(
  userId: string,
  profileId?: string | null,
  additionalContactIds: string[] = []
): string {
  const userConditions =
    profileId && profileId !== userId
      ? `user_id.eq.${userId},user_id.eq.${profileId}`
      : `user_id.eq.${userId}`;

  const validAdditional = Array.from(
    new Set(additionalContactIds.filter(Boolean))
  );

  if (validAdditional.length > 0) {
    return `${userConditions},id.in.(${validAdditional.join(',')})`;
  }
  return userConditions;
}
