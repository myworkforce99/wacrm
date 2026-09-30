'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PortalConnectModalProps {
  portal: string;
  captureEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PortalConnectModal({
  portal,
  captureEmail,
  open,
  onOpenChange,
}: PortalConnectModalProps) {
  const t = useTranslations('Integrations');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(captureEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleConnect = async () => {
    try {
      const res = await fetch('/api/account/portal-connections', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal, connected: true }),
      });

      if (!res.ok) {
        throw new Error('Failed to update connection status');
      }

      toast.success('Marked as connected!');
      startTransition(() => {
        router.refresh();
        onOpenChange(false);
      });
    } catch {
      toast.error('Failed to mark as connected');
    }
  };

  // Safe fallback if instructions are missing
  const rawInstructions = t.raw(`portals.${portal}.instructions`) as
    string | undefined;
  const instructionsLines =
    typeof rawInstructions === 'string' ? rawInstructions.split('\n') : [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto flex h-auto flex-col gap-6 rounded-t-xl px-6 pt-6 pb-8 sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Connect {portal}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">
              1. Copy your capture email
            </h3>
            <div className="bg-muted flex flex-col justify-between gap-3 rounded-lg border p-3 sm:flex-row sm:items-center">
              <code className="text-xs break-all">{captureEmail}</code>
              <Button
                size="sm"
                variant="outline"
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
            <p className="text-muted-foreground text-xs">
              {t('capture_email.subtitle')}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">
              2. Follow the portal instructions
            </h3>
            <div className="bg-muted/50 space-y-2 rounded-lg border p-4">
              {instructionsLines.length > 0 ? (
                instructionsLines.map((line, idx) => (
                  <p key={idx} className="text-sm">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  Instructions not available for {portal}.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">3. Finish</h3>
            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={isPending}
            >
              {isPending ? 'Saving...' : 'Mark as Connected'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
