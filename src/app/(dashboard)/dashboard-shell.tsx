'use client';

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

interface MobileNavContextValue {
  hideMobileBars: boolean;
  setHideMobileBars: (hide: boolean) => void;
}

const MobileNavContext = createContext<MobileNavContextValue>({
  hideMobileBars: false,
  setHideMobileBars: () => {},
});

export function useMobileNav() {
  return useContext(MobileNavContext);
}
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AccountAccessAlert } from '@/components/layout/account-access-alert';
import { PresenceHeartbeat } from '@/components/presence/presence-heartbeat';
import { BrowserNotificationsListener } from '@/components/notifications/browser-notifications-listener';
import { BottomNav } from '@/components/layout/bottom-nav';
import { TopAppBar } from '@/components/layout/top-app-bar';

import { Menu, Search } from 'lucide-react';
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
  '/social-media': 'socialMedia',
};

function getPageTitleKey(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path)
  );
  return match ? match[1] : 'dashboard';
}

function MobileHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const t = useTranslations('Header');
  const pathname = usePathname();
  const titleKey = getPageTitleKey(pathname);
  const [commandOpen, setCommandOpen] = useState(false);

  return (
    <>
      <TopAppBar
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        title={t(titleKey as any)}
        className="md:hidden"
        leftAction={
          <button
            type="button"
            onClick={onOpenSidebar}
            aria-label={t('openMenu')}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-10 w-10 items-center justify-center rounded-md transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        }
        rightAction={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCommandOpen(true)}
              aria-label="Search"
              className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-9 items-center justify-center rounded-md transition-colors"
            >
              <Search className="h-4 w-4" />
            </button>
            <NotificationPopover />
            <ModeToggle />
          </div>
        }
      />
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </>
  );
}

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('DashboardShell');

  const isFullBleed = pathname.startsWith('/inbox');
  const [hideMobileBars, setHideMobileBars] = useState(false);
  const effectiveHideBars = isFullBleed && hideMobileBars;

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="bg-background flex h-full w-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="border-primary h-8 w-8 animate-spin rounded-full border-2 border-t-transparent" />
          <p className="text-muted-foreground text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <MobileNavContext.Provider value={{ hideMobileBars, setHideMobileBars }}>
      <div className="bg-background flex min-h-0 w-full flex-1 overflow-hidden print:h-auto print:overflow-visible">
        {/* Reports this tab's online/away presence once we know a user is
            signed in. Headless — renders nothing. */}
        <PresenceHeartbeat />
        {/* Desktop alerts for new customer messages (opt-in via Settings →
            Your profile). Headless — renders nothing. */}
        <BrowserNotificationsListener />

        <div className="print:hidden">
          <Sidebar open={sidebarOpen} onClose={closeSidebar} />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden print:overflow-visible">
          {!effectiveHideBars && (
            <div className="print:hidden">
              <MobileHeader onOpenSidebar={() => setSidebarOpen(true)} />
            </div>
          )}
          <div className="hidden md:block print:hidden">
            <Header onOpenSidebar={() => setSidebarOpen(true)} />
          </div>

          {/* Full-bleed for messaging apps (Inbox) only on mobile (<md).
              On md+ (desktop/tablet), keep the standard padding and max-w-7xl container to follow the shared design language. */}
          <main
            className={cn(
              'flex min-h-0 flex-1 flex-col print:overflow-visible print:p-0',
              isFullBleed
                ? 'overflow-hidden p-0 md:px-8 md:py-7'
                : 'overflow-y-auto px-6 py-6 pb-20 md:px-8 md:py-7'
            )}
          >
            <div
              className={cn(
                'flex min-h-0 flex-1 flex-col',
                isFullBleed
                  ? 'w-full max-w-none md:mx-auto md:max-w-7xl'
                  : 'mx-auto w-full max-w-7xl'
              )}
            >
              {/* Above every page: writes are being rejected and here's why.
                  Renders nothing unless the account/role failed to resolve. */}
              <AccountAccessAlert />
              {children}
            </div>
          </main>
          {!effectiveHideBars && (
            <div className="print:hidden">
              <BottomNav />
            </div>
          )}
        </div>
      </div>
    </MobileNavContext.Provider>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
