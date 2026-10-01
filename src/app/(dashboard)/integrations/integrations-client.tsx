'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';
import { PortalConnectModal } from '@/components/integrations/portal-connect-modal';
import Link from 'next/link';

interface Portal {
  name: string;
  slug: string;
  icon: React.ElementType;
  status: 'connected' | 'not_connected' | 'coming_soon';
  test_lead: boolean;
  isNative?: boolean;
}

interface IntegrationsClientProps {
  captureEmail: string;
  portals: Portal[];
}

export function IntegrationsClient({
  captureEmail,
  portals,
}: IntegrationsClientProps) {
  const t = useTranslations('Integrations');
  const [copied, setCopied] = useState(false);
  const [selectedPortal, setSelectedPortal] = useState<string | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(captureEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy');
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-20 md:pb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect your portals and lead sources to automatically import leads
          into the CRM.
        </p>
      </div>

      <div className="bg-primary/5 border-primary/20 rounded-xl border-2 p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-primary">Universal Capture Email</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          {t('capture_email.subtitle')}
        </p>
        <div className="bg-background border-border flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
          <code className="font-mono text-sm font-medium break-all select-all">
            {captureEmail}
          </code>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            className="shrink-0"
          >
            {copied ? (
              <Check className="mr-2 size-4" />
            ) : (
              <Copy className="mr-2 size-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {portals.map((portal) => (
          <div
            key={portal.slug}
            className="bg-card border-border flex flex-col rounded-xl border p-5 shadow-sm"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-lg">
                <portal.icon className="size-6" />
              </div>
              <div>
                {portal.status === 'connected' && (
                  <span className="rounded border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-green-600 uppercase">
                    ✓ Connected
                  </span>
                )}
                {portal.status === 'not_connected' && (
                  <span className="bg-muted text-muted-foreground rounded border px-2 py-1 text-[10px] font-semibold tracking-wider uppercase">
                    Not Connected
                  </span>
                )}
                {portal.status === 'coming_soon' && (
                  <span className="rounded border border-purple-500/20 bg-purple-500/10 px-2 py-1 text-[10px] font-semibold tracking-wider text-purple-600 uppercase">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>

            <h3 className="mb-1 text-base font-semibold">{portal.name}</h3>

            <div className="mb-4 min-h-[20px]">
              {portal.test_lead && (
                <span className="flex items-center text-xs font-medium text-green-600">
                  <Check className="mr-1 size-3" /> Test lead received
                </span>
              )}
            </div>

            <div className="mt-auto pt-4">
              {portal.status === 'coming_soon' ? (
                <Button variant="outline" className="w-full" disabled>
                  Coming Soon
                </Button>
              ) : portal.isNative ? (
                <Link href="/settings?tab=whatsapp" className="w-full">
                  <Button variant="outline" className="w-full">
                    Manage <ExternalLink className="ml-2 size-3" />
                  </Button>
                </Link>
              ) : portal.status === 'connected' ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setSelectedPortal(portal.slug)}
                >
                  Manage →
                </Button>
              ) : (
                <Button
                  variant="default"
                  className="w-full"
                  onClick={() => setSelectedPortal(portal.slug)}
                >
                  + Connect →
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {selectedPortal && (
        <PortalConnectModal
          portal={selectedPortal}
          captureEmail={captureEmail}
          open={!!selectedPortal}
          onOpenChange={(open) => {
            if (!open) setSelectedPortal(null);
          }}
        />
      )}
    </div>
  );
}
