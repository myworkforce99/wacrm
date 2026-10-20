// ============================================================
// Account role helpers — pure, unit-testable, no I/O.
//
// Mirrors the `account_role_enum` Postgres type from migration
// 017_account_sharing.sql. The hierarchy is intentionally a flat
// ordinal (owner=4 … viewer=1) — it matches the same CASE
// expression the `is_account_member(account_id, min_role)` SQL
// helper uses, so server-side TypeScript guards and database-side
// RLS speak the same language.
//
// Predicates (`canManageMembers`, `canEditSettings`, …) are the
// single source of truth for "what can this role do?" — both
// API route guards and UI gates should call them rather than
// open-coding their own role checks. That keeps role-policy
// changes a one-file diff.
// ============================================================

export type AccountRole = 'owner' | 'admin' | 'agent' | 'viewer';

/** Ordered list of every valid role, lowest privilege first. */
export const ACCOUNT_ROLES: readonly AccountRole[] = [
  'viewer',
  'agent',
  'admin',
  'owner',
] as const;

/**
 * Numeric rank of a role. Higher = more privileged. Mirrors the
 * CASE expression in `is_account_member` so JS/SQL stay aligned.
 */
export function roleRank(role: AccountRole): number {
  switch (role) {
    case 'owner':
      return 4;
    case 'admin':
      return 3;
    case 'agent':
      return 2;
    case 'viewer':
      return 1;
  }
}

/**
 * True iff `role` is at least as privileged as `min`. Use this
 * for any "user has at least admin" / "at least agent" checks.
 */
export function hasMinRole(role: AccountRole, min: AccountRole): boolean {
  return roleRank(role) >= roleRank(min);
}

/** Type-narrow an unknown string into a valid `AccountRole`. */
export function isAccountRole(value: unknown): value is AccountRole {
  return (
    typeof value === 'string' &&
    (ACCOUNT_ROLES as readonly string[]).includes(value)
  );
}

// ============================================================
// Capability predicates
//
// Every UI gate and API route guard should call one of these
// instead of comparing role strings inline. Adding a capability
// = one new predicate here + one call site change per consumer.
// ============================================================

/** Owner / admin: invite, remove, change roles. */
export function canManageMembers(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}

/**
 * Owner / admin: edit account-wide settings (WhatsApp config,
 * message templates, pipelines, tags, custom fields, account
 * name). Excludes per-user settings like avatar or own password.
 */
export function canEditSettings(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}

/**
 * Owner / admin / agent: write operational data — send messages,
 * create contacts, move deals, run broadcasts, edit automations.
 * Viewers are read-only.
 */
export function canSendMessages(role: AccountRole): boolean {
  return hasMinRole(role, 'agent');
}

/**
 * Viewer: read-only across everything. Provided as a positive
 * predicate so UI gates read naturally (`if (canViewOnly(role))`
 * shows the "Read-only" tooltip without inverting `canSendMessages`).
 */
export function canViewOnly(role: AccountRole): boolean {
  return role === 'viewer';
}

/** Owner only: irreversible destructive operations. */
export function canDeleteAccount(role: AccountRole): boolean {
  return role === 'owner';
}

/** Owner only: hand the account to another member. */
export function canTransferOwnership(role: AccountRole): boolean {
  return role === 'owner';
}

/** Admin bypasses ownership guard; Agents can only move their own deals. */
export function canMoveDeal(
  role: AccountRole,
  dealAssignedTo: string | null | undefined,
  contactAssignedAgentId: string | null | undefined,
  currentUserId: string
): boolean {
  if (hasMinRole(role, 'admin')) return true;
  return (
    dealAssignedTo === currentUserId || contactAssignedAgentId === currentUserId
  );
}

/** Admin only: create broadcasts */
export function canCreateBroadcast(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}

/**
 * Lead management capability (edit requirements, tags, notes, status, reply).
 * - Admin/Owner: can manage all leads (assigned, unassigned, or belonging to any agent).
 * - Viewer: read-only across all leads.
 * - Agent: can ONLY manage leads that are assigned to themselves.
 *   Unassigned leads or leads assigned to other agents are locked until claimed/assigned.
 */
export function canManageLead(
  role: AccountRole,
  assignedAgentId: string | null | undefined,
  currentUserId: string | null | undefined
): boolean {
  if (hasMinRole(role, 'admin')) return true;
  if (role === 'viewer') return false;
  return Boolean(
    assignedAgentId && currentUserId && assignedAgentId === currentUserId
  );
}

/**
 * Lead claim capability.
 * - Viewers: cannot claim leads.
 * - If already assigned: cannot claim (must be reassigned by manager/agent).
 * - If unassigned: agents and admins can claim it.
 */
export function canClaimLead(
  role: AccountRole,
  assignedAgentId: string | null | undefined
): boolean {
  if (role === 'viewer') return false;
  return !assignedAgentId;
}

/**
 * Lead assignment capability (assigning/reassigning to ANY arbitrary teammate).
 * - Admin/Owner: can assign or reassign any lead to any agent or unassign it.
 * - Agents & Viewers: CANNOT reassign leads to arbitrary teammates.
 */
export function canReassignLead(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}

/**
 * Lead release capability (returning own claimed/assigned lead back to unassigned pool).
 * - Admin/Owner: can release/unassign any lead.
 * - Agent: can release a lead back to the unassigned pool IF it is assigned to themselves.
 * - Viewer: cannot release leads.
 */
export function canReleaseLead(
  role: AccountRole,
  assignedAgentId: string | null | undefined,
  currentUserId: string | null | undefined
): boolean {
  if (hasMinRole(role, 'admin')) return Boolean(assignedAgentId);
  if (role === 'viewer') return false;
  return Boolean(
    assignedAgentId && currentUserId && assignedAgentId === currentUserId
  );
}

/**
 * Social media drafting/management: create and save draft posts.
 * - Owner / Admin / Agent: can create and save draft posts.
 * - Viewer: read-only — can view the post history.
 */
export function canManageSocialPosts(role: AccountRole): boolean {
  return hasMinRole(role, 'agent');
}

/**
 * Social post publishing: pushing a post live to Instagram or Facebook Page.
 * - Owner / Admin: can publish live posts and approve drafts.
 * - Agent: can create and edit DRAFTS, but CANNOT publish live.
 * - Viewer: read-only — can view post history.
 */
export function canPublishSocialPost(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}

/**
 * Social account connection: linking/unlinking an Instagram Business
 * or Facebook Page. This is an account-wide credential change —
 * same privilege level as WhatsApp config (admin/owner only).
 */
export function canConnectSocialAccount(role: AccountRole): boolean {
  return hasMinRole(role, 'admin');
}
