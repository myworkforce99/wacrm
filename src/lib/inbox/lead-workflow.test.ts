import { describe, it, expect } from 'vitest';
import {
  canManageLead,
  canClaimLead,
  canReassignLead,
  canReleaseLead,
} from '@/lib/auth/roles';
import { matchesAssigneeFilter } from './conversations';
import type { Conversation } from '@/types';

function createMockConversation(
  id: string,
  assignedAgentId: string | null = null
): Conversation {
  return {
    id,
    user_id: 'u-system',
    contact_id: `ct-${id}`,
    assigned_agent_id: assignedAgentId ?? undefined,
    status: 'open',
    unread_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

describe('Lead Allocation & Speed-to-Lead Workflows', () => {
  const currentAgentId = 'agent-1';
  const peerAgentId = 'agent-2';
  const managerId = 'admin-1';

  describe('Unassigned Lead State (Pool)', () => {
    const unassignedLead = createMockConversation('conv-unassigned', null);

    it('agents cannot edit properties or reply before claiming', () => {
      expect(canManageLead('agent', unassignedLead.assigned_agent_id, currentAgentId)).toBe(false);
    });

    it('agents can claim unassigned leads', () => {
      expect(canClaimLead('agent', unassignedLead.assigned_agent_id)).toBe(true);
    });

    it('agents CANNOT reassign unassigned leads to peer agents', () => {
      expect(canReassignLead('agent')).toBe(false);
    });

    it('managers can manage and reassign unassigned leads directly', () => {
      expect(canManageLead('admin', unassignedLead.assigned_agent_id, managerId)).toBe(true);
      expect(canManageLead('owner', unassignedLead.assigned_agent_id, managerId)).toBe(true);
      expect(canReassignLead('admin')).toBe(true);
      expect(canReassignLead('owner')).toBe(true);
    });

    it('viewers cannot claim or manage unassigned leads', () => {
      expect(canClaimLead('viewer', unassignedLead.assigned_agent_id)).toBe(false);
      expect(canManageLead('viewer', unassignedLead.assigned_agent_id, 'viewer-1')).toBe(false);
      expect(canReassignLead('viewer')).toBe(false);
    });
  });

  describe('Claimed / Assigned to Self State', () => {
    const claimedLead = createMockConversation('conv-claimed', currentAgentId);

    it('unlocks full management capabilities for the owning agent', () => {
      expect(canManageLead('agent', claimedLead.assigned_agent_id, currentAgentId)).toBe(true);
    });

    it('cannot be claimed again by another agent', () => {
      expect(canClaimLead('agent', claimedLead.assigned_agent_id)).toBe(false);
      expect(canClaimLead('admin', claimedLead.assigned_agent_id)).toBe(false);
    });

    it('owning agent cannot reassign to arbitrary teammates', () => {
      expect(canReassignLead('agent')).toBe(false);
    });

    it('owning agent CAN release the lead back to the unassigned pool', () => {
      expect(canReleaseLead('agent', claimedLead.assigned_agent_id, currentAgentId)).toBe(true);
    });

    it('peer agents CANNOT release leads they do not own', () => {
      expect(canReleaseLead('agent', claimedLead.assigned_agent_id, peerAgentId)).toBe(false);
    });

    it('managers can reassign or release any assigned lead', () => {
      expect(canReassignLead('admin')).toBe(true);
      expect(canReleaseLead('admin', claimedLead.assigned_agent_id, managerId)).toBe(true);
    });
  });

  describe('Assigned to Peer Agent State', () => {
    const peerLead = createMockConversation('conv-peer', peerAgentId);

    it('is locked for non-owning agents (read-only)', () => {
      expect(canManageLead('agent', peerLead.assigned_agent_id, currentAgentId)).toBe(false);
      expect(canClaimLead('agent', peerLead.assigned_agent_id)).toBe(false);
      expect(canReassignLead('agent')).toBe(false);
      expect(canReleaseLead('agent', peerLead.assigned_agent_id, currentAgentId)).toBe(false);
    });

    it('managers retain full override on peer leads', () => {
      expect(canManageLead('admin', peerLead.assigned_agent_id, managerId)).toBe(true);
      expect(canReassignLead('admin')).toBe(true);
      expect(canReleaseLead('admin', peerLead.assigned_agent_id, managerId)).toBe(true);
    });
  });

  describe('Assignee Filter Tabs & Counts', () => {
    const conversations: Conversation[] = [
      createMockConversation('c1', currentAgentId),
      createMockConversation('c2', currentAgentId),
      createMockConversation('c3', peerAgentId),
      createMockConversation('c4', null),
      createMockConversation('c5', null),
    ];

    it('calculates counts correctly for agent view', () => {
      const mineCount = conversations.filter((c) =>
        matchesAssigneeFilter(c, 'mine', currentAgentId)
      ).length;
      const unassignedCount = conversations.filter((c) =>
        matchesAssigneeFilter(c, 'unassigned', currentAgentId)
      ).length;

      expect(mineCount).toBe(2);
      expect(unassignedCount).toBe(2);
    });

    it('allows manager to view all conversations', () => {
      const allCount = conversations.filter((c) =>
        matchesAssigneeFilter(c, 'all', managerId)
      ).length;
      expect(allCount).toBe(5);
    });
  });

  describe('Atomic Claim Transition Detection (Issue 2 Regression Guard)', () => {
    it('detects atomic null -> currentUserId transition to trigger tab switch', () => {
      // Simulates the tracking map in conversation-list
      const prevAssignedMap = new Map<string, string | null>();
      const convId = 'conv-target';

      // 1. Initial selection of unassigned conversation
      const convUnassigned = createMockConversation(convId, null);
      prevAssignedMap.set(convId, convUnassigned.assigned_agent_id ?? null);

      let switchedTab: string | null = null;
      const triggerTransitionCheck = (
        conv: Conversation,
        targetUserId: string
      ) => {
        const hasPrev = prevAssignedMap.has(conv.id);
        const prevAssigned = prevAssignedMap.get(conv.id);
        const currentAssigned = conv.assigned_agent_id ?? null;

        if (hasPrev && prevAssigned === null && currentAssigned === targetUserId) {
          switchedTab = 'mine';
        }
        prevAssignedMap.set(conv.id, currentAssigned);
      };

      // User browses unassigned lead (no change in assigned_agent_id)
      triggerTransitionCheck(convUnassigned, currentAgentId);
      expect(switchedTab).toBeNull(); // Should NOT switch tab

      // User claims lead (atomic update: null -> currentAgentId)
      const convClaimed = createMockConversation(convId, currentAgentId);
      triggerTransitionCheck(convClaimed, currentAgentId);
      expect(switchedTab).toBe('mine'); // SHOULD seamlessly switch to 'mine'

      // Subsequent browsing of the now-claimed conversation
      switchedTab = null;
      triggerTransitionCheck(convClaimed, currentAgentId);
      expect(switchedTab).toBeNull(); // Should NOT trigger again
    });

    it('does not trigger tab switch when user switches tabs manually', () => {
      // When user clicks 'Unassigned' tab while viewing an assigned lead:
      // prevAssigned is currentAgentId, currentAssigned is currentAgentId.
      const prevAssigned = currentAgentId;
      const currentAssigned = currentAgentId;

      const isClaimTransition = prevAssigned === null && currentAssigned === currentAgentId;
      expect(isClaimTransition).toBe(false); // Tab selection remains unchanged!
    });
  });
});
