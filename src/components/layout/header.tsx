'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  LogOut,
  Menu,
  Settings as SettingsIcon,
  User,
  Search,
  ChevronDown,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ModeToggle } from '@/components/layout/mode-toggle';
import { CommandPalette } from '@/components/layout/command-palette';
import { NotificationPopover } from '@/components/layout/notification-popover';

const pageTitles: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/inbox': 'inbox',
  '/notifications': 'notifications',
  '/contacts': 'contacts',
  '/pipelines': 'pipelines',
  '/broadcasts': 'broadcasts',
  '/automations': 'automations',
  '/settings': 'settings',
  '/site-visits': 'visits',
  '/flows': 'flows',
  '/agents': 'aiAgents',
  '/properties': 'properties',
  '/team': 'team',
  '/integrations': 'integrations',
};

function getPageTitleKey(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path)
  );
  return match ? match[1] : 'dashboard';
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
}

import { useTranslations } from 'next-intl';

export function Header({ onOpenSidebar }: HeaderProps) {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const { profile, accountRole, signOut, refreshProfile } = useAuth();
  const [isUpdatingAvailability, setIsUpdatingAvailability] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAvailabilityChange = async (isAvailable: boolean) => {
    if (!profile) return;
    setIsUpdatingAvailability(true);
    try {
      const res = await fetch(
        `/api/account/members/${profile.id}/availability`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_available: isAvailable }),
        }
      );
      if (!res.ok) throw new Error('Failed to update availability');
      await refreshProfile();
      toast.success(
        isAvailable
          ? 'You are now marked as available'
          : 'You are now marked as unavailable'
      );
    } catch {
      toast.error('Failed to update availability');
    } finally {
      setIsUpdatingAvailability(false);
    }
  };
  const titleKey = getPageTitleKey(pathname);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    'U';

  return (
    <header className="border-border bg-card sticky top-0 z-40 flex h-[52px] shrink-0 items-center justify-between gap-3 border-b px-4 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only. 44×44 hit target per Apple HIG. */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label={t('openMenu')}
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-10 items-center justify-center rounded-md transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-foreground truncate text-base font-semibold sm:text-lg">
          {t(titleKey as string)}
        </h1>
      </div>

      {/* Center: Global search */}
      <div className="mx-8 hidden max-w-sm flex-1 md:flex">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="border-border bg-muted/60 hover:bg-muted text-muted-foreground focus:ring-primary/30 flex w-full items-center justify-between rounded-lg border py-1.5 px-3 text-sm transition-colors focus:ring-2 focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{t('searchPlaceholder')}</span>
          </div>
          <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <NotificationPopover />

        <DropdownMenu>
          <DropdownMenuTrigger className="hover:bg-muted flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors focus:outline-none">
            <Avatar className="h-7 w-7">
              {profile?.avatar_url ? (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.full_name ?? t('defaultAvatar')}
                />
              ) : null}
              <AvatarFallback className="bg-primary text-xs text-white">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="text-foreground hidden text-sm font-medium md:block">
              {profile?.full_name?.split(' ')[0] ?? t('defaultUser')}
            </span>
            <ChevronDown className="text-muted-foreground hidden size-3.5 md:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="bg-popover text-popover-foreground ring-border min-w-56"
          >
            <div className="px-2 py-1.5">
              <p className="text-foreground truncate text-sm font-medium">
                {profile?.full_name ?? t('defaultUser')}
              </p>
              <p className="text-muted-foreground truncate text-xs">
                {profile?.email ?? ''}
              </p>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              render={
                <Link
                  href="/settings?tab=profile"
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                />
              }
            >
              <User className="size-4" />
              {t('menuProfile')}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <Link
                  href="/settings?tab=whatsapp"
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                />
              }
            >
              <SettingsIcon className="size-4" />
              {t('menuSettings')}
            </DropdownMenuItem>
            {accountRole === 'agent' && (
              <div className="flex items-center justify-between px-2 py-1.5 hover:bg-transparent">
                <span className="pl-1 text-sm font-medium">Availability</span>
                <Switch
                  checked={profile?.is_available}
                  disabled={isUpdatingAvailability}
                  onCheckedChange={handleAvailabilityChange}
                />
              </div>
            )}
            <DropdownMenuSeparator className="bg-border" />
            <div className="flex items-center justify-between px-2 py-1.5 hover:bg-transparent">
              <span className="pl-1 text-sm font-medium">Theme</span>
              <ModeToggle />
            </div>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={signOut}
              className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
            >
              <LogOut className="size-4" />
              {t('menuSignOut')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </header>
  );
}
