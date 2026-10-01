import { cn } from '@/lib/utils';

const SOURCE_CONFIG: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  '99acres': { bg: 'bg-red-100', text: 'text-red-600', label: '99acres' },
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
  referral: { bg: 'bg-purple-100', text: 'text-purple-600', label: 'Referral' },
  walk_in: { bg: 'bg-amber-100', text: 'text-amber-600', label: 'Walk-in' },
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
  const cfg = source
    ? (SOURCE_CONFIG[source] ?? SOURCE_CONFIG['manual'])
    : SOURCE_CONFIG['manual'];
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
