'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';

const DEFAULT_TEMPLATE = `🏠 *Property Details*
Title: {{property_title}}
Location: {{location}}
Price: {{price}}
Type: {{property_type}} | {{configuration}} | {{bedrooms}} BHK
RERA: {{rera_id}}
Builder: {{builder_name}}
Possession: {{possession_status}}
Area: {{carpet_area}} sq ft

💰 *Your Budget*
{{budget_min}} – {{budget_max}}

📞 *Your Agent*
{{agent_name}} – {{agent_phone}}

Reply to schedule a visit or ask any questions!`;

const SAMPLE_DATA: Record<string, string> = {
  property_title: 'Prestige Elm Park',
  location: 'Whitefield, Bangalore',
  price: '₹1.5Cr',
  property_type: 'Apartment',
  configuration: '3BHK',
  bedrooms: '3',
  rera_id: 'PRM/KA/RERA/1251/446/PR/210928/004316',
  builder_name: 'Prestige Group',
  possession_status: 'Under Construction',
  carpet_area: '1850',
  budget_min: '₹1.2Cr',
  budget_max: '₹1.8Cr',
  agent_name: 'Rahul Sharma',
  agent_phone: '+91 98765 43210',
};

export function CostSheetConfig() {
  const { accountRole } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const accountRes = await fetch('/api/account');
      const accountData = await accountRes.json();
      if (!accountRes.ok) {
        toast.error('Failed to load account');
        return;
      }

      const costSheetId = accountData.account.cost_sheet_template_id;
      setTemplateId(costSheetId);

      if (costSheetId) {
        const qrRes = await fetch('/api/quick-replies');
        const qrData = await qrRes.json();
        if (qrRes.ok && qrData.quick_replies) {
          const match = qrData.quick_replies.find(
            (qr: { id: string; content_text: string | null }) =>
              qr.id === costSheetId
          );
          if (match && match.content_text) {
            setContent(match.content_text);
          } else {
            setContent(DEFAULT_TEMPLATE);
          }
        } else {
          setContent(DEFAULT_TEMPLATE);
        }
      } else {
        setContent(DEFAULT_TEMPLATE);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load cost sheet config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let savedTemplateId = templateId;

      if (templateId) {
        const res = await fetch(`/api/quick-replies/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_text: content }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update quick reply');
        }
      } else {
        const res = await fetch('/api/quick-replies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'cost_sheet',
            title: 'Default Cost Sheet',
            content_text: content,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to create quick reply');
        }
        const data = await res.json();
        savedTemplateId = data.quick_reply.id;
        setTemplateId(savedTemplateId);
      }

      const accountRes = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost_sheet_template_id: savedTemplateId }),
      });

      if (!accountRes.ok) {
        const data = await accountRes.json();
        throw new Error(data.error || 'Failed to update account');
      }

      toast.success('Cost sheet template saved');
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to save template'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPreview = () => {
    return content.replace(
      /\{\{(\w+)\}\}/g,
      (_, key) => SAMPLE_DATA[key] ?? `${key}`
    );
  };

  if (!canEdit) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <SettingsPanelHead
        title="Cost Sheet"
        description="Configure the default template agents can send to leads with one tap."
      />

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp Template</CardTitle>
          <CardDescription>
            Use {'{{'}placeholders{'}}'} to automatically fill in details from
            the property and lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
          />

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save Template
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </div>

          {showPreview && (
            <div className="bg-muted mt-4 rounded-md p-4">
              <pre className="text-muted-foreground font-mono text-sm whitespace-pre-wrap">
                {renderPreview()}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
