'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { canEditSettings } from '@/lib/auth/roles';
import { Button } from '@/components/ui/button';
// import { Input } from '@/components/ui/input';
// import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { SettingsPanelHead } from './settings-panel-head';
// import { cn } from '@/lib/utils';

const DEFAULT_TEMPLATE = `🏠 *Property Details*
Title: {{property_title}}
Location: {{location}}
Price: {{price}}
Type: {{property_type}} | {{configuration}}
RERA: {{rera_id}}
Builder: {{builder_name}}
Possession: {{possession_status}}
Area: {{carpet_area}} sq ft

💰 *Your Budget*
{{budget_min}} – {{budget_max}}

📞 *Your Agent*
{{agent_name}} – {{agent_phone}}

Reply to schedule a visit or ask any questions!`;

/* ============================================================
 * [ADVANCE COST SHEET TEMPLATE - Disabled for now, to be re-enabled in future development]
 *
 * const DEFAULT_ADVANCE_TEMPLATE = `🏠 *Property Details*
 * Title: {{property_title}}
 * Location: {{location}}
 * Base Rate: {{base_rate}}
 * Type: {{property_type}} | {{configuration}}
 * RERA: {{rera_id}}
 * Builder: {{builder_name}}
 * Possession: {{possession_status}}
 * Area: {{carpet_area}} sq ft
 * 
 * 📊 *Itemized Cost Breakdown (Indian Standard)*
 * • Agreement Value: {{price}}
 * • Covered Parking: {{parking}}
 * • Statutory GST: {{gst}}
 * • Stamp Duty: {{stamp_duty}}
 * • Registration Fee: {{registration}}
 * --------------------------------
 * *All-Inclusive Total Estimate:* {{total_cost}}
 * 
 * 💰 *Your Budget*
 * {{budget_min}} – {{budget_max}}
 * 
 * 📞 *Your Agent*
 * {{agent_name}} – {{agent_phone}}
 * 
 * Reply to schedule a visit or ask any questions!`;
 * ============================================================ */

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
  /* Advance Cost Sheet Sample Fields (Disabled for now):
   * base_rate: '₹8,500 / sq ft',
   * parking: '₹4,00,000',
   * gst: '₹7,50,000',
   * stamp_duty: '₹9,00,000',
   * registration: '₹30,000',
   * total_cost: '₹1.70 Cr',
   */
};

export function CostSheetConfig() {
  const { accountRole } = useAuth();
  const canEdit = accountRole ? canEditSettings(accountRole) : false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  /* ============================================================
   * [ADVANCE COST SHEET STATE - Disabled for now]
   * const [costSheetMode, setCostSheetMode] = useState<'standard' | 'advance'>('standard');
   * const [baseRate, setBaseRate] = useState<number | string>(8500);
   * const [floorRise, setFloorRise] = useState<number | string>(50);
   * const [floorRiseFrom, setFloorRiseFrom] = useState<number | string>(5);
   * const [parking, setParking] = useState<number | string>(400000);
   * const [gstPercent, setGstPercent] = useState<number | string>(5);
   * const [stampDutyPercent, setStampDutyPercent] = useState<number | string>(6);
   * const [registrationFee, setRegistrationFee] = useState<number | string>(30000);
   * ============================================================ */

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    try {
      const accountRes = await fetch('/api/account');
      const accountData = await accountRes.json();
      if (!accountRes.ok) {
        toast.error('Failed to load account');
        return;
      }

      const costSheetId = accountData.account?.cost_sheet_template_id;
      setTemplateId(costSheetId);

      /* Advance settings loading (Disabled for now):
      const mode = accountData.account?.settings?.cost_sheet_mode;
      const rates = accountData.account?.settings?.cost_sheet_rates;
      */

      if (costSheetId) {
        const qrRes = await fetch('/api/quick-replies');
        const qrData = await qrRes.json();
        if (qrRes.ok && qrData.quick_replies) {
          const match = qrData.quick_replies.find(
            (qr: { id: string; content_text: string | null }) =>
              qr.id === costSheetId
          );
          if (match && match.content_text) {
            let loaded = match.content_text;
            if (
              loaded.includes('Itemized Cost Breakdown') ||
              loaded.includes('{{base_rate}}')
            ) {
              loaded = loaded
                .replace(
                  /📊?\s*\*?Itemized Cost Breakdown[\s\S]*?(?=(\n\s*\n\s*[💰📞]|$))/i,
                  ''
                )
                .trim();
              if (loaded.includes('Base Rate: {{base_rate}}')) {
                loaded = loaded.replace(
                  'Base Rate: {{base_rate}}',
                  'Price: {{price}}'
                );
              }
            }
            setContent(loaded || DEFAULT_TEMPLATE);
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
        body: JSON.stringify({
          cost_sheet_template_id: savedTemplateId,
          /* ADVANCE COST SHEET SETTINGS (Disabled for now, to be re-enabled in future development):
          settings: {
            cost_sheet_mode: costSheetMode,
            cost_sheet_rates: {
              base_rate: Number(baseRate),
              floor_rise: Number(floorRise),
              floor_rise_from: Number(floorRiseFrom),
              parking: Number(parking),
              gst_percent: Number(gstPercent),
              stamp_duty_percent: Number(stampDutyPercent),
              registration_fee: Number(registrationFee),
            },
          },
          */
        }),
      });

      if (!accountRes.ok) {
        const data = await accountRes.json();
        throw new Error(data.error || 'Failed to update account');
      }

      toast.success('Cost sheet template saved');
    } catch (err: unknown) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : 'Failed to save settings'
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
        description="Configure the default WhatsApp cost sheet template."
      />

      {/* ============================================================
       * [ADVANCE COST SHEET UI - Disabled for now, to be re-enabled in future development]
       *
       * <Card>
       *   <CardHeader>
       *     <CardTitle>Cost Sheet Mode</CardTitle>
       *     <CardDescription>
       *       Choose between the default standard cost sheet (single-value price) and the advance cost sheet (Indian standard itemized breakdown with GST, Stamp Duty & Parking).
       *     </CardDescription>
       *   </CardHeader>
       *   <CardContent>
       *     ...
       *   </CardContent>
       * </Card>
       *
       * <Card>
       *   <CardHeader>
       *     <CardTitle>Default Rates & Statutory Taxes (Indian Standard)</CardTitle>
       *     <CardDescription>
       *       Account-wide baseline rates used to calculate buyer cost sheets and dynamic estimates.
       *     </CardDescription>
       *   </CardHeader>
       *   <CardContent>
       *     ...
       *   </CardContent>
       * </Card>
       * ============================================================ */}

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
            <Button
              variant="ghost"
              onClick={() => {
                setContent(DEFAULT_TEMPLATE);
                toast.info('Template reset to default. Click "Save Template" to persist.');
              }}
            >
              Reset to Default
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

