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
  '99acres': { bg: 'bg-red-100', text: 'text-red-600', label: '99acres' },
  MagicBricks: {
    bg: 'bg-orange-100',
    text: 'text-orange-600',
    label: 'MagicBricks',
  },
  'Housing.com': {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Housing.com',
  },
  NoBroker: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'NoBroker' },
  Referral: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Referral' },
  'Walk-in': { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Walk-in' },
  'Meta Ads': {
    bg: 'bg-indigo-100',
    text: 'text-indigo-600',
    label: 'Meta Ads',
  },
  'Google Ads': {
    bg: 'bg-cyan-100',
    text: 'text-cyan-700',
    label: 'Google Ads',
  },
  'Manual Entry': {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    label: 'Manual Entry',
  },
  Other: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Other' },

  // ── Legacy / webhook-generated keys (backward compatibility) ───────────────
  magicbricks: {
    bg: 'bg-orange-100',
    text: 'text-orange-600',
    label: 'MagicBricks',
  },
  HousingCom: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    label: 'Housing.com',
  },
  no_broker: { bg: 'bg-blue-100', text: 'text-blue-600', label: 'NoBroker' },
  walk_in: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Walk-in' },
  referral: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Referral' },
  whatsapp_inbound: {
    bg: 'bg-green-100',
    text: 'text-green-600',
    label: 'WhatsApp',
  },
  manual: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Manual' },
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
        'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600',
        className
      )}
    >
      {source}
    </span>
  );
}
