import { redirect } from 'next/navigation';
import { getCurrentAccount } from '@/lib/auth/account';
import BillingActions from './billing-actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export default async function BillingPage() {
  let ctx;
  try {
    ctx = await getCurrentAccount();
  } catch {
    redirect('/login');
  }

  const { account } = ctx;
  
  if (account.subscription_status === 'active' || account.subscription_status === 'trialing') {
    // If they stumbled here but are active, send them to dashboard
    redirect('/dashboard');
  }

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="border-border bg-card w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="bg-primary/10 mb-2 flex h-12 w-12 items-center justify-center rounded-xl">
            <CreditCard className="text-primary h-6 w-6" />
          </div>
          <CardTitle className="text-foreground text-xl">
            Account {account.subscription_status === 'past_due' ? 'Past Due' : 'Canceled'}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {account.name} needs an active plan to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BillingActions status={account.subscription_status} planTier={account.plan_tier} />
        </CardContent>
      </Card>
    </div>
  );
}
