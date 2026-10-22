'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Property } from '@/types';
import { formatINR } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, Search, MapPin, IndianRupee, Loader2 } from 'lucide-react';

interface PropertyAttachPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  onSelectProperty: (propertyText: string, suggestedHashtags: string[]) => void;
}

export function PropertyAttachPicker({
  open,
  onOpenChange,
  accountId,
  onSelectProperty,
}: PropertyAttachPickerProps) {
  const t = useTranslations('SocialMedia.properties');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    async function loadProperties() {
      setLoading(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) throw error;
        if (isMounted) setProperties((data ?? []) as Property[]);
      } catch (err) {
        console.error('Failed to load properties for social attach:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadProperties();
    return () => {
      isMounted = false;
    };
  }, [open, accountId]);

  const filteredProperties = useMemo(() => {
    if (!search.trim()) return properties;
    const q = search.toLowerCase();
    return properties.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.location && p.location.toLowerCase().includes(q)) ||
        (p.project_name && p.project_name.toLowerCase().includes(q))
    );
  }, [properties, search]);

  const handleSelect = (prop: Property) => {
    // Generate real estate prompt details
    const parts: string[] = [prop.title];
    if (prop.configuration) parts.push(prop.configuration);
    if (prop.location) parts.push(`in ${prop.location}`);
    if (prop.price) parts.push(`priced at ${formatINR(prop.price)}`);
    if (prop.possession_status) {
      parts.push(prop.possession_status.replace(/_/g, ' '));
    }
    if (prop.rera_id) parts.push(`RERA: ${prop.rera_id}`);

    const detailsText = parts.join(', ');

    // Generate hashtag seeds
    const hashtags: string[] = ['#RealEstate', '#PropertyListing'];
    if (prop.configuration) {
      hashtags.push(`#${prop.configuration.replace(/\s+/g, '')}`);
    }
    if (prop.location) {
      const locClean = prop.location.split(',')[0].trim().replace(/\s+/g, '');
      if (locClean) hashtags.push(`#${locClean}RealEstate`);
    }
    if (prop.project_name) {
      hashtags.push(`#${prop.project_name.replace(/\s+/g, '')}`);
    }

    onSelectProperty(detailsText, hashtags);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-[95vw] flex-col overflow-hidden p-4 sm:max-w-lg sm:p-6">
        <DialogHeader className="p-0">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Building2 className="text-primary size-5" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative mt-3">
          <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search')}
            className="pl-9 text-xs"
          />
        </div>

        {/* Property List */}
        <div className="mt-4 max-h-[50vh] flex-1 scrollbar-none space-y-2.5 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="text-primary size-6 animate-spin" />
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="text-muted-foreground flex h-32 flex-col items-center justify-center text-xs">
              <Building2 className="mb-2 size-6 opacity-40" />
              <span>{t('noProperties')}</span>
            </div>
          ) : (
            filteredProperties.map((prop) => (
              <div
                key={prop.id}
                onClick={() => handleSelect(prop)}
                className="border-border hover:border-primary/50 hover:bg-muted/50 group flex cursor-pointer items-center justify-between rounded-xl border p-3 transition-colors"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-foreground group-hover:text-primary truncate text-sm font-semibold">
                      {prop.title}
                    </h4>
                    {prop.configuration && (
                      <span className="border-border bg-muted text-muted-foreground shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium">
                        {prop.configuration}
                      </span>
                    )}
                  </div>

                  <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-3 text-xs">
                    {prop.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        <span className="max-w-[160px] truncate">
                          {prop.location}
                        </span>
                      </span>
                    )}
                    {prop.price !== undefined && prop.price !== null && (
                      <span className="text-foreground flex items-center font-medium">
                        <IndianRupee className="size-3" />
                        <span>{formatINR(prop.price)}</span>
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground h-7 shrink-0 px-2.5 text-xs font-medium"
                >
                  {t('select')}
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
