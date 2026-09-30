'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function BillingTab() {
  const { isOwner, accountId } = useAuth();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [data, setData] = useState<{
    subscription_status: string;
    plan_tier: string;
    current_period_end: string | null;
    seat_limit: number;
    seat_usage: number;
  } | null>(null);

  useEffect(() => {
    if (!accountId) return;

    async function loadData() {
      setLoading(true);
      try {
        const [accountRes, profilesRes] = await Promise.all([
          supabase
            .from('accounts')
            .select('subscription_status, plan_tier, current_period_end, seat_limit')
            .eq('id', accountId)
            .single(),
          supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('account_id', accountId)
        ]);

        if (accountRes.error) throw accountRes.error;
        if (profilesRes.error) throw profilesRes.error;

        setData({
          ...accountRes.data,
          seat_usage: profilesRes.count || 0,
        });
      } catch (err: unknown) {
        console.error('Failed to load billing info:', err);
        toast.error('Failed to load billing info');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [accountId, supabase]);

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground">Only the account owner can manage billing.</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  const handlePortal = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to open portal');
      window.location.href = body.url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setActionLoading(false);
    }
  };

  const handleUpgrade = async (tier: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_tier: tier }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to start checkout');
      window.location.href = body.url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'An error occurred');
      setActionLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-500',
    trialing: 'bg-blue-500/10 text-blue-500',
    past_due: 'bg-red-500/10 text-red-500',
    canceled: 'bg-gray-500/10 text-gray-500',
    paused: 'bg-yellow-500/10 text-yellow-500',
  };

  const renewalText = data.current_period_end 
    ? `Renews on ${new Date(data.current_period_end).toLocaleDateString()}`
    : 'No active renewal';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-medium">Billing & Plan</h2>
        <p className="text-muted-foreground text-sm">Manage your subscription and billing details.</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="capitalize">{data.plan_tier} Plan</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[data.subscription_status] || statusColors.canceled}`}>
                  {data.subscription_status.replace('_', ' ')}
                </span>
              </CardTitle>
              <CardDescription className="mt-1">
                {renewalText}
              </CardDescription>
            </div>
            {data.plan_tier === 'starter' ? (
              <Button onClick={() => handleUpgrade('growth')} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Upgrade Plan
              </Button>
            ) : (
              <Button onClick={handlePortal} variant="outline" disabled={actionLoading}>
                {actionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Manage Plan
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-medium mb-2">Seat Usage</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-primary h-full" 
                  style={{ width: `${Math.min(100, (data.seat_usage / data.seat_limit) * 100)}%` }} 
                />
              </div>
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {data.seat_usage} of {data.seat_limit} seats used
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
