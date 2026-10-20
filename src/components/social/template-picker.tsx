'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  SOCIAL_POST_TEMPLATES,
  SocialPostTemplate,
  SocialPostTemplateCategory,
} from '@/lib/social/templates';
import { Sparkles, Hash, ArrowRight } from 'lucide-react';

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTemplate: (template: SocialPostTemplate) => void;
}

const CATEGORIES: (SocialPostTemplateCategory | 'all')[] = [
  'all',
  'property_launch',
  'site_visit',
  'testimonial',
  'offer',
  'general',
];

export function TemplatePicker({
  open,
  onOpenChange,
  onSelectTemplate,
}: TemplatePickerProps) {
  const t = useTranslations('SocialMedia');
  const [selectedCategory, setSelectedCategory] = useState<
    SocialPostTemplateCategory | 'all'
  >('all');

  const filteredTemplates =
    selectedCategory === 'all'
      ? SOCIAL_POST_TEMPLATES
      : SOCIAL_POST_TEMPLATES.filter(
          (tpl) => tpl.category === selectedCategory
        );

  const getCategoryBadgeColor = (category: SocialPostTemplateCategory) => {
    switch (category) {
      case 'property_launch':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'site_visit':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'testimonial':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'offer':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'general':
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col p-6 sm:max-w-2xl">
        <DialogHeader className="p-0">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-lg">
              <Sparkles className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {t('templates.title')}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-xs">
                {t('templates.subtitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Category Filter Pills */}
        <div className="flex scrollbar-none gap-1.5 overflow-x-auto pt-2 pb-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {cat === 'all'
                ? t('templates.all')
                : t(`templates.categories.${cat}`)}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        <div className="flex-1 space-y-3 overflow-y-auto pt-2 pr-1">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => {
                onSelectTemplate(template);
                onOpenChange(false);
              }}
              className="group border-border bg-card hover:border-primary/50 flex cursor-pointer flex-col justify-between gap-3 rounded-xl border p-4 transition-all hover:shadow-xs"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-foreground group-hover:text-primary text-sm font-semibold transition-colors">
                    {template.title}
                  </h4>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${getCategoryBadgeColor(
                      template.category
                    )}`}
                  >
                    {t(`templates.categories.${template.category}`)}
                  </span>
                </div>

                <p className="text-muted-foreground text-xs leading-relaxed">
                  {template.promptSeed}
                </p>
              </div>

              <div className="border-border/50 flex items-center justify-between gap-3 border-t pt-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Hash className="text-muted-foreground size-3" />
                  {template.suggestedHashtags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  className="group-hover:bg-primary group-hover:text-primary-foreground h-7 shrink-0 px-2.5 text-xs transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTemplate(template);
                    onOpenChange(false);
                  }}
                >
                  <span>{t('templates.useTemplate')}</span>
                  <ArrowRight className="ml-1 size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
