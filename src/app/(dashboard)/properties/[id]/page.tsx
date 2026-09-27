'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Property } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  MapPin,
  Building,
  DollarSign,
  Bed,
  ChevronLeft,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Maximize,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/use-auth';
import { formatCurrency, formatINR } from '@/lib/currency';
import Link from 'next/link';

export default function PropertyDetailPage() {
  const t = useTranslations('Properties.detail');
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const { account } = useAuth();
  const defaultCurrency = account?.default_currency || 'USD';

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProperty = useCallback(async () => {
    if (!params.id) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('properties')
      .select('*')
      .eq('id', params.id as string)
      .single();

    if (!error && data) {
      setProperty(data);
    }
    setLoading(false);
  }, [supabase, params.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProperty();
  }, [fetchProperty]);

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <Loader2 className="text-primary size-8 animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-foreground">Property not found.</p>
        <Button variant="link" onClick={() => router.push('/properties')}>
          Back to Properties
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/properties')}
          className="shrink-0"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-foreground text-2xl font-bold">
              {property.title}
            </h1>
            {property.configuration && (
              <Badge
                variant="default"
                className="bg-primary text-primary-foreground px-3 py-1 text-sm font-bold"
              >
                {property.configuration}
              </Badge>
            )}
          </div>
          <div className="mt-2">
            {property.rera_id ? (
              <Badge
                variant="outline"
                className="border-green-500/30 bg-green-500/10 text-green-700"
              >
                <CheckCircle2 className="mr-1 size-3" />
                RERA: {property.rera_id}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-500/30 bg-amber-500/10 text-amber-700"
              >
                <AlertTriangle className="mr-1 size-3" />
                RERA ID missing — required under RERA Act 2016
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {property.price && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <DollarSign className="size-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('price')}
                  </p>
                  <p className="text-lg font-semibold">
                    {defaultCurrency === 'INR'
                      ? formatINR(property.price)
                      : formatCurrency(property.price, defaultCurrency)}
                  </p>
                </div>
              </div>
            )}

            {property.location && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Location
                  </p>
                  <p className="text-lg font-semibold">{property.location}</p>
                </div>
              </div>
            )}

            {property.property_type && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <Building className="size-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('type')}
                  </p>
                  <p className="text-lg font-semibold">
                    {property.property_type}
                  </p>
                </div>
              </div>
            )}

            {property.bedrooms !== undefined && property.bedrooms !== null && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <Bed className="size-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    {t('bedrooms')}
                  </p>
                  <p className="text-lg font-semibold">{property.bedrooms}</p>
                </div>
              </div>
            )}

            {property.possession_status && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <Calendar className="size-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Possession Status
                  </p>
                  <p className="text-lg font-semibold capitalize">
                    {property.possession_status.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>
            )}

            {property.carpet_area && (
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
                  <Maximize className="size-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm font-medium">
                    Carpet Area
                  </p>
                  <p className="text-lg font-semibold">
                    {property.carpet_area} sq ft
                  </p>
                </div>
              </div>
            )}
          </div>

          {property.tags && property.tags.length > 0 && (
            <div className="border-border mt-8 border-t pt-6">
              <p className="text-muted-foreground mb-3 text-sm font-medium">
                {t('tags')}
              </p>
              <div className="flex flex-wrap gap-2">
                {property.tags.map((tag, i) => (
                  <Badge key={i} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
