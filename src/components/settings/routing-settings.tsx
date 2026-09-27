'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Route, Trash2, Edit2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RequireRole } from '@/components/auth/require-role';
import { useAuth } from '@/hooks/use-auth';
import { SettingsPanelHead } from './settings-panel-head';
import type { LeadRoutingRule } from '@/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function RoutingSettings() {
  const { canEditSettings } = useAuth();

  const [rules, setRules] = useState<LeadRoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/account/routing-rules', {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load rules');
      const data = await res.json();
      setRules(data.routing_rules || []);
    } catch (err) {
      toast.error('Network Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(rule: LeadRoutingRule) {
    setDeleting(rule.id);
    try {
      const res = await fetch(`/api/account/routing-rules/${rule.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete rule');
      toast.success('Rule deleted');
      setRules((prev) => prev.filter((r) => r.id !== rule.id));
    } catch (err) {
      toast.error('Failed to delete rule');
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="text-primary size-6 animate-spin" />
      </div>
    );
  }

  function getConditionText(r: LeadRoutingRule) {
    switch (r.condition_type) {
      case 'source':
        return `Source is '${r.condition_value}'`;
      case 'budget_gte':
        return `Budget >= ${r.condition_value}`;
      case 'budget_lte':
        return `Budget <= ${r.condition_value}`;
      case 'location_contains':
        return `Location contains '${r.condition_value}'`;
      case 'configuration':
        return `Configuration is '${r.condition_value}'`;
      default:
        return `${r.condition_type} = ${r.condition_value}`;
    }
  }

  function getActionText(r: LeadRoutingRule) {
    switch (r.action_type) {
      case 'assign_to_agent':
        return `Assign to Agent: ${r.action_value}`;
      case 'assign_to_role':
        return `Assign to Role: ${r.action_value}`;
      default:
        return `${r.action_type}: ${r.action_value}`;
    }
  }

  return (
    <section className="animate-in fade-in-50 space-y-6 duration-200">
      <SettingsPanelHead
        title="Lead Routing Rules"
        description="Automatically route new incoming leads based on their source, location, and budget."
        action={
          <RequireRole min="admin">
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add Rule
            </Button>
          </RequireRole>
        }
      />

      {rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <Route className="text-muted-foreground size-6" />
            <p className="text-muted-foreground mt-2 text-sm">
              No routing rules
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              Create a rule to automate lead assignment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-border divide-y">
              {rules
                .sort((a, b) => b.priority - a.priority)
                .map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground truncate text-sm font-medium">
                          {getConditionText(r)}
                        </span>
                        {!r.is_active && (
                          <Badge className="border-border bg-muted text-muted-foreground text-[10px] tracking-wide uppercase">
                            Inactive
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          Priority {r.priority}
                        </Badge>
                      </div>
                      <p className="text-primary mt-1 text-xs font-medium">
                        {getActionText(r)}
                      </p>
                    </div>

                    <RequireRole min="admin">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(r)}
                        disabled={deleting === r.id}
                        className="self-start border-red-500/40 bg-red-500/10 text-red-300 hover:border-red-500/60 hover:bg-red-500/20 hover:text-red-200 sm:self-auto"
                      >
                        {deleting === r.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                        Delete
                      </Button>
                    </RequireRole>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <CreateRuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={load}
      />
    </section>
  );
}

function CreateRuleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [priority, setPriority] = useState('0');
  const [conditionType, setConditionType] = useState('source');
  const [conditionValue, setConditionValue] = useState('');
  const [actionType, setActionType] = useState('assign_to_agent');
  const [actionValue, setActionValue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setPriority('0');
    setConditionType('source');
    setConditionValue('');
    setActionType('assign_to_agent');
    setActionValue('');
    setSubmitting(false);
  }

  async function handleCreate() {
    if (!conditionValue.trim())
      return toast.error('Condition value is required');
    if (!actionValue.trim()) return toast.error('Action value is required');

    setSubmitting(true);
    try {
      const res = await fetch('/api/account/routing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priority: parseInt(priority, 10),
          condition_type: conditionType,
          condition_value: conditionValue.trim(),
          action_type: actionType,
          action_value: actionValue.trim(),
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to create rule');
      toast.success('Rule created');
      onCreated();
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create rule');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="border-border bg-popover max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Routing Rule</DialogTitle>
          <DialogDescription>
            Create a new rule to route leads.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Priority (Higher runs first)</Label>
            <Input
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Condition Type</Label>
            <Select
              value={conditionType}
              onValueChange={(v) => setConditionType(v || 'source')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="source">
                  Source (e.g. 99acres, meta)
                </SelectItem>
                <SelectItem value="budget_gte">
                  Budget &gt;= (e.g. 5000000)
                </SelectItem>
                <SelectItem value="budget_lte">
                  Budget &lt;= (e.g. 20000000)
                </SelectItem>
                <SelectItem value="location_contains">
                  Location Contains (e.g. Mumbai)
                </SelectItem>
                <SelectItem value="configuration">
                  Configuration (e.g. 3BHK)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Condition Value</Label>
            <Input
              value={conditionValue}
              onChange={(e) => setConditionValue(e.target.value)}
              placeholder="Value..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Action Type</Label>
            <Select
              value={actionType}
              onValueChange={(v) => setActionType(v || 'assign_to_agent')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assign_to_agent">Assign to Agent</SelectItem>
                <SelectItem value="assign_to_role">
                  Assign to Role (Round Robin)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Action Value</Label>
            <Input
              value={actionValue}
              onChange={(e) => setActionValue(e.target.value)}
              placeholder={
                actionType === 'assign_to_agent'
                  ? 'Agent UUID'
                  : 'Role name (e.g. agent)'
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={submitting}>
            {submitting ? 'Creating...' : 'Create Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
