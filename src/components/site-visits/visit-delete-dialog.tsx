'use client';

/**
 * VisitDeleteDialog
 *
 * Confirmation dialog for removing a scheduled site visit:
 *  - Uses base-ui wrapped Dialog primitives from @/components/ui/dialog
 *  - Cleans up associated tasks linked via site_visit_id
 *  - Shows sonner feedback and dark/light mode safe styling
 */

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { SiteVisit, Contact, Property } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

type VisitWithDetails = SiteVisit & {
  contact?: Contact | null;
  property?: Property | null;
};

interface VisitDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visit: VisitWithDetails | null;
  onDeleted: (visitId: string) => void;
}

export function VisitDeleteDialog({
  open,
  onOpenChange,
  visit,
  onDeleted,
}: VisitDeleteDialogProps) {
  const t = useTranslations('SiteVisits.delete');
  const supabase = createClient();
  const [deleting, setDeleting] = useState(false);

  if (!visit) return null;

  const leadName =
    visit.contact?.name || visit.contact?.phone || t('fallbackLead');
  const formattedDate = visit.scheduled_at
    ? format(new Date(visit.scheduled_at), 'PPP · p')
    : '—';

  async function handleDelete() {
    if (!visit) return;
    setDeleting(true);

    try {
      // 1. Delete associated tasks first if any
      await supabase.from('tasks').delete().eq('site_visit_id', visit.id);

      // 2. Delete the site visit
      const { error } = await supabase
        .from('site_visits')
        .delete()
        .eq('id', visit.id);

      if (error) {
        throw error;
      }

      toast.success(t('toastSuccess'));
      onDeleted(visit.id);
      onOpenChange(false);
    } catch (err: unknown) {
      console.error('Error deleting site visit:', err);
      toast.error(t('toastError'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="size-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="text-foreground/80 pt-2 text-sm">
            {t('description', { name: leadName, date: formattedDate })}
          </DialogDescription>
        </DialogHeader>

        {visit.property && (
          <div className="bg-muted/50 border-border text-foreground space-y-1 rounded-xl border p-3 text-xs">
            <p className="text-foreground font-semibold">
              {visit.property.title}
            </p>
            {visit.property.location && (
              <p className="text-muted-foreground">{visit.property.location}</p>
            )}
          </div>
        )}

        <div className="bg-destructive/10 border-destructive/20 text-destructive flex items-center gap-2 rounded-xl border p-3 text-xs">
          <AlertTriangle className="size-4 shrink-0" />
          <span>{t('warning')}</span>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
            className="gap-1.5"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
