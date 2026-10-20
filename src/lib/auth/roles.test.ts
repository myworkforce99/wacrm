import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_ROLES,
  type AccountRole,
  canDeleteAccount,
  canEditSettings,
  canManageMembers,
  canSendMessages,
  canManageLead,
  canClaimLead,
  canReassignLead,
  canReleaseLead,
  canTransferOwnership,
  canViewOnly,
  canManageSocialPosts,
  canPublishSocialPost,
  canConnectSocialAccount,
  hasMinRole,
  isAccountRole,
  roleRank,
} from './roles';

describe('roleRank', () => {
  it('orders owner > admin > agent > viewer', () => {
    expect(roleRank('owner')).toBeGreaterThan(roleRank('admin'));
    expect(roleRank('admin')).toBeGreaterThan(roleRank('agent'));
    expect(roleRank('agent')).toBeGreaterThan(roleRank('viewer'));
  });

  it("matches the SQL helper's numeric mapping", () => {
    // Keep these in lockstep with `is_account_member`'s CASE expression
    // in supabase/migrations/017_account_sharing.sql — any change here
    // means the SQL helper needs the same change.
    expect(roleRank('owner')).toBe(4);
    expect(roleRank('admin')).toBe(3);
    expect(roleRank('agent')).toBe(2);
    expect(roleRank('viewer')).toBe(1);
  });
});

describe('hasMinRole', () => {
  it('returns true when role meets the threshold', () => {
    expect(hasMinRole('owner', 'viewer')).toBe(true);
    expect(hasMinRole('admin', 'agent')).toBe(true);
    expect(hasMinRole('agent', 'agent')).toBe(true);
  });

  it('returns false when role is below the threshold', () => {
    expect(hasMinRole('viewer', 'agent')).toBe(false);
    expect(hasMinRole('agent', 'admin')).toBe(false);
    expect(hasMinRole('admin', 'owner')).toBe(false);
  });

  // The full matrix — useful as a regression net if anyone reshuffles
  // the rank table.
  it.each<[AccountRole, AccountRole, boolean]>([
    ['owner', 'owner', true],
    ['owner', 'admin', true],
    ['owner', 'agent', true],
    ['owner', 'viewer', true],
    ['admin', 'owner', false],
    ['admin', 'admin', true],
    ['admin', 'agent', true],
    ['admin', 'viewer', true],
    ['agent', 'owner', false],
    ['agent', 'admin', false],
    ['agent', 'agent', true],
    ['agent', 'viewer', true],
    ['viewer', 'owner', false],
    ['viewer', 'admin', false],
    ['viewer', 'agent', false],
    ['viewer', 'viewer', true],
  ])('%s vs min %s → %s', (role, min, expected) => {
    expect(hasMinRole(role, min)).toBe(expected);
  });
});

describe('isAccountRole', () => {
  it('accepts every value in ACCOUNT_ROLES', () => {
    for (const role of ACCOUNT_ROLES) {
      expect(isAccountRole(role)).toBe(true);
    }
  });

  it('rejects garbage / case mismatch / non-strings', () => {
    expect(isAccountRole('Owner')).toBe(false);
    expect(isAccountRole('')).toBe(false);
    expect(isAccountRole(null)).toBe(false);
    expect(isAccountRole(undefined)).toBe(false);
    expect(isAccountRole(123)).toBe(false);
    expect(isAccountRole('superuser')).toBe(false);
  });
});

describe('capability predicates', () => {
  it('canManageMembers: admin+ only', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('agent')).toBe(false);
    expect(canManageMembers('viewer')).toBe(false);
  });

  it('canEditSettings: admin+ only', () => {
    expect(canEditSettings('owner')).toBe(true);
    expect(canEditSettings('admin')).toBe(true);
    expect(canEditSettings('agent')).toBe(false);
    expect(canEditSettings('viewer')).toBe(false);
  });

  it('canSendMessages: agent+ only', () => {
    expect(canSendMessages('owner')).toBe(true);
    expect(canSendMessages('admin')).toBe(true);
    expect(canSendMessages('agent')).toBe(true);
    expect(canSendMessages('viewer')).toBe(false);
  });

  it('canViewOnly: viewer only', () => {
    expect(canViewOnly('owner')).toBe(false);
    expect(canViewOnly('admin')).toBe(false);
    expect(canViewOnly('agent')).toBe(false);
    expect(canViewOnly('viewer')).toBe(true);
  });

  it('canDeleteAccount: owner only', () => {
    expect(canDeleteAccount('owner')).toBe(true);
    expect(canDeleteAccount('admin')).toBe(false);
    expect(canDeleteAccount('agent')).toBe(false);
    expect(canDeleteAccount('viewer')).toBe(false);
  });

  it('canTransferOwnership: owner only', () => {
    expect(canTransferOwnership('owner')).toBe(true);
    expect(canTransferOwnership('admin')).toBe(false);
    expect(canTransferOwnership('agent')).toBe(false);
    expect(canTransferOwnership('viewer')).toBe(false);
  });

  describe('canManageLead', () => {
    it('admin and owner can manage any lead (unassigned, own, or other agent)', () => {
      for (const role of ['owner', 'admin'] as const) {
        expect(canManageLead(role, null, 'user-1')).toBe(true);
        expect(canManageLead(role, 'user-1', 'user-1')).toBe(true);
        expect(canManageLead(role, 'user-2', 'user-1')).toBe(true);
      }
    });

    it('viewer can never manage any lead', () => {
      expect(canManageLead('viewer', null, 'user-1')).toBe(false);
      expect(canManageLead('viewer', 'user-1', 'user-1')).toBe(false);
      expect(canManageLead('viewer', 'user-2', 'user-1')).toBe(false);
    });

    it('agent can only manage leads assigned to themselves', () => {
      // Unassigned lead -> false (must claim first)
      expect(canManageLead('agent', null, 'user-1')).toBe(false);
      // Own assigned lead -> true
      expect(canManageLead('agent', 'user-1', 'user-1')).toBe(true);
      // Lead assigned to someone else -> false
      expect(canManageLead('agent', 'user-2', 'user-1')).toBe(false);
      // Missing current user id -> false
      expect(canManageLead('agent', 'user-1', null)).toBe(false);
    });
  });

  describe('canClaimLead', () => {
    it('viewer cannot claim leads', () => {
      expect(canClaimLead('viewer', null)).toBe(false);
      expect(canClaimLead('viewer', 'user-1')).toBe(false);
    });

    it('agent and admin can claim unassigned leads', () => {
      expect(canClaimLead('agent', null)).toBe(true);
      expect(canClaimLead('admin', null)).toBe(true);
      expect(canClaimLead('owner', null)).toBe(true);
    });

    it('cannot claim already assigned leads', () => {
      expect(canClaimLead('agent', 'user-1')).toBe(false);
      expect(canClaimLead('admin', 'user-1')).toBe(false);
      expect(canClaimLead('owner', 'user-1')).toBe(false);
    });
  });

  describe('canReassignLead', () => {
    it('admin and owner can reassign leads to arbitrary teammates', () => {
      expect(canReassignLead('owner')).toBe(true);
      expect(canReassignLead('admin')).toBe(true);
    });

    it('agents and viewers cannot reassign leads', () => {
      expect(canReassignLead('agent')).toBe(false);
      expect(canReassignLead('viewer')).toBe(false);
    });
  });

  describe('canReleaseLead', () => {
    it('admin and owner can release any assigned lead', () => {
      expect(canReleaseLead('owner', 'user-1', 'user-2')).toBe(true);
      expect(canReleaseLead('admin', 'user-1', 'user-2')).toBe(true);
      expect(canReleaseLead('admin', null, 'user-2')).toBe(false);
    });

    it('agent can only release leads assigned to themselves', () => {
      expect(canReleaseLead('agent', 'user-1', 'user-1')).toBe(true);
      expect(canReleaseLead('agent', 'user-2', 'user-1')).toBe(false);
      expect(canReleaseLead('agent', null, 'user-1')).toBe(false);
    });

    it('viewer can never release leads', () => {
      expect(canReleaseLead('viewer', 'user-1', 'user-1')).toBe(false);
    });
  });

  describe('canManageSocialPosts', () => {
    it('agent+ only', () => {
      expect(canManageSocialPosts('owner')).toBe(true);
      expect(canManageSocialPosts('admin')).toBe(true);
      expect(canManageSocialPosts('agent')).toBe(true);
      expect(canManageSocialPosts('viewer')).toBe(false);
    });
  });

  describe('canPublishSocialPost', () => {
    it('admin+ only', () => {
      expect(canPublishSocialPost('owner')).toBe(true);
      expect(canPublishSocialPost('admin')).toBe(true);
      expect(canPublishSocialPost('agent')).toBe(false);
      expect(canPublishSocialPost('viewer')).toBe(false);
    });
  });

  describe('canConnectSocialAccount', () => {
    it('admin+ only', () => {
      expect(canConnectSocialAccount('owner')).toBe(true);
      expect(canConnectSocialAccount('admin')).toBe(true);
      expect(canConnectSocialAccount('agent')).toBe(false);
      expect(canConnectSocialAccount('viewer')).toBe(false);
    });
  });
});
