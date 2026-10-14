'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useTranslations } from 'next-intl';
import { TrendingUp } from 'lucide-react';

export function PipelineFunnelChart() {
  const t = useTranslations('Team.funnel');
  const [data, setData] = useState<{ stage: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunnel = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/pipeline-funnel');
      if (res.ok) {
        const d = await res.json();
        if (d.funnel) {
          setData(d.funnel);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchFunnel();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchFunnel]);

  if (loading) {
    return (
      <Card className="border-border bg-card shadow-xs">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-primary size-5" />
            <CardTitle>{t('title')}</CardTitle>
          </div>
          <CardDescription>{t('loading')}</CardDescription>
        </CardHeader>
        <CardContent className="flex h-[280px] items-center justify-center">
          <div className="bg-muted h-[200px] w-full animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="border-border bg-card shadow-xs">
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="text-primary size-5" />
          <CardTitle className="text-lg font-bold">{t('title')}</CardTitle>
        </div>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 20, left: 0, bottom: 20 }}
            >
              <XAxis
                dataKey="stage"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                tickMargin={10}
                className="text-muted-foreground fill-muted-foreground font-medium"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                fontSize={12}
                allowDecimals={false}
                className="text-muted-foreground fill-muted-foreground font-medium"
              />
              <Tooltip
                cursor={{ fill: 'currentColor', opacity: 0.05 }}
                contentStyle={{
                  borderRadius: '10px',
                  backgroundColor: 'var(--card, #ffffff)',
                  borderColor: 'var(--border, #e2e8f0)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  color: 'var(--foreground, #000000)',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [
                  t('dealsCount', { count: Number(value) || 0 }),
                  t('title'),
                ]}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={`hsl(var(--chart-${(index % 5) + 1}))`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
