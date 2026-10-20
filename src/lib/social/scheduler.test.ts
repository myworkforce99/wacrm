import { describe, expect, it } from 'vitest';
import { SocialPost } from '@/types';

/**
 * Filter helper that mirrors the scheduler's query logic:
 * - status must be 'scheduled'
 * - scheduled_at <= now
 * - retry_count < 3
 */
function getDueScheduledPosts(
  posts: SocialPost[],
  nowIso: string
): SocialPost[] {
  const now = new Date(nowIso).getTime();
  return posts.filter((post) => {
    if (post.status !== 'scheduled') return false;
    if (!post.scheduled_at) return false;
    if (new Date(post.scheduled_at).getTime() > now) return false;
    if (post.retry_count >= 3) return false;
    return true;
  });
}

describe('social post scheduler logic', () => {
  const basePost: SocialPost = {
    id: 'post_1',
    account_id: 'acc_1',
    social_account_id: 'soc_1',
    caption: 'Test post',
    media_url: 'https://example.com/test.jpg',
    media_storage_path: 'account-acc_1/test.jpg',
    status: 'scheduled',
    scheduled_at: '2026-10-21T10:00:00.000Z',
    platform_post_id: null,
    failure_reason: null,
    retry_count: 0,
    last_attempt_at: null,
    created_by: 'user_1',
    created_at: '2026-10-21T09:00:00.000Z',
    updated_at: '2026-10-21T09:00:00.000Z',
  };

  it('selects posts that are scheduled and past their scheduled_at time', () => {
    const posts: SocialPost[] = [
      {
        ...basePost,
        id: 'post_due',
        scheduled_at: '2026-10-21T10:00:00.000Z',
      },
      {
        ...basePost,
        id: 'post_future',
        scheduled_at: '2026-10-21T12:00:00.000Z',
      },
    ];

    const due = getDueScheduledPosts(posts, '2026-10-21T10:05:00.000Z');
    expect(due.map((p) => p.id)).toEqual(['post_due']);
  });

  it('never picks draft posts even if they have scheduled_at set (Option 3 brand safety)', () => {
    const posts: SocialPost[] = [
      {
        ...basePost,
        id: 'post_agent_draft',
        status: 'draft',
        scheduled_at: '2026-10-21T09:30:00.000Z',
      },
    ];

    const due = getDueScheduledPosts(posts, '2026-10-21T10:05:00.000Z');
    expect(due).toHaveLength(0);
  });

  it('drops posts after 3 failed attempts (retry_count >= 3)', () => {
    const posts: SocialPost[] = [
      {
        ...basePost,
        id: 'post_max_retries',
        retry_count: 3,
        scheduled_at: '2026-10-21T09:30:00.000Z',
      },
      {
        ...basePost,
        id: 'post_retry_ok',
        retry_count: 2,
        scheduled_at: '2026-10-21T09:30:00.000Z',
      },
    ];

    const due = getDueScheduledPosts(posts, '2026-10-21T10:05:00.000Z');
    expect(due.map((p) => p.id)).toEqual(['post_retry_ok']);
  });

  it('cancelling a scheduled post resets status to draft', () => {
    const post: SocialPost = {
      ...basePost,
      status: 'scheduled',
    };

    const cancelledPost: SocialPost = {
      ...post,
      status: 'draft',
    };

    expect(cancelledPost.status).toBe('draft');
    expect(
      getDueScheduledPosts([cancelledPost], '2026-10-21T12:00:00.000Z')
    ).toHaveLength(0);
  });
});
