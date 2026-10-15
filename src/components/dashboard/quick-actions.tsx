'use client';

import Link from 'next/link';
import {
  UserPlus,
  Briefcase,
  CalendarCheck,
  Radio,
  Zap,
  FileSpreadsheet,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { CostSheetModal } from '@/components/contacts/cost-sheet-modal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Action {
  labelKey: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tint: string;
  bgTint: string;
}

const ACTIONS: Action[] = [
  {
    labelKey: 'newContact',
    href: '/contacts',
    icon: UserPlus,
    tint: 'text-primary',
    bgTint: 'bg-primary/10',
  },
  {
    labelKey: 'newDeal',
    href: '/pipelines',
    icon: Briefcase,
    tint: 'text-blue-500 dark:text-blue-400',
    bgTint: 'bg-blue-500/10',
  },
  {
    labelKey: 'scheduleVisit',
    href: '/site-visits',
    icon: CalendarCheck,
    tint: 'text-emerald-500 dark:text-emerald-400',
    bgTint: 'bg-emerald-500/10',
  },
  {
    labelKey: 'newBroadcast',
    href: '/broadcasts/new',
    icon: Radio,
    tint: 'text-amber-500 dark:text-amber-400',
    bgTint: 'bg-amber-500/10',
  },
  {
    labelKey: 'newAutomation',
    href: '/automations/new',
    icon: Zap,
    tint: 'text-purple-500 dark:text-purple-400',
    bgTint: 'bg-purple-500/10',
  },
];

export function QuickActions() {
  const t = useTranslations('Dashboard.quickActions');
  const [costSheetOpen, setCostSheetOpen] = useState(false);
  const { account } = useAuth();
  const hasCostSheet = !!account?.cost_sheet_template_id;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
      {ACTIONS.map((a) => {
        const Icon = a.icon;
        return (
          <Link
            key={a.href}
            href={a.href}
            className="group border-border bg-card hover:border-primary/40 hover:bg-muted/50 flex items-center gap-3 rounded-xl border p-3 transition-all hover:shadow-sm sm:px-4 sm:py-3"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${a.bgTint} ${a.tint}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <span className="text-foreground truncate text-xs font-medium sm:text-sm">
              {t(
                a.labelKey as
                  | 'newContact'
                  | 'newDeal'
                  | 'scheduleVisit'
                  | 'newBroadcast'
                  | 'newAutomation'
              )}
            </span>
          </Link>
        );
      })}

      {/* Cost Sheet Quick Action */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            onClick={() => {
              if (hasCostSheet) setCostSheetOpen(true);
            }}
            disabled={!hasCostSheet}
            className={`group border-border flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all sm:px-4 sm:py-3 ${
              hasCostSheet
                ? 'bg-card hover:border-primary/40 hover:bg-muted/50 cursor-pointer hover:shadow-sm'
                : 'bg-muted/20 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 transition-transform group-hover:scale-105 dark:text-teal-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <span className="text-foreground truncate text-xs font-medium sm:text-sm">
              {t('sendCostSheet')}
            </span>
          </TooltipTrigger>
          {!hasCostSheet && (
            <TooltipContent>{t('costSheetTooltipDisabled')}</TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      <CostSheetModal open={costSheetOpen} onOpenChange={setCostSheetOpen} />
    </div>
  );
}
