import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  New: { bg: 'bg-blue-100', text: 'text-blue-700' },
  Contacted: { bg: 'bg-purple-100', text: 'text-purple-700' },
  'Site Visit': { bg: 'bg-teal-100', text: 'text-teal-700' },
  Negotiation: { bg: 'bg-amber-100', text: 'text-amber-700' },
  Closed: { bg: 'bg-green-100', text: 'text-green-700' },
  Won: { bg: 'bg-green-100', text: 'text-green-700' },
};

export function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg.bg,
        cfg.text
      )}
    >
      {status}
    </span>
  );
}
