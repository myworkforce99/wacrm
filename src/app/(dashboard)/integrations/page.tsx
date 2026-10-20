import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';

import { IntegrationsClient } from './integrations-client';

export const metadata = {
  title: 'Integrations',
};

export default async function IntegrationsPage() {
  const { account, accountId, role } = await getCurrentAccount();
  const canManage = role === 'owner' || role === 'admin';

  const db = await createClient();
  const { data: whatsappConfig } = await db
    .from('whatsapp_config')
    .select('phone_number_id, status')
    .eq('account_id', accountId)
    .single();

  const domain = process.env.INBOUND_EMAIL_DOMAIN || 'capture.example.com';
  const capture_email = `leads+${accountId.slice(0, 8)}@${domain}`;
  const portalConnections = account.portal_connections || {};

  const portals = [
    {
      name: '99acres',
      slug: '99acres',
      icon: 'Home',
      status: (portalConnections['99acres']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['99acres']?.test_lead_received,
      apiKey: portalConnections['99acres']?.api_key || '',
    },
    {
      name: 'MagicBricks',
      slug: 'MagicBricks',
      icon: 'Home',
      status: (portalConnections['MagicBricks']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['MagicBricks']?.test_lead_received,
      apiKey: portalConnections['MagicBricks']?.api_key || '',
    },
    {
      name: 'Housing.com',
      slug: 'HousingCom',
      icon: 'Home',
      status: (portalConnections['HousingCom']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['HousingCom']?.test_lead_received,
      apiKey: portalConnections['HousingCom']?.api_key || '',
    },
    {
      name: 'Meta Lead Ads',
      slug: 'MetaLeadAds',
      icon: 'Layers',
      status: (portalConnections['MetaLeadAds']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['MetaLeadAds']?.test_lead_received,
      apiKey: portalConnections['MetaLeadAds']?.api_key || '',
    },
    {
      name: 'Custom Webhooks',
      slug: 'CustomWebhooks',
      icon: 'Webhook',
      status: (portalConnections['CustomWebhooks']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['CustomWebhooks']?.test_lead_received,
      apiKey: portalConnections['CustomWebhooks']?.api_key || '',
    },
    {
      name: 'Gmail',
      slug: 'Gmail',
      icon: 'Mail',
      status: (portalConnections['Gmail']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['Gmail']?.test_lead_received,
      apiKey: portalConnections['Gmail']?.api_key || '',
    },
    {
      name: 'NoBroker',
      slug: 'NoBroker',
      icon: 'Home',
      status: (portalConnections['NoBroker']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['NoBroker']?.test_lead_received,
      apiKey: portalConnections['NoBroker']?.api_key || '',
    },
    {
      name: 'WhatsApp Business',
      slug: 'WhatsApp Business',
      icon: 'MessageCircle',
      status: (whatsappConfig?.phone_number_id &&
      whatsappConfig?.status === 'connected'
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: false,
      isNative: true,
    },
    {
      name: 'JustDial',
      slug: 'JustDial',
      icon: 'Home',
      status: 'coming_soon' as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: false,
    },
    {
      name: 'Instagram',
      slug: 'Instagram',
      icon: 'Instagram',
      status: 'coming_soon' as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: false,
      link: '/social-media',
    },
  ];

  return (
    <IntegrationsClient
      accountId={accountId}
      captureEmail={capture_email}
      portals={portals}
      canManage={canManage}
      role={role}
    />
  );
}
