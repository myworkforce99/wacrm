'use client';

import { useTranslations } from 'next-intl';
import { SocialPost } from '@/types';
import { PostStatusBadge } from './post-status-badge';
import { Instagram, Facebook } from '@/components/social/icons';
import { Image as ImageIcon, Eye, Clock, User } from 'lucide-react';

interface PostGridViewProps {
  posts: SocialPost[];
  onSelectPost: (post: SocialPost) => void;
}

export function PostGridView({ posts, onSelectPost }: PostGridViewProps) {
  const t = useTranslations('SocialMedia');

  if (posts.length === 0) {
    return (
      <div className="border-border bg-card flex h-64 flex-col items-center justify-center rounded-xl border p-6 text-center">
        <ImageIcon className="text-muted-foreground mb-2 size-10 opacity-50" />
        <p className="text-foreground text-sm font-medium">
          {t('page.noPostsYet')}
        </p>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('page.createFirstPost')}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {posts.map((post) => {
        const isInstagram = post.social_account?.platform === 'instagram';

        return (
          <div
            key={post.id}
            onClick={() => onSelectPost(post)}
            className="group border-border bg-card hover:border-primary/50 relative flex cursor-pointer flex-col overflow-hidden rounded-xl border shadow-xs transition-all hover:shadow-md"
          >
            {/* Media Area */}
            <div className="bg-muted relative aspect-square w-full overflow-hidden">
              {post.media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.media_url}
                  alt={post.caption ?? 'Social media post'}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="text-muted-foreground flex h-full w-full items-center justify-center">
                  <ImageIcon className="size-8 opacity-40" />
                </div>
              )}

              {/* Top Badges */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5">
                <div className="bg-background/90 flex size-6 items-center justify-center rounded-full shadow-xs backdrop-blur-xs">
                  {isInstagram ? (
                    <Instagram className="size-3.5 text-pink-600 dark:text-pink-400" />
                  ) : (
                    <Facebook className="size-3.5 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
              </div>

              <div className="absolute top-2 right-2">
                <PostStatusBadge
                  status={post.status}
                  className="bg-background/80 shadow-xs backdrop-blur-xs"
                />
              </div>

              {/* Hover Quick Preview Action */}
              <div className="bg-background/40 absolute inset-0 flex items-center justify-center opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                <div className="bg-background/90 text-foreground flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-md">
                  <Eye className="size-3.5" />
                  <span>{t('table.preview')}</span>
                </div>
              </div>
            </div>

            {/* Content Footer */}
            <div className="flex flex-1 flex-col justify-between p-3">
              <div className="space-y-1">
                <p className="text-foreground line-clamp-2 text-xs font-medium">
                  {post.caption || (
                    <span className="text-muted-foreground italic">
                      No caption
                    </span>
                  )}
                </p>
              </div>

              <div className="border-border text-muted-foreground mt-3 flex items-center justify-between border-t pt-2 text-[11px]">
                {post.scheduled_at ? (
                  <span className="text-primary flex items-center gap-1 font-medium">
                    <Clock className="size-3" />
                    <span>
                      {new Date(post.scheduled_at).toLocaleDateString(
                        undefined,
                        {
                          month: 'short',
                          day: 'numeric',
                        }
                      )}
                    </span>
                  </span>
                ) : (
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                )}

                {post.creator && (
                  <span className="flex max-w-[100px] items-center gap-1 truncate">
                    <User className="size-3" />
                    <span className="truncate">
                      {post.creator.full_name.split(' ')[0]}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
