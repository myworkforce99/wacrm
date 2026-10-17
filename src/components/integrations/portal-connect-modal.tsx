'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Copy, Check, Webhook, Mail, Key, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

export interface PortalItem {
  name: string;
  slug: string;
  status: 'connected' | 'not_connected' | 'coming_soon';
  apiKey?: string;
}

interface PortalConnectModalProps {
  portal: PortalItem;
  captureEmail: string;
  accountId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PortalConnectModal({
  portal,
  captureEmail,
  accountId,
  open,
  onOpenChange,
}: PortalConnectModalProps) {
  const t = useTranslations('Integrations');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [apiKey, setApiKey] = useState(portal.apiKey || '');
  const [activeTab, setActiveTab] = useState<'webhook' | 'email'>('webhook');
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setApiKey(portal.apiKey || '');
  }, [portal]);

  const webhookUrl = `${origin || 'http://localhost:3000'}/api/v1/contacts?source=${portal.slug.toLowerCase()}`;
  const webhookSecret = `whsec_${portal.slug.toLowerCase()}_${accountId.slice(0, 10)}`;

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(captureEmail);
      setCopiedEmail(true);
      toast.success('Capture email copied to clipboard');
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      toast.error('Failed to copy capture email');
    }
  };

  const handleCopyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast.success('Webhook URL copied to clipboard');
      setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      toast.error('Failed to copy webhook URL');
    }
  };

  const handleCopySecret = async () => {
    try {
      await navigator.clipboard.writeText(webhookSecret);
      setCopiedSecret(true);
      toast.success('Webhook secret copied to clipboard');
      setTimeout(() => setCopiedSecret(false), 2000);
    } catch {
      toast.error('Failed to copy webhook secret');
    }
  };

  const handleSaveConnection = async (connectedStatus: boolean) => {
    try {
      const res = await fetch('/api/account/portal-connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portal: portal.slug,
          connected: connectedStatus,
          api_key: apiKey.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to update connection status');
      }

      toast.success(
        connectedStatus
          ? `${portal.name} marked as connected!`
          : `${portal.name} disconnected.`
      );
      startTransition(() => {
        router.refresh();
        onOpenChange(false);
      });
    } catch {
      toast.error('Failed to update integration');
    }
  };

  // Safe fallback if instructions are missing
  const rawInstructions = t.raw(`portals.${portal.slug}.instructions`) as
    | string
    | undefined;
  const instructionsLines =
    typeof rawInstructions === 'string' ? rawInstructions.split('\n') : [];

  const isConnected = portal.status === 'connected';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card max-h-[88vh] w-full max-w-[calc(100vw-2rem)] overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-foreground text-lg sm:text-xl font-bold">
              {isConnected ? `Manage ${portal.name}` : `Connect ${portal.name}`}
            </DialogTitle>
            {isConnected ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                Connected
              </span>
            ) : (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                Not Configured
              </span>
            )}
          </div>
          <DialogDescription className="text-muted-foreground text-xs sm:text-sm">
            Set up automatic real-time lead capture from {portal.name} into WaCRM.
          </DialogDescription>
        </DialogHeader>

        {/* Integration Mode Switcher */}
        <div className="flex border-b border-border text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setActiveTab('webhook')}
            className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'webhook'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Webhook className="size-3.5" />
            Webhook & API
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors ${
              activeTab === 'email'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Mail className="size-3.5" />
            Email Forwarding
          </button>
        </div>

        {activeTab === 'webhook' && (
          <div className="space-y-4 pt-1">
            {/* Live Webhook URL */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span>Live Webhook Endpoint</span>
                <span className="text-[11px] text-muted-foreground font-normal">POST JSON</span>
              </Label>
              <div className="bg-muted/70 border-border flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <code className="font-mono text-xs text-foreground break-all select-all flex-1 min-w-0">
                  {webhookUrl}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyWebhook}
                  className="h-8 shrink-0 text-xs px-2.5"
                >
                  {copiedWebhook ? (
                    <Check className="mr-1.5 size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="mr-1.5 size-3.5" />
                  )}
                  {copiedWebhook ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Webhook Secret */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Webhook Signing Secret</span>
              </Label>
              <div className="bg-muted/70 border-border flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <code className="font-mono text-xs text-foreground break-all select-all flex-1 min-w-0">
                  {webhookSecret}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopySecret}
                  className="h-8 shrink-0 text-xs px-2.5"
                >
                  {copiedSecret ? (
                    <Check className="mr-1.5 size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="mr-1.5 size-3.5" />
                  )}
                  {copiedSecret ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Portal API Key */}
            <div className="space-y-1.5">
              <Label htmlFor="portal-api-key" className="text-xs font-semibold flex items-center gap-1.5">
                <Key className="size-3.5 text-muted-foreground" />
                <span>Portal API Key / Partner Token (Optional)</span>
              </Label>
              <Input
                id="portal-api-key"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste portal API key or integration token"
                className="h-9 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Provided by {portal.name} partner console for automated sync.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'email' && (
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Universal Capture Email</Label>
              <div className="bg-muted/70 border-border flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <code className="font-mono text-xs text-foreground break-all select-all flex-1 min-w-0">
                  {captureEmail}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyEmail}
                  className="h-8 shrink-0 text-xs px-2.5"
                >
                  {copiedEmail ? (
                    <Check className="mr-1.5 size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="mr-1.5 size-3.5" />
                  )}
                  {copiedEmail ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {t('capture_email.subtitle')}
              </p>
            </div>
          </div>
        )}

        {/* Portal Setup Instructions */}
        <div className="space-y-2 pt-2">
          <h4 className="text-xs font-semibold text-foreground">Setup Instructions</h4>
          <div className="bg-muted/40 border-border space-y-2 rounded-lg border p-3">
            {instructionsLines.length > 0 ? (
              instructionsLines.map((line, idx) => (
                <p key={idx} className="text-xs text-muted-foreground leading-relaxed">
                  {line}
                </p>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Configure your {portal.name} portal account with the capture webhook or email above.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs"
          >
            Cancel
          </Button>

          {isConnected ? (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => handleSaveConnection(false)}
                disabled={isPending}
                className="w-full sm:w-auto text-xs"
              >
                {isPending ? 'Disconnecting...' : 'Disconnect'}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => handleSaveConnection(true)}
                disabled={isPending}
                className="w-full sm:w-auto text-xs"
              >
                {isPending ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => handleSaveConnection(true)}
              disabled={isPending}
              className="w-full sm:w-auto text-xs"
            >
              {isPending ? 'Connecting...' : 'Mark as Connected'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
