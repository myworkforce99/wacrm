import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  New: {
    bg: 'bg-blue-100 dark:bg-blue-950/60',
    text: 'text-blue-700 dark:text-blue-300',
  },
  Contacted: {
    bg: 'bg-purple-100 dark:bg-purple-950/60',
    text: 'text-purple-700 dark:text-purple-300',
  },
  'Site Visit': {
    bg: 'bg-teal-100 dark:bg-teal-950/60',
    text: 'text-teal-700 dark:text-teal-300',
  },
  Negotiation: {
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
  },
  'Booking / Token Paid': {
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  Closed: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  Won: {
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  Lost: {
    bg: 'bg-rose-100 dark:bg-rose-950/60',
    text: 'text-rose-700 dark:text-rose-300',
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status] ?? {
    bg: 'bg-muted dark:bg-muted/60',
    text: 'text-muted-foreground',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        cfg.bg,
        cfg.text,
        className
      )}
    >
      {status}
    </span>
  );
}
