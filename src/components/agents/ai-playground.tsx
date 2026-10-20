'use client';

import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  Bot,
  RotateCcw,
  Send,
  Loader2,
  UserCircle2,
  ArrowRight,
  Sparkles,
  Info,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
  handoff?: boolean;
}

const REAL_ESTATE_QUICK_PROMPTS = [
  'Any 3BHK flats in Powai under ₹2.5 Cr?',
  'Tell me about Apex Grandeur specs & pricing',
  'Can I schedule a site visit this Saturday?',
  'What are the stamp duty and GST charges?',
];

const AVAILABLE_MODELS = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google Gemini',
  },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'Google Gemini' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
  },
];

/** Renders bold text (**text**), bullet lines (* / - / •), and INR amounts cleanly */
function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-1 text-sm leading-relaxed break-words">
      {lines.map((line, lIdx) => {
        const trimmed = line.trim();
        const isBullet =
          trimmed.startsWith('• ') ||
          trimmed.startsWith('* ') ||
          trimmed.startsWith('- ');
        const textContent = isBullet ? trimmed.replace(/^[•*-]\s+/, '') : line;

        // Parse **bold** and currency inside the line
        const parts = textContent.split(
          /(\*\*[^*]+\*\*|₹[\d,.]+(?:\s*(?:Cr|Lakh|k))?)/g
        );

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="text-foreground font-semibold">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith('₹')) {
            return (
              <span
                key={pIdx}
                className="font-semibold text-emerald-600 dark:text-emerald-400"
              >
                {part}
              </span>
            );
          }
          return <span key={pIdx}>{part}</span>;
        });

        if (isBullet) {
          return (
            <div key={lIdx} className="ml-2 flex items-start gap-1.5">
              <span className="text-primary mt-1 text-xs">•</span>
              <span className="flex-1">{renderedLine}</span>
            </div>
          );
        }

        return (
          <p key={lIdx} className={line === '' ? 'h-2' : ''}>
            {renderedLine}
          </p>
        );
      })}
    </div>
  );
}

export function AiPlayground({
  onGoToSetup,
  onGoToKnowledge,
}: {
  onGoToSetup?: () => void;
  onGoToKnowledge?: () => void;
}) {
  const t = useTranslations('Agents.playground');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] =
    useState<string>('gemini-2.5-flash');
  const [systemPrompt, setSystemPrompt] = useState<string>('');
  const [promptOpen, setPromptOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load active config to initialize default model and prompt preview
    (async () => {
      try {
        const res = await fetch('/api/ai/config');
        if (res.ok) {
          const data = await res.json();
          if (data.model) setSelectedModel(data.model);
          if (data.system_prompt) setSystemPrompt(data.system_prompt);
        }
      } catch {
        // Fallback to defaults
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [turns, sending]);

  const sendMessage = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || sending) return;

    const next: Turn[] = [...turns, { role: 'user', content: text }];
    setTurns(next);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content })),
          model: selectedModel,
          systemPrompt: systemPrompt || undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (data.code === 'ai_not_configured') {
          toast.error(t('notConfigured'));
        } else {
          toast.error(data.error ?? t('noReply'));
        }
        setTurns(turns);
        if (!textToSend) setInput(text);
        return;
      }

      setTurns([
        ...next,
        {
          role: 'assistant',
          content:
            typeof data.reply === 'string' && data.reply.trim()
              ? data.reply
              : '',
          handoff: Boolean(data.handoff),
        },
      ]);
    } catch {
      toast.error(t('unreachable'));
      setTurns(turns);
      if (!textToSend) setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="border-border bg-card flex h-[calc(100vh-230px)] min-h-[440px] flex-col rounded-xl border shadow-xs sm:h-[650px]">
      {/* Interactive Controls Header */}
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="text-primary size-5 shrink-0" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-foreground text-sm font-semibold tracking-tight">
                {t('title')}
              </span>
              <span className="border-primary/20 bg-primary/10 text-primary rounded-full border px-2 py-0.5 text-[10px] font-medium">
                Co-Pilot Simulation
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Model Selector Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground hidden text-xs sm:inline-block">
              {t('modelSelector')}:
            </span>
            <Select
              value={selectedModel}
              onValueChange={(val) => {
                if (val) setSelectedModel(val);
              }}
            >
              <SelectTrigger className="h-8 w-[160px] font-mono text-xs sm:w-[190px]">
                <SelectValue placeholder="Select Model" />
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_MODELS.map((m) => (
                  <SelectItem key={m.id} value={m.id} className="text-xs">
                    <span className="font-medium">{m.name}</span>{' '}
                    <span className="text-muted-foreground text-[10px]">
                      ({m.provider})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* System Prompt Preview Popover */}
          <Popover open={promptOpen} onOpenChange={setPromptOpen}>
            <PopoverTrigger
              className="border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 items-center justify-center rounded-lg border px-2.5 py-1 text-xs transition-colors"
              title="System Prompt Preview"
            >
              <Info className="size-3.5 sm:mr-1.5" />
              <span className="hidden sm:inline">Prompt</span>
            </PopoverTrigger>
            <PopoverContent
              className="border-border bg-popover w-80 space-y-2 p-4 text-xs sm:w-96"
              align="end"
            >
              <div className="border-border flex items-center justify-between border-b pb-1.5">
                <h4 className="text-foreground flex items-center gap-1.5 font-semibold">
                  <Sparkles className="text-primary size-3.5" />
                  Active System Prompt Preview
                </h4>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Appended to the foundational WhatsApp customer assistant
                instructions and real estate knowledge excerpts:
              </p>
              <div className="bg-muted border-border text-foreground max-h-48 overflow-y-auto rounded-md border p-2.5 font-mono text-[11px] whitespace-pre-wrap">
                {systemPrompt
                  ? systemPrompt
                  : 'Apex Horizon Realty real estate sales co-pilot: qualifying budget (₹ INR), preferred BHK, Powai/Mumbai locations, RERA inventory, and scheduling site visits.'}
              </div>
              {onGoToSetup && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setPromptOpen(false);
                    onGoToSetup();
                  }}
                  className="text-primary h-auto p-0 text-xs"
                >
                  Edit Prompt in Setup →
                </Button>
              )}
            </PopoverContent>
          </Popover>

          {/* Reset Transcript */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTurns([])}
            disabled={turns.length === 0 || sending}
            className="text-muted-foreground hover:text-foreground h-8 px-2 text-xs sm:px-3"
          >
            <RotateCcw className="size-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">{t('reset')}</span>
          </Button>
        </div>
      </div>

      {/* Transcript Chat Area */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {turns.length === 0 && (
          <div className="text-muted-foreground flex h-full flex-col items-center justify-center p-4 text-center">
            <div className="bg-primary/10 text-primary mb-3 rounded-full p-3">
              <Building2 className="size-8" />
            </div>
            <p className="text-foreground text-base font-semibold sm:text-lg">
              {t('emptyTitle')}
            </p>
            <p className="text-muted-foreground mt-1 max-w-md text-xs leading-relaxed sm:text-sm">
              {t('emptyDesc')}
            </p>

            {/* Quick Prompts Suggestions */}
            <div className="mt-6 w-full max-w-lg space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t('quickPrompts')}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {REAL_ESTATE_QUICK_PROMPTS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => void sendMessage(q)}
                    className="border-border bg-muted/60 hover:bg-muted hover:border-primary/40 text-foreground rounded-full border px-3 py-1.5 text-left text-xs transition-all"
                  >
                    💬 {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {onGoToKnowledge && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={onGoToKnowledge}
                  className="text-primary h-auto p-0 text-xs"
                >
                  Manage Knowledge Base <ArrowRight className="ml-1 size-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-2.5',
              turn.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {turn.role === 'assistant' && (
              <div className="bg-primary/10 text-primary mt-1 flex size-7 shrink-0 items-center justify-center rounded-full">
                <Bot className="size-4" />
              </div>
            )}

            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 shadow-2xs sm:max-w-[75%]',
                turn.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-xs'
                  : 'bg-muted/80 text-foreground border-border/60 rounded-bl-xs border'
              )}
            >
              {turn.content && <FormattedMessage content={turn.content} />}

              {turn.role === 'assistant' && turn.handoff && (
                <div className="mt-2.5 flex items-center gap-1.5 border-t border-amber-500/20 pt-2 text-xs font-medium text-amber-500">
                  <UserCircle2 className="size-3.5" />
                  <span>{t('handoff')}</span>
                </div>
              )}
            </div>

            {turn.role === 'user' && (
              <div className="bg-muted text-muted-foreground mt-1 flex size-7 shrink-0 items-center justify-center rounded-full">
                <UserCircle2 className="size-4" />
              </div>
            )}
          </div>
        ))}

        {sending && (
          <div className="text-muted-foreground flex items-center gap-2 pl-2 text-sm">
            <div className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
              <Bot className="size-4" />
            </div>
            <div className="bg-muted border-border flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
              <Loader2 className="text-primary size-3.5 animate-spin" />
              <span>{t('thinking')}</span>
            </div>
          </div>
        )}
      </div>

      {/* Composer Input Area */}
      <div className="border-border bg-card/60 flex items-end gap-2 border-t p-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('placeholder')}
          rows={1}
          className="border-border bg-muted/80 text-foreground placeholder-muted-foreground focus:border-primary/50 flex-1 resize-none rounded-xl border px-3.5 py-2.5 text-xs transition-colors outline-none sm:text-sm"
        />
        <Button
          size="sm"
          onClick={() => void sendMessage()}
          disabled={!input.trim() || sending}
          className="h-10 w-10 shrink-0 rounded-xl p-0"
          aria-label="Send message"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
