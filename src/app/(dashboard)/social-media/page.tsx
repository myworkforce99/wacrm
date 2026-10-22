import { getCurrentAccount } from '@/lib/auth/account';
import { getActiveSocialAccounts } from '@/lib/social/accounts';
import { createClient } from '@/lib/supabase/server';
import { SocialMediaClient } from './social-media-client';
import { SocialPost } from '@/types';

export const metadata = { title: 'Social Media' };

export default async function SocialMediaPage() {
  const { accountId, role } = await getCurrentAccount();
  const socialAccounts = await getActiveSocialAccounts(accountId);

  const db = await createClient();
  const [postsRes, profilesRes] = await Promise.all([
    db
      .from('social_posts')
      .select(
        '*, social_account:social_accounts(id, platform, display_name, avatar_url)'
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(100),
    db
      .from('profiles')
      .select('user_id, full_name, email, avatar_url')
      .eq('account_id', accountId),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.user_id, p])
  );

  const enrichedPosts = (postsRes.data ?? []).map((post) => ({
    ...post,
    creator: post.created_by ? profileMap.get(post.created_by) : undefined,
  })) as SocialPost[];

  return (
    <SocialMediaClient
      accountId={accountId}
      role={role}
      socialAccounts={socialAccounts}
      initialPosts={enrichedPosts}
    />
  );
}
