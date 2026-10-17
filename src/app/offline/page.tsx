'use client';

import { useTranslations } from 'next-intl';
import { WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function OfflinePage() {
  const t = useTranslations('OfflinePage');

  const handleReconnect = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4">
      <Card className="border-border bg-card w-full max-w-md text-center">
        <CardHeader className="items-center pb-2">
          <div className="bg-primary/10 mb-2 flex h-14 w-14 items-center justify-center rounded-2xl">
            <WifiOff className="text-primary h-7 w-7" />
          </div>
          <CardTitle className="text-foreground text-xl">
            {t('title')}
          </CardTitle>
          <CardDescription className="text-muted-foreground mt-1 text-sm">
            {t('desc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <Button
            onClick={handleReconnect}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {t('tryReconnecting')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
