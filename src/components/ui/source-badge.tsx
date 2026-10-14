import { cn } from '@/lib/utils';

/**
 * Keys must exactly match the values stored in lead_details.source.
 * The seeded sources (126_re_onboarding_presets) and contact-form use:
 *   99acres | MagicBricks | Housing.com | NoBroker | Walk-in | Referral |
 *   Meta Ads | Google Ads | Manual Entry | Other
 * Legacy/webhook-created values kept as aliases.
 */
const SOURCE_CONFIG: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  // ── Current seeded values ──────────────────────────────────────────────────
  '99acres': {
    bg: 'bg-red-100 dark:bg-red-950/60',
    text: 'text-red-600 dark:text-red-400',
    label: '99acres',
  },
  MagicBricks: {
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    text: 'text-orange-600 dark:text-orange-400',
    label: 'MagicBricks',
  },
  'Housing.com': {
    bg: 'bg-green-100 dark:bg-emerald-950/60',
    text: 'text-green-700 dark:text-emerald-400',
    label: 'Housing.com',
  },
  NoBroker: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'NoBroker',
  },
  Referral: {
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    text: 'text-purple-600 dark:text-purple-400',
    label: 'Referral',
  },
  'Walk-in': {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Walk-in',
  },
  'Meta Ads': {
    bg: 'bg-indigo-100 dark:bg-indigo-950/60',
    text: 'text-indigo-600 dark:text-indigo-400',
    label: 'Meta Ads',
  },
  'Google Ads': {
    bg: 'bg-cyan-100 dark:bg-cyan-950/60',
    text: 'text-cyan-700 dark:text-cyan-400',
    label: 'Google Ads',
  },
  'Manual Entry': {
    bg: 'bg-gray-100 dark:bg-muted/80',
    text: 'text-gray-600 dark:text-muted-foreground',
    label: 'Manual Entry',
  },
  Other: {
    bg: 'bg-gray-100 dark:bg-muted/80',
    text: 'text-gray-500 dark:text-muted-foreground',
    label: 'Other',
  },

  // ── Legacy / webhook-generated keys (backward compatibility) ───────────────
  magicbricks: {
    bg: 'bg-orange-100 dark:bg-orange-950/60',
    text: 'text-orange-600 dark:text-orange-400',
    label: 'MagicBricks',
  },
  HousingCom: {
    bg: 'bg-green-100 dark:bg-emerald-950/60',
    text: 'text-green-700 dark:text-emerald-400',
    label: 'Housing.com',
  },
  no_broker: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'NoBroker',
  },
  walk_in: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Walk-in',
  },
  referral: {
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    text: 'text-purple-600 dark:text-purple-400',
    label: 'Referral',
  },
  whatsapp_inbound: {
    bg: 'bg-green-100 dark:bg-emerald-950/60',
    text: 'text-green-600 dark:text-emerald-400',
    label: 'WhatsApp',
  },
  manual: {
    bg: 'bg-gray-100 dark:bg-muted/80',
    text: 'text-gray-600 dark:text-muted-foreground',
    label: 'Manual',
  },
};

export function SourceBadge({
  source,
  className,
}: {
  source: string | null | undefined;
  className?: string;
}) {
  if (!source) return <span className="text-muted-foreground text-xs">-</span>;

  const cfg = SOURCE_CONFIG[source];

  if (cfg) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          cfg.bg,
          cfg.text,
          className
        )}
      >
        {cfg.label}
      </span>
    );
  }

  // Unknown / freeform "Other" value — show as plain text badge
  return (
    <span
      className={cn(
        'dark:bg-muted/80 dark:text-muted-foreground inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600',
        className
      )}
    >
      {source}
    </span>
  );
}
