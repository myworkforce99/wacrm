'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function BillingActions({
  status,
  planTier,
}: {
  status: string;
  planTier: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to open portal');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_tier: planTier || 'starter' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start checkout');
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {status === 'past_due' ? (
        <Button
          onClick={handlePortal}
          disabled={loading}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full"
        >
          {loading ? 'Redirecting...' : 'Reactivate Plan'}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            onClick={handleCheckout}
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 w-full"
          >
            {loading ? 'Redirecting...' : 'Start Free Trial'}
          </Button>
          <Button
            onClick={handlePortal}
            disabled={loading}
            variant="outline"
            className="h-10 w-full"
          >
            Manage Existing Plan
          </Button>
        </div>
      )}
    </div>
  );
}
