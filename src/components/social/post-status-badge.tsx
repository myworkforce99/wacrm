import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { SocialPostStatus } from '@/types';

interface PostStatusBadgeProps {
  status: SocialPostStatus;
  className?: string;
}

export function PostStatusBadge({ status, className }: PostStatusBadgeProps) {
  const t = useTranslations('SocialMedia.status');

  switch (status) {
    case 'published':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400',
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {t('published')}
        </span>
      );

    case 'publishing':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400',
            className
          )}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
          </span>
          {t('publishing')}
        </span>
      );

    case 'scheduled':
      return (
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400',
            className
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          {t('scheduled')}
        </span>
      );

    case 'failed':
      return (
        <span
          className={cn(
            'border-destructive/20 bg-destructive/10 text-destructive inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
            className
          )}
        >
          <span className="bg-destructive h-1.5 w-1.5 rounded-full" />
          {t('failed')}
        </span>
      );

    case 'draft':
    default:
      return (
        <span
          className={cn(
            'border-border bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
            className
          )}
        >
          <span className="bg-muted-foreground h-1.5 w-1.5 rounded-full" />
          {t('draft')}
        </span>
      );
  }
}
