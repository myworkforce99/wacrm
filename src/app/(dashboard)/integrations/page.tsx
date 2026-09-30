import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { Home, Mail, MessageCircle, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IntegrationsClient } from './integrations-client';

export const metadata = {
  title: 'Integrations',
};

export default async function IntegrationsPage() {
  const { account, accountId, role } = await getCurrentAccount();

  if (role === 'agent') {
    return (
      <div className="flex h-full flex-col items-center justify-center p-4">
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2 text-center">
          Contact your admin to manage integrations.
        </p>
      </div>
    );
  }

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
      icon: Home,
      status: (portalConnections['99acres']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['99acres']?.test_lead_received,
    },
    {
      name: 'MagicBricks',
      slug: 'MagicBricks',
      icon: Home,
      status: (portalConnections['MagicBricks']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['MagicBricks']?.test_lead_received,
    },
    {
      name: 'Housing.com',
      slug: 'Housing.com',
      icon: Home,
      status: (portalConnections['Housing.com']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['Housing.com']?.test_lead_received,
    },
    {
      name: 'Gmail',
      slug: 'Gmail',
      icon: Mail,
      status: (portalConnections['Gmail']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['Gmail']?.test_lead_received,
    },
    {
      name: 'NoBroker',
      slug: 'NoBroker',
      icon: Home,
      status: (portalConnections['NoBroker']?.connected
        ? 'connected'
        : 'not_connected') as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: !!portalConnections['NoBroker']?.test_lead_received,
    },
    {
      name: 'WhatsApp Business',
      slug: 'WhatsApp Business',
      icon: MessageCircle,
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
      icon: Home,
      status: 'coming_soon' as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: false,
    },
    {
      name: 'Instagram',
      slug: 'Instagram',
      icon: MessageCircle,
      status: 'coming_soon' as 'connected' | 'not_connected' | 'coming_soon',
      test_lead: false,
    },
  ];

  return <IntegrationsClient captureEmail={capture_email} portals={portals} />;
}
