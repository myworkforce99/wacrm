import { formatINR } from '@/lib/currency';

interface BrokerageBadgeProps {
  dealValue: number | null | undefined;
  /** Brokerage %, e.g. 2 for 2%. Sourced from accounts.settings.brokerage_pct. */
  brokeragePct: number | null | undefined;
  className?: string;
}

/**
 * Section R7 — Displays estimated brokerage for a deal.
 * Renders nothing if dealValue or brokeragePct is missing/zero.
 */
export function BrokerageBadge({
  dealValue,
  brokeragePct,
  className,
}: BrokerageBadgeProps) {
  if (!dealValue || !brokeragePct || brokeragePct <= 0) return null;

  const brokerage = Math.round((dealValue * brokeragePct) / 100);

  return (
    <span
      className={`inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 ${className ?? ''}`}
      title={`Brokerage @ ${brokeragePct}%`}
    >
      {formatINR(brokerage)} brokerage
    </span>
  );
}
