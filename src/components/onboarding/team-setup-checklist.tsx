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

      const dismissed = localStorage.getItem('wacrm_hide_team_checklist');
      if (dismissed === 'true') {
        setLoading(false);
        return;
      }

      const supabase = createClient();
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

  const handleDismiss = () => {
    localStorage.setItem('wacrm_hide_team_checklist', 'true');
    setVisible(false);
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-6 shadow-sm">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Dismiss checklist"
      >
        <X className="size-4" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Users className="size-5 text-primary" />
            Invite your team to get started
          </h3>
          <p className="text-sm text-muted-foreground max-w-xl">
            WACRM works best when your whole team is here. Invite agents to assign leads and track their performance.
          </p>
        </div>

        <Link href="/settings?tab=members">
          <Button className="shrink-0">
            Invite Team Members
          </Button>
        </Link>
      </div>
    </div>
  );
}
