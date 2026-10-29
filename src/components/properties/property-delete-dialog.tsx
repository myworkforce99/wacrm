'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import type { Property } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canManageMembers } from '@/lib/auth/roles';

interface PropertyDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property: Property | null;
  onDeleted: (propertyId: string) => void;
}

export function PropertyDeleteDialog({
  open,
  onOpenChange,
  property,
  onDeleted,
}: PropertyDeleteDialogProps) {
  const t = useTranslations('Properties.delete');
  const supabase = createClient();
  const { accountRole } = useAuth();
  const isManager = accountRole ? canManageMembers(accountRole) : false;
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();

  if (!property) return null;

  async function handleDelete() {
    if (!property) return;
    if (!isManager) {
      toast.error('Only admins and owners can delete properties');
      return;
    }
    setDeleting(true);

    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', property.id);

      if (error) {
        throw error;
      }

      toast.success(t('toastSuccess', { title: property.title }));
      onDeleted(property.id);
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
      void queryClient.invalidateQueries({
        queryKey: ['property', property.id],
      });
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      toast.error(t('toastError'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] p-4 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="size-5" />
            {t('title')}
          </DialogTitle>
          <DialogDescription className="pt-2 text-sm">
            {t('description', { title: property.title })}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 border-border text-muted-foreground rounded-lg border p-3 text-xs">
          {t('warning')}
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
