import Link from 'next/link';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { ComponentType } from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  /** Pre-formatted value for display (e.g. "42" or "$1,250"). */
  value: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName?: string;
  iconBgClassName?: string;
  href?: string;
  /**
   * Delta-mode secondary row: arrow + delta text. Omit when the metric
   * doesn't have a sensible comparison (e.g. total pipeline value).
   */
  delta?: {
    /** Positive / negative / zero drives arrow + color. */
    sign: number;
    /** Pre-formatted delta, e.g. "+3 vs yesterday". */
    label: string;
  };
  /** Used instead of `delta` when the metric has a static subtitle. */
  subtitle?: string;
  /** Optional class name to override subtitle color. */
  subtitleClassName?: string;
}

export function MetricCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  iconBgClassName,
  href,
  delta,
  subtitle,
  subtitleClassName,
}: MetricCardProps) {
  const content = (
    <div
      className={cn(
        'border-border bg-card rounded-xl border p-4 shadow-sm transition-all sm:p-5',
        href && 'hover:border-primary/40 cursor-pointer hover:shadow-md'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted-foreground truncate text-xs font-medium sm:text-sm">
          {title}
        </p>
        <div
          className={cn(
            'bg-muted text-muted-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            iconBgClassName
          )}
        >
          <Icon className={cn('h-4 w-4', iconClassName)} />
        </div>
      </div>
      <p className="text-foreground mt-2 text-2xl leading-none font-bold tracking-tight tabular-nums sm:mt-3 sm:text-3xl">
        {value}
      </p>
      {delta ? (
        <DeltaRow sign={delta.sign} label={delta.label} />
      ) : subtitle ? (
        <p
          className={cn(
            'mt-2 truncate text-xs sm:text-sm',
            subtitleClassName || 'text-muted-foreground'
          )}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}

function DeltaRow({ sign, label }: { sign: number; label: string }) {
  const tone =
    sign > 0
      ? 'text-primary'
      : sign < 0
        ? 'text-red-400'
        : 'text-muted-foreground';
  const Arrow = sign > 0 ? ArrowUp : sign < 0 ? ArrowDown : Minus;
  return (
    <div className={cn('mt-2 flex items-center gap-1 text-sm', tone)}>
      <Arrow className="h-4 w-4" aria-hidden />
      <span className="tabular-nums">{label}</span>
    </div>
  );
}
