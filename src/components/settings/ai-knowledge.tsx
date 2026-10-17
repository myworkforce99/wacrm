'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2,
  Plus,
  Trash2,
  Pencil,
  RefreshCw,
  BookOpen,
  FileText,
  UploadCloud,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { useTranslations } from 'next-intl';

interface DocSummary {
  id: string;
  title: string;
  content?: string;
  updated_at: string;
}

type EditTarget = 'new' | string | null;

export function AiKnowledgeCard({
  accountId,
  canEdit,
  hasEmbeddingsKey,
}: {
  accountId: string | null;
  canEdit: boolean;
  hasEmbeddingsKey: boolean;
}) {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditTarget>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedAccountIdRef = useRef<string | null>(null);
  const t = useTranslations('Settings.aiKnowledge');

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ai/knowledge');
      const data = await res.json();
      if (res.ok) setDocs(data.documents ?? []);
      else toast.error(data.error ?? t('loadFailed'));
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!accountId || loadedAccountIdRef.current === accountId) return;
    loadedAccountIdRef.current = accountId;
    void fetchDocs();
  }, [accountId, fetchDocs]);

  const openNew = () => {
    setEditing('new');
    setTitle('');
    setContent('');
  };

  const openEdit = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/knowledge/${id}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? t('openFailed'));
        return;
      }
      setEditing(id);
      setTitle(data.title ?? '');
      setContent(data.content ?? '');
    } catch {
      toast.error(t('openFailed'));
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setTitle('');
    setContent('');
  };

  const handleFileUpload = (file: File) => {
    const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
    const reader = new FileReader();

    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setTitle(fileNameWithoutExt);
        setContent(text);
        setEditing('new');
        toast.success(`Loaded file: ${file.name}`);
      } else {
        toast.error('Could not extract text from file');
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
    };

    // For plain text, markdown, json, csv
    reader.readAsText(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const save = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error(t('titleContentRequired'));
      return;
    }
    setSaving(true);
    try {
      const isNew = editing === 'new';
      const res = await fetch(
        isNew ? '/api/ai/knowledge' : `/api/ai/knowledge/${editing}`,
        {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            content: content.trim(),
          }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        if (data.warning) toast.warning(data.warning);
        else
          toast.success(isNew ? t('saveSuccessNew') : t('saveSuccessUpdate'));
        cancelEdit();
        await fetchDocs();
      } else {
        toast.error(data.error ?? t('saveFailed'));
      }
    } catch {
      toast.error(t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/ai/knowledge/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(t('removeSuccess'));
        setDocs((d) => d.filter((x) => x.id !== id));
      } else {
        const data = await res.json();
        toast.error(data.error ?? t('removeFailed'));
      }
    } catch {
      toast.error(t('removeFailed'));
    }
  };

  const reindex = async () => {
    setReindexing(true);
    try {
      const res = await fetch('/api/ai/knowledge/reindex', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(t('reindexSuccess', { count: data.reindexed }));
      } else {
        toast.error(data.error ?? t('reindexFailed'));
      }
    } catch {
      toast.error(t('reindexFailed'));
    } finally {
      setReindexing(false);
    }
  };

  return (
    <Card className="border-border bg-card">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <BookOpen className="text-primary size-5" /> {t('title')}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              {t('description', {
                searchType: hasEmbeddingsKey
                  ? t('semanticSearchOn')
                  : t('keywordSearchOn'),
              })}
            </CardDescription>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={openNew} className="text-xs h-8">
                <Plus className="mr-1.5 size-3.5" /> {t('addDoc')}
              </Button>
              {hasEmbeddingsKey && docs.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reindex}
                  disabled={reindexing}
                  title={t('reindexTooltip')}
                  className="text-xs h-8 text-muted-foreground hover:text-foreground"
                >
                  {reindexing ? (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 size-3.5" />
                  )}
                  {t('reindex')}
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Document Upload Dropzone */}
        {canEdit && editing === null && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 sm:p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.json,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="bg-primary/10 text-primary p-2.5 rounded-full">
                <UploadCloud className="size-6" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                Upload Property Brochure or FAQ Document
              </p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Drag and drop PDF brochures, project specifications, or FAQ documents (.txt, .md, .pdf, .json) to index knowledge.
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="text-muted-foreground flex items-center justify-center py-8 text-sm">
            <Loader2 className="mr-2 size-4 animate-spin text-primary" /> {t('loading')}
          </div>
        ) : (
          <>
            {/* Empty State */}
            {docs.length === 0 && editing === null && (
              <div className="text-muted-foreground border-border bg-muted/20 flex flex-col items-center justify-center rounded-xl border p-8 text-center text-sm">
                <FileText className="text-muted-foreground/60 mb-2 size-8" />
                <p className="font-medium text-foreground">{t('noDocs')}</p>
                <p className="mt-1 text-xs max-w-sm text-muted-foreground">
                  Upload project brochures or click &quot;+ Add Document&quot; to provide context on properties, pricing, and FAQs.
                </p>
              </div>
            )}

            {/* Document Index List */}
            {docs.length > 0 && editing === null && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>Indexed Documents ({docs.length})</span>
                  <span>RAG Status</span>
                </div>

                <div className="divide-border border-border divide-y rounded-xl border bg-card overflow-hidden">
                  {docs.map((doc) => {
                    const estimatedChunks = Math.max(
                      1,
                      Math.ceil((doc.content?.length || 600) / 450)
                    );

                    return (
                      <div
                        key={doc.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <BookOpen className="size-4 shrink-0 text-primary" />
                            <h4 className="text-foreground text-sm font-medium truncate">
                              {doc.title}
                            </h4>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            <span>
                              {new Date(doc.updated_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-muted-foreground">
                              {estimatedChunks} {estimatedChunks === 1 ? 'chunk' : 'chunks'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <CheckCircle2 className="size-3" /> Indexed
                          </span>

                          {canEdit && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => void openEdit(doc.id)}
                                title={t('editDoc')}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => void remove(doc.id)}
                                title={t('deleteDoc')}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Document Editor Form */}
            {editing !== null && (
              <div className="border-border bg-muted/20 space-y-4 rounded-xl border p-4 sm:p-5">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    {editing === 'new' ? 'New Knowledge Document' : 'Edit Document'}
                  </h4>
                  <Button variant="ghost" size="sm" onClick={cancelEdit} className="text-xs h-7">
                    Cancel
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kb-title" className="text-xs font-semibold">
                    {t('editDocTitle')}
                  </Label>
                  <Input
                    id="kb-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t('editDocTitlePlaceholder')}
                    disabled={saving}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kb-content" className="text-xs font-semibold">
                    {t('editDocContent')}
                  </Label>
                  <Textarea
                    id="kb-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('editDocContentPlaceholder')}
                    rows={8}
                    disabled={saving}
                    className="text-xs leading-relaxed font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Content will be automatically chunked and indexed into vector embeddings for the AI sales assistant.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    disabled={saving}
                    className="text-xs"
                  >
                    {t('cancel')}
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving} className="text-xs">
                    {saving && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                    {t('saveDoc')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
