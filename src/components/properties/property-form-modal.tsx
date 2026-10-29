'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/auth/roles';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import type { Property } from '@/types';
import {
  PropertyFormSchema,
  type PropertyFormValues,
  type PropertyType,
  type PossessionStatus,
  type FacingDirection,
  FACING_DIRECTIONS,
} from '@/lib/schemas/property';
import { parseBudget } from '@/lib/contacts/parse-budget';
import { formatINR } from '@/lib/currency';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Building,
  MapPin,
  IndianRupee,
  ShieldCheck,
  AlertTriangle,
  Plus,
  X,
  Calendar,
  Maximize,
  Compass,
} from 'lucide-react';

interface PropertyFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: Property | null;
  onSaved: (property: Property) => void;
}

const PROPERTY_TYPES: PropertyType[] = [
  'Apartment',
  'Villa',
  'Plot',
  'Commercial',
  'Penthouse',
  'Builder Floor',
];

const RESIDENTIAL_CONFIGURATIONS = [
  'Studio',
  '1BHK',
  '2BHK',
  '3BHK',
  '4BHK',
  '5+ BHK',
];

const SUGGESTED_AMENITIES = [
  'Swimming Pool',
  'Clubhouse',
  'Gym',
  'Gated Security',
  'Power Backup',
  'Vastu Compliant',
  'Corner Unit',
  'Metro Connectivity',
  'Covered Parking',
  'Children Play Area',
];

const DEFAULT_FORM_VALUES: PropertyFormValues = {
  title: '',
  project_name: '',
  builder_name: '',
  location: '',
  property_type: 'Apartment',
  configuration: '2BHK',
  bedrooms: '2',
  carpet_area: '',
  facing: 'East',
  price_input: '',
  rera_id: '',
  possession_status: 'ready_to_move',
  possession_date: '',
};

export function PropertyFormModal({
  open,
  onOpenChange,
  property,
  onSaved,
}: PropertyFormModalProps) {
  const t = useTranslations('Properties.form');
  const supabase = createClient();
  const { accountId, accountRole } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;
  const isEdit = !!property;
  const queryClient = useQueryClient();

  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PropertyFormValues>({
    resolver: zodResolver(PropertyFormSchema),
    defaultValues: DEFAULT_FORM_VALUES,
  });

  const propertyType = watch('property_type');
  const configuration = watch('configuration');
  const facing = watch('facing');
  const priceInput = watch('price_input');
  const reraId = watch('rera_id') || '';
  const possessionStatus = watch('possession_status');

  // Live parsed budget preview
  const parsedPrice = useMemo(() => {
    return parseBudget(priceInput || '');
  }, [priceInput]);

  const isNonBhkPropertyType =
    propertyType === 'Plot' || propertyType === 'Commercial';

  const availableConfigurations = useMemo(() => {
    const list = [...RESIDENTIAL_CONFIGURATIONS];
    if (
      configuration &&
      !list.includes(configuration) &&
      configuration !== 'Plot' &&
      configuration !== 'Commercial'
    ) {
      list.push(configuration);
    }
    return list;
  }, [configuration]);

  // Sync state with open/property
  useEffect(() => {
    if (!open) return;

    if (property) {
      reset({
        title: property.title || '',
        project_name: property.project_name || '',
        builder_name: property.builder_name || '',
        location: property.location || '',
        property_type: (property.property_type as PropertyType) || 'Apartment',
        configuration: property.configuration || '2BHK',
        bedrooms: property.bedrooms != null ? String(property.bedrooms) : '2',
        carpet_area:
          property.carpet_area != null ? String(property.carpet_area) : '',
        facing: (property.facing as FacingDirection) || 'East',
        price_input: property.price != null ? String(property.price) : '',
        rera_id: property.rera_id || '',
        possession_status:
          (property.possession_status as PossessionStatus) || 'ready_to_move',
        possession_date: property.possession_date || '',
      });
      setTags(property.tags || []);
    } else {
      reset(DEFAULT_FORM_VALUES);
      setTags([]);
    }
    setNewTagInput('');
  }, [open, property, reset]);

  function handleAddTag(tagToAdd: string) {
    const trimmed = tagToAdd.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setNewTagInput('');
  }

  function handleRemoveTag(tagToRemove: string) {
    setTags((prev) => prev.filter((t) => t !== tagToRemove));
  }

  async function onFormSubmit(values: PropertyFormValues) {
    if (!accountId) {
      toast.error(t('errorNoAccount'));
      return;
    }

    if (!isManager) {
      toast.error(t('errorManagerOnly'));
      return;
    }

    setSaving(true);

    const isNonBhk =
      values.property_type === 'Plot' || values.property_type === 'Commercial';
    const computedPrice = parseBudget(values.price_input || '');

    const payload = {
      title: values.title.trim(),
      project_name: values.project_name?.trim() || null,
      builder_name: values.builder_name?.trim() || null,
      location: values.location?.trim() || null,
      property_type: values.property_type || null,
      configuration: isNonBhk
        ? values.property_type
        : values.configuration || null,
      bedrooms: isNonBhk
        ? null
        : values.bedrooms
          ? parseInt(values.bedrooms, 10)
          : null,
      carpet_area: values.carpet_area ? parseFloat(values.carpet_area) : null,
      facing: values.facing || null,
      price: computedPrice,
      rera_id: values.rera_id?.trim() || null,
      possession_status: values.possession_status,
      possession_date: values.possession_date
        ? values.possession_date.slice(0, 10)
        : null,
      tags: tags.length > 0 ? tags : null,
    };

    try {
      if (isEdit && property) {
        const { data, error } = await supabase
          .from('properties')
          .update(payload)
          .eq('id', property.id)
          .select()
          .single();

        if (error) throw error;
        toast.success(t('toastUpdated'));
        onSaved(data as Property);
        void queryClient.invalidateQueries({ queryKey: ['properties'] });
        void queryClient.invalidateQueries({
          queryKey: ['property', property.id],
        });
        onOpenChange(false);
      } else {
        const { data, error } = await supabase
          .from('properties')
          .insert({
            ...payload,
            account_id: accountId,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success(t('toastCreated'));
        onSaved(data as Property);
        void queryClient.invalidateQueries({ queryKey: ['properties'] });
        onOpenChange(false);
      }
    } catch (err: unknown) {
      console.error(err);
      toast.error(t('toastSaveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-[95vw] overflow-x-hidden overflow-y-auto p-4 sm:max-w-2xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building className="text-primary size-5" />
            {isEdit ? t('editTitle') : t('createTitle')}
          </DialogTitle>
          <DialogDescription>
            {isEdit ? t('editDescription') : t('createDescription')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-5">
          {/* Section 1: Basic Identity */}
          <div className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('sectionBasic')}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="prop-title" className="text-xs font-medium">
                  {t('labelTitle')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prop-title"
                  {...register('title')}
                  placeholder={t('placeholderTitle')}
                  className="h-9 text-xs"
                />
                {errors.title && (
                  <p className="text-destructive text-[11px]">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-project" className="text-xs font-medium">
                  {t('labelProject')}
                </Label>
                <Input
                  id="prop-project"
                  {...register('project_name')}
                  placeholder={t('placeholderProject')}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-builder" className="text-xs font-medium">
                  {t('labelBuilder')}
                </Label>
                <Input
                  id="prop-builder"
                  {...register('builder_name')}
                  placeholder={t('placeholderBuilder')}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label
                  htmlFor="prop-location"
                  className="flex items-center gap-1 text-xs font-medium"
                >
                  <MapPin className="text-muted-foreground size-3" />
                  {t('labelLocation')}
                </Label>
                <Input
                  id="prop-location"
                  {...register('location')}
                  placeholder={t('placeholderLocation')}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Configuration & Specs */}
          <div className="border-border space-y-3 border-t pt-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('sectionSpecs')}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t('labelType')}</Label>
                <Select
                  value={propertyType}
                  onValueChange={(val) => {
                    if (val) {
                      setValue('property_type', val as PropertyType);
                      if (val === 'Plot' || val === 'Commercial') {
                        setValue('configuration', val);
                        setValue('bedrooms', '');
                      } else if (
                        configuration === 'Plot' ||
                        configuration === 'Commercial'
                      ) {
                        setValue('configuration', '2BHK');
                        setValue('bedrooms', '2');
                      }
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={t('selectType')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPES.map((type) => (
                      <SelectItem key={type} value={type} className="text-xs">
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  {t('labelConfig')}
                </Label>
                {isNonBhkPropertyType ? (
                  <div className="border-border/60 bg-muted/40 text-muted-foreground flex h-9 items-center rounded-md border px-3 text-xs">
                    <span>
                      {t('configNotApplicable', { type: propertyType })}
                    </span>
                  </div>
                ) : (
                  <Select
                    value={configuration}
                    onValueChange={(val) => {
                      if (val) {
                        setValue('configuration', val);
                        // Auto-populate bedroom count if format matches \d+BHK
                        const match = val.match(/^(\d+)BHK/);
                        if (match) setValue('bedrooms', match[1]);
                        else if (val === 'Studio') setValue('bedrooms', '1');
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder={t('selectConfig')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableConfigurations.map((cfg) => (
                        <SelectItem key={cfg} value={cfg} className="text-xs">
                          {cfg}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prop-bedrooms" className="text-xs font-medium">
                  {t('labelBedrooms')}
                </Label>
                {isNonBhkPropertyType ? (
                  <div className="border-border/60 bg-muted/40 text-muted-foreground flex h-9 items-center rounded-md border px-3 text-xs">
                    <span>N/A</span>
                  </div>
                ) : (
                  <Input
                    id="prop-bedrooms"
                    type="number"
                    min="0"
                    max="20"
                    {...register('bedrooms')}
                    className="h-9 text-xs"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="prop-carpet-area"
                  className="flex items-center gap-1 text-xs font-medium"
                >
                  <Maximize className="text-muted-foreground size-3" />
                  {t('labelCarpetArea')}
                </Label>
                <Input
                  id="prop-carpet-area"
                  type="number"
                  min="0"
                  {...register('carpet_area')}
                  placeholder="e.g. 1450"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1 text-xs font-medium">
                  <Compass className="text-muted-foreground size-3" />
                  {t('labelFacing')}
                </Label>
                <Select
                  value={facing}
                  onValueChange={(val) => {
                    if (val) setValue('facing', val as FacingDirection);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={t('selectFacing')} />
                  </SelectTrigger>
                  <SelectContent>
                    {FACING_DIRECTIONS.map((f) => (
                      <SelectItem key={f} value={f} className="text-xs">
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="prop-price"
                  className="flex items-center gap-1 text-xs font-medium"
                >
                  <IndianRupee className="text-muted-foreground size-3" />
                  {t('labelPrice')}
                </Label>
                <Input
                  id="prop-price"
                  {...register('price_input')}
                  placeholder="e.g. 1.25 Cr, 85L"
                  className="h-9 text-xs"
                />
                {parsedPrice !== null && parsedPrice > 0 && (
                  <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {t('livePricePreview', {
                      formatted: formatINR(parsedPrice),
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Compliance & Timeline */}
          <div className="border-border space-y-3 border-t pt-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('sectionCompliance')}
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-3">
                <Label
                  htmlFor="prop-rera"
                  className="flex items-center justify-between text-xs font-medium"
                >
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="text-muted-foreground size-3" />
                    {t('labelRera')}
                  </span>
                  {reraId.trim() ? (
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                      {t('reraVerified')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-amber-500">
                      <AlertTriangle className="size-2.5" />
                      {t('reraMissingNote')}
                    </span>
                  )}
                </Label>
                <Input
                  id="prop-rera"
                  {...register('rera_id')}
                  placeholder="e.g. PRM/KA/RERA/1251/446/PR/190823/002804"
                  className="h-9 font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium">
                  {t('labelPossessionStatus')}
                </Label>
                <Select
                  value={possessionStatus}
                  onValueChange={(val) => {
                    if (val) {
                      setValue('possession_status', val as PossessionStatus);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ready_to_move" className="text-xs">
                      {t('possessionReady')}
                    </SelectItem>
                    <SelectItem value="under_construction" className="text-xs">
                      {t('possessionUnderConstruction')}
                    </SelectItem>
                    <SelectItem value="nearing_possession" className="text-xs">
                      {t('possessionNearing')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="prop-possession-date"
                  className="flex items-center gap-1 text-xs font-medium"
                >
                  <Calendar className="text-muted-foreground size-3" />
                  {t('labelPossessionDate')}
                </Label>
                <Input
                  id="prop-possession-date"
                  type="date"
                  {...register('possession_date')}
                  className="h-9 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Amenities / Tags */}
          <div className="border-border space-y-3 border-t pt-4">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
              {t('sectionAmenities')}
            </h3>

            {/* Selected tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-destructive text-primary/70"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Custom tag input */}
            <div className="flex items-center gap-2">
              <Input
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag(newTagInput);
                  }
                }}
                placeholder={t('customTagPlaceholder')}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleAddTag(newTagInput)}
                disabled={!newTagInput.trim()}
                className="h-8 gap-1 px-2.5 text-xs"
              >
                <Plus className="size-3.5" />
                {t('addTagBtn')}
              </Button>
            </div>

            {/* Suggested quick chips */}
            <div className="space-y-1">
              <span className="text-muted-foreground text-[11px]">
                {t('suggestedTags')}:
              </span>
              <div className="flex flex-wrap gap-1">
                {SUGGESTED_AMENITIES.filter((a) => !tags.includes(a))
                  .slice(0, 6)
                  .map((suggested) => (
                    <button
                      key={suggested}
                      type="button"
                      onClick={() => handleAddTag(suggested)}
                      className="border-border/70 bg-card text-muted-foreground hover:bg-muted hover:text-foreground rounded border px-2 py-0.5 text-[11px] transition-colors"
                    >
                      + {suggested}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-border gap-2 border-t pt-4 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={saving} className="gap-1.5">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? t('updateBtn') : t('createBtn')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
