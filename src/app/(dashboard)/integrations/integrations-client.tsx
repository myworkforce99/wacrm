'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Copy,
  Check,
  ExternalLink,
  Home,
  Mail,
  MessageCircle,
  Webhook,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { Instagram } from '@/components/social/icons';
import {
  PortalConnectModal,
  type PortalItem,
} from '@/components/integrations/portal-connect-modal';
import Link from 'next/link';
import { toast } from 'sonner';

export interface PortalConfig extends PortalItem {
  icon: string;
  test_lead: boolean;
  isNative?: boolean;
  link?: string;
}

interface IntegrationsClientProps {
  accountId: string;
  captureEmail: string;
  portals: PortalConfig[];
  canManage: boolean;
  role: string;
}

export function IntegrationsClient({
  accountId,
  captureEmail,
  portals,
  canManage,
  role,
}: IntegrationsClientProps) {
  const t = useTranslations('Integrations');
  const [copied, setCopied] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<PortalConfig | null>(
    null
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(captureEmail);
      setCopied(true);
      toast.success('Capture email copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy capture email');
    }
  };

  const renderIcon = (iconName: string) => {
    switch (iconName) {
      case 'Home':
        return <Home className="size-6" />;
      case 'Mail':
        return <Mail className="size-6" />;
      case 'MessageCircle':
        return <MessageCircle className="size-6" />;
      case 'Webhook':
        return <Webhook className="size-6" />;
      case 'Layers':
        return <Layers className="size-6" />;
      case 'Instagram':
        return <Instagram className="size-6" />;
      default:
        return <Home className="size-6" />;
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-20 md:pb-6">
      {/* Page Title & Intro */}
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">
          Integrations
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your Indian real estate portals and lead channels to
          automatically stream leads into WaCRM.
        </p>
      </div>

      {/* Read-Only Notice for Non-Admins */}
      {!canManage && (
        <div className="border-border bg-muted/50 text-muted-foreground flex items-center gap-3 rounded-xl border p-4 text-xs sm:text-sm">
          <ShieldAlert className="size-4 shrink-0 text-amber-500" />
          <span>
            <strong>Read-only access:</strong> You are signed in with the{' '}
            <strong>{role}</strong> role. Only organization owners and
            administrators can configure portal credentials and webhooks.
          </span>
        </div>
      )}

      {/* Universal Capture Email Hero Card */}
      <div className="bg-primary/5 border-primary/20 rounded-xl border-2 p-5 shadow-xs">
        <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <h2 className="text-primary text-base font-semibold sm:text-lg">
            Universal Capture Email
          </h2>
          <span className="text-muted-foreground font-mono text-xs">
            Direct Email Ingestion
          </span>
        </div>
        <p className="text-muted-foreground mb-4 text-xs sm:text-sm">
          {t('capture_email.subtitle')}
        </p>
        <div className="bg-background border-border flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
          <code className="text-foreground font-mono text-xs font-medium break-all select-all sm:text-sm">
            {captureEmail}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="h-8 shrink-0 text-xs"
          >
            {copied ? (
              <Check className="mr-1.5 size-3.5 text-emerald-500" />
            ) : (
              <Copy className="mr-1.5 size-3.5" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Portal Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {portals.map((portal) => {
          const isConnected = portal.status === 'connected';
          const isComingSoon = portal.status === 'coming_soon';

          return (
            <div
              key={portal.slug}
              className="bg-card border-border flex flex-col justify-between rounded-xl border p-5 shadow-xs transition-shadow hover:shadow-sm"
            >
              <div>
                <div className="mb-4 flex items-start justify-between">
                  <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-lg">
                    {renderIcon(portal.icon)}
                  </div>
                  <div>
                    {isConnected && (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                        ✓ Connected
                      </span>
                    )}
                    {portal.status === 'not_connected' && (
                      <span className="bg-muted text-muted-foreground border-border rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase">
                        Not Configured
                      </span>
                    )}
                    {isComingSoon && (
                      <span className="border-primary/20 bg-primary/10 text-primary rounded-full border px-2.5 py-0.5 text-[10px] font-medium tracking-wider uppercase">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="text-foreground mb-1 text-base font-semibold">
                  {portal.name}
                </h3>

                <div className="mb-4 min-h-[20px]">
                  {portal.test_lead ? (
                    <span className="flex items-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="mr-1 size-3.5" /> Test lead received
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-[11px]">
                      {isComingSoon
                        ? 'Direct portal connector in development'
                        : isConnected
                          ? 'Lead webhook active & listening'
                          : 'Webhook & email sync available'}
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2">
                {portal.link ? (
                  <Link href={portal.link} className="block w-full">
                    <Button variant="outline" className="w-full text-xs">
                      Set up <ExternalLink className="ml-2 size-3.5" />
                    </Button>
                  </Link>
                ) : isComingSoon ? (
                  <Button variant="outline" className="w-full text-xs" disabled>
                    Coming Soon
                  </Button>
                ) : portal.isNative ? (
                  <Link href="/settings?tab=whatsapp" className="block w-full">
                    <Button variant="outline" className="w-full text-xs">
                      Manage <ExternalLink className="ml-2 size-3.5" />
                    </Button>
                  </Link>
                ) : !canManage ? (
                  <Button
                    variant="outline"
                    className="w-full cursor-not-allowed text-xs opacity-50"
                    disabled
                    title="Admin permissions required"
                  >
                    Configure
                  </Button>
                ) : isConnected ? (
                  <Button
                    variant="outline"
                    className="w-full text-xs"
                    onClick={() => setSelectedPortal(portal)}
                  >
                    Configure →
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    className="w-full text-xs"
                    onClick={() => setSelectedPortal(portal)}
                  >
                    + Configure →
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Configuration Dialog */}
      {selectedPortal && (
        <PortalConnectModal
          portal={selectedPortal}
          captureEmail={captureEmail}
          accountId={accountId}
          open={!!selectedPortal}
          onOpenChange={(open) => {
            if (!open) setSelectedPortal(null);
          }}
        />
      )}
    </div>
  );
}
