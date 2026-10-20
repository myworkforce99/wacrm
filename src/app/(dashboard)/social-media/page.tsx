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
  const { data: posts } = await db
    .from('social_posts')
    .select(
      '*, social_account:social_accounts(id, platform, display_name, avatar_url)'
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <SocialMediaClient
      accountId={accountId}
      role={role}
      socialAccounts={socialAccounts}
      initialPosts={(posts ?? []) as SocialPost[]}
    />
  );
}
