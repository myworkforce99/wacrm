'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { SocialAccount } from '@/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { Instagram, Facebook } from '@/components/social/icons';
import { toast } from 'sonner';

interface SocialAccountTileProps {
  account: SocialAccount;
  canManage: boolean;
  onDisconnected?: () => void;
}

export function SocialAccountTile({
  account,
  canManage,
  onDisconnected,
}: SocialAccountTileProps) {
  const t = useTranslations('SocialMedia.accounts');
  const [disconnecting, setDisconnecting] = useState(false);

  const isInstagram = account.platform === 'instagram';

  // Calculate days until token expires if available
  let daysUntilExpiry: number | null = null;
  if (account.token_expires_at) {
    const diffMs = new Date(account.token_expires_at).getTime() - Date.now();
    daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  const handleDisconnect = async () => {
    if (!confirm(t('disconnect') + ` (${account.display_name})?`)) return;

    setDisconnecting(true);
    try {
      const res = await fetch(`/api/social/accounts/${account.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to disconnect');
      toast.success(t('disconnect') + ' successful');
      onDisconnected?.();
    } catch {
      toast.error('Failed to disconnect account');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="border-border bg-card flex max-w-[320px] min-w-[260px] shrink-0 items-center justify-between gap-3 rounded-xl border p-3 shadow-xs">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="relative">
          <Avatar className="h-10 w-10">
            {account.avatar_url && (
              <AvatarImage
                src={account.avatar_url}
                alt={account.display_name}
              />
            )}
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {account.display_name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="border-background bg-muted absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border">
            {isInstagram ? (
              <Instagram className="size-2.5 text-pink-600 dark:text-pink-400" />
            ) : (
              <Facebook className="size-2.5 text-blue-600 dark:text-blue-400" />
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-foreground truncate text-sm font-medium">
              {account.display_name}
            </p>
          </div>
          <p className="text-muted-foreground text-xs capitalize">
            {account.platform}
          </p>

          {daysUntilExpiry !== null && daysUntilExpiry <= 7 && (
            <p className="flex items-center gap-1 text-[10px] text-amber-500">
              <AlertCircle className="size-3" />
              {t('tokenExpiresSoon', { days: daysUntilExpiry })}
            </p>
          )}
        </div>
      </div>

      {canManage && (
        <Button
          variant="ghost"
          size="sm"
          disabled={disconnecting}
          onClick={handleDisconnect}
          className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs"
        >
          {disconnecting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            t('disconnect')
          )}
        </Button>
      )}
    </div>
  );
}
