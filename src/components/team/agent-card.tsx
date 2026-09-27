'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { toast } from 'sonner';
import type { AgentPerformance } from '@/lib/dashboard/types';

export function AgentCard({ 
  agent, 
  onUpdate 
}: { 
  agent: AgentPerformance; 
  onUpdate: () => void 
}) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetValue, setTargetValue] = useState(agent.targetVisits || 0);
  const [saving, setSaving] = useState(false);

  const toggleAvailability = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/account/members/${agent.agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_available: !agent.isAvailable })
      });
      if (res.ok) {
        toast.success(`Availability updated for ${agent.name}`);
        onUpdate();
      } else {
        toast.error('Failed to update availability');
      }
    } catch {
      toast.error('Error updating availability');
    }
  };

  const saveTarget = async () => {
    setSaving(true);
    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const res = await fetch(`/api/account/targets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agent_id: agent.agentId, 
          period_start: firstDayOfMonth,
          target_visits: targetValue 
        })
      });
      if (res.ok) {
        toast.success('Target updated');
        setEditingTarget(false);
        onUpdate();
      } else {
        toast.error('Failed to update target');
      }
    } catch {
      toast.error('Error updating target');
    } finally {
      setSaving(false);
    }
  };

  // 20 leads = 100% capacity
  const maxLeads = 20; 
  const leadsPct = Math.min(100, (agent.openLeadsCount / maxLeads) * 100);
  
  let leadsColorClass = "bg-green-500";
  if (agent.openLeadsCount >= 10 && agent.openLeadsCount <= 18) leadsColorClass = "bg-amber-500";
  if (agent.openLeadsCount > 18) leadsColorClass = "bg-red-500";

  return (
    <Card className="flex flex-col overflow-hidden">
      <Link href={`/contacts?assigned_to=${agent.agentId}`} className="block hover:bg-muted/30 transition-colors">
        <CardHeader className="flex flex-row items-center gap-3 pb-2 cursor-pointer">
          <Avatar className="size-10">
            <AvatarImage src={agent.avatarUrl ?? undefined} />
            <AvatarFallback>{agent.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base truncate">{agent.name}</CardTitle>
              <button 
                onClick={toggleAvailability}
                className={`w-2.5 h-2.5 rounded-full shrink-0 flex items-center justify-center ${agent.isAvailable ? 'bg-green-500' : 'bg-gray-400'}`}
                title={agent.isAvailable ? "Available" : "On Leave"}
              />
            </div>
            <p className="text-muted-foreground text-xs tracking-wider uppercase">
              {agent.role} {!agent.isAvailable && '• On Leave'}
            </p>
          </div>
          {agent.staleLeadCount > 0 && (
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-200 shrink-0">
              ⚠️ {agent.staleLeadCount} stale
            </Badge>
          )}
        </CardHeader>
      </Link>
      
      <CardContent className="flex-1 pt-4">
        {/* Load Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1 font-medium text-muted-foreground">
            <span>{agent.openLeadsCount} open leads</span>
            <span>Capacity</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${leadsColorClass} transition-all`} style={{ width: `${leadsPct}%` }} />
          </div>
        </div>

        {/* Target Progress */}
        {agent.targetVisits !== null && (
          <div className="mb-6">
            <div className="flex justify-between text-xs mb-1 font-medium text-muted-foreground">
              <span>Visits This Month</span>
              {editingTarget ? (
                <div className="flex items-center gap-1">
                  <input 
                    type="number" 
                    value={targetValue} 
                    onChange={e => setTargetValue(parseInt(e.target.value) || 0)} 
                    className="w-12 px-1 py-0 border rounded text-xs"
                    autoFocus
                  />
                  <button onClick={saveTarget} disabled={saving} className="text-primary hover:underline">Save</button>
                  <button onClick={() => setEditingTarget(false)} className="text-muted-foreground hover:underline">Cancel</button>
                </div>
              ) : (
                <button onClick={() => setEditingTarget(true)} className="hover:underline">
                  {agent.actualVisitsThisMonth} / {agent.targetVisits}
                </button>
              )}
            </div>
            <Progress value={agent.targetVisits > 0 ? Math.min(100, (agent.actualVisitsThisMonth / agent.targetVisits) * 100) : 0} className="h-1.5" />
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 pt-2 border-t">
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Avg Response</dt>
            <dd className="text-foreground mt-1 text-lg font-semibold">
              {agent.avgResponseTimeMin !== null ? `${Math.round(agent.avgResponseTimeMin)}m` : '--'}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Leads Worked</dt>
            <dd className="text-foreground mt-1 text-lg font-semibold">{agent.leadsWorked}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Visits/No-Show</dt>
            <dd className="text-foreground mt-1 text-lg font-semibold">
              {agent.visitsCompleted} <span className="text-muted-foreground text-sm font-normal">({agent.noShowRate !== null ? Math.round(agent.noShowRate) : 0}%)</span>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium">Conversion</dt>
            <dd className="text-foreground mt-1 text-lg font-semibold">
              {agent.conversionRate !== null ? `${Math.round(agent.conversionRate)}%` : '--'}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
