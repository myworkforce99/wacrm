'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import Link from 'next/link';

export function WhatsappSetupChecklist() {
  const { accountId, canManageMembers, accountStatus } = useAuth();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkWhatsapp = async () => {
      // Only owners/admins can connect WhatsApp
      if (accountStatus !== 'ready' || !accountId || !canManageMembers) {
        setLoading(false);
        return;
      }

      // Check DB-persisted dismiss state first.
      const supabase = createClient();
      const { data: acc } = await supabase
        .from('accounts')
        .select('settings')
        .eq('id', accountId)
        .single();

      const settings = (acc?.settings as Record<string, unknown> | null) ?? {};
      if (settings.whatsapp_dismissed === true) {
        setLoading(false);
        return;
      }

      const dismissed = localStorage.getItem('wacrm_hide_whatsapp_checklist');
      if (dismissed === 'true') {
        setLoading(false);
        return;
      }

      const { data: config, error } = await supabase
        .from('whatsapp_config')
        .select('phone_number_id')
        .eq('account_id', accountId)
        .maybeSingle();

      if (!error && !config?.phone_number_id) {
        setVisible(true);
      }
      setLoading(false);
    };

    checkWhatsapp();
  }, [accountId, canManageMembers, accountStatus]);

  if (loading || !visible) return null;

  const handleDismiss = async () => {
    setVisible(false); // Optimistic hide
    try {
      await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { whatsapp_dismissed: true },
        }),
      });
    } catch {
      localStorage.setItem('wacrm_hide_whatsapp_checklist', 'true');
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
            <MessageCircle className="text-primary size-5" />
            Connect WhatsApp
          </h3>
          <p className="text-muted-foreground max-w-xl text-sm">
            WACRM needs to connect to the WhatsApp API to send and receive
            messages. Connect your number to start reaching out to leads.
          </p>
        </div>

        <Link href="/settings?tab=whatsapp">
          <Button className="shrink-0">Connect WhatsApp</Button>
        </Link>
      </div>
    </div>
  );
}
