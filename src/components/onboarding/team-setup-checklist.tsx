'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Users, X } from 'lucide-react';
import Link from 'next/link';

export function TeamSetupChecklist() {
  const { accountId, canManageMembers, accountStatus } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkMembers = async () => {
      if (accountStatus !== 'ready' || !accountId || !canManageMembers) {
        setLoading(false);
        return;
      }

      // Check DB-persisted dismiss state first (works across devices/browsers).
      const supabase = createClient();
      const { data: acc } = await supabase
        .from('accounts')
        .select('settings')
        .eq('id', accountId)
        .single();

      const settings = (acc?.settings as Record<string, unknown> | null) ?? {};
      if (settings.onboarding_dismissed === true) {
        setLoading(false);
        return;
      }

      const dismissed = localStorage.getItem('wacrm_hide_team_checklist');
      if (dismissed === 'true') {
        setLoading(false);
        return;
      }
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', accountId);

      if (!error && count !== null && count < 2) {
        setVisible(true);
      }
      setLoading(false);
    };

    checkMembers();
  }, [accountId, canManageMembers, accountStatus]);

  if (loading || !visible) return null;

  const handleDismiss = async () => {
    setVisible(false); // Optimistic hide — instant UX
    try {
      await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { onboarding_dismissed: true },
        }),
      });
    } catch {
      // Non-critical — fall back to localStorage so the banner
      // stays hidden for this session at minimum.
      localStorage.setItem('wacrm_hide_team_checklist', 'true');
    }
  };

  return (
    <div className="border-primary/20 bg-primary/5 relative mb-6 overflow-hidden rounded-xl border p-6 shadow-sm">
      <button
        onClick={handleDismiss}
        className="text-muted-foreground hover:bg-muted hover:text-foreground absolute top-4 right-4 rounded-md p-1"
        aria-label="Dismiss checklist"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-foreground flex items-center gap-2 text-lg font-semibold">
            <Users className="text-primary size-5" />
            Invite your team to get started
          </h3>
          <p className="text-muted-foreground max-w-xl text-sm">
            WACRM works best when your whole team is here. Invite agents to
            assign leads and track their performance.
          </p>
        </div>

        <Link href="/settings?tab=members">
          <Button className="shrink-0">Invite Team Members</Button>
        </Link>
      </div>
    </div>
  );
}
