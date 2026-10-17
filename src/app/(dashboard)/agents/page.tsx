'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bot, Sparkles, Settings2, BarChart3, BookOpen } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AiPlayground } from '@/components/agents/ai-playground';
import { AiUsageCard } from '@/components/agents/ai-usage';
import { AiConfig } from '@/components/settings/ai-config';
import { AiKnowledgeCard } from '@/components/settings/ai-knowledge';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';

type Tab = 'playground' | 'knowledge' | 'setup' | 'usage';

export default function AgentsPage() {
  const t = useTranslations('Agents');
  const { accountId, accountRole } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;
  const canViewUsage = canEdit;
  const [tab, setTab] = useState<Tab>('playground');
  const [decided, setDecided] = useState(false);

  // Land first-time users on Setup, returning users on the Playground.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/ai/config');
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setTab(data?.configured ? 'playground' : 'setup');
      } catch {
        if (!cancelled) setTab('setup');
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 pb-20 md:pb-6">
      <div>
        <div className="flex items-center gap-2">
          <Bot className="text-primary h-6 w-6" />
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {t('title')}
          </h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
      </div>

      {decided && (
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as Tab)}
          className="mt-2"
        >
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="playground">
              <Sparkles className="mr-1.5 h-4 w-4" /> {t('tabPlayground')}
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <BookOpen className="mr-1.5 h-4 w-4" /> {t('tabKnowledge')}
            </TabsTrigger>
            <TabsTrigger value="setup">
              <Settings2 className="mr-1.5 h-4 w-4" /> {t('tabSetup')}
            </TabsTrigger>
            {canViewUsage && (
              <TabsTrigger value="usage">
                <BarChart3 className="mr-1.5 h-4 w-4" /> {t('tabUsage')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="playground" className="mt-4">
            <AiPlayground
              onGoToSetup={() => setTab('setup')}
              onGoToKnowledge={() => setTab('knowledge')}
            />
          </TabsContent>

          <TabsContent value="knowledge" className="mt-4">
            <AiKnowledgeCard
              accountId={accountId}
              canEdit={canEdit}
              hasEmbeddingsKey={true}
            />
          </TabsContent>

          <TabsContent value="setup" className="mt-4">
            <AiConfig />
          </TabsContent>

          {canViewUsage && (
            <TabsContent value="usage" className="mt-4">
              <AiUsageCard />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
