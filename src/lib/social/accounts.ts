/**
 * Server-side helpers for social_accounts table access.
 * These run under the authenticated user's Supabase session
 * (RLS enforced), NOT under a service-role key.
 *
 * The access token is never returned by any of these helpers —
 * decryption only happens inside API routes that need to call Meta.
 */
import { createClient } from '@/lib/supabase/server';
import { SocialAccount } from '@/types';

export async function getActiveSocialAccounts(
  accountId: string
): Promise<SocialAccount[]> {
  const db = await createClient();
  const { data, error } = await db
    .from('social_accounts')
    .select(
      'id, account_id, platform, display_name, platform_user_id, token_expires_at, avatar_url, is_active, created_at, updated_at'
    )
    .eq('account_id', accountId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SocialAccount[];
}
