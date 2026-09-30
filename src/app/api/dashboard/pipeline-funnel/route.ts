import { NextResponse } from 'next/server';
import { requireRole, toErrorResponse } from '@/lib/auth/account';

export async function GET(request: Request) {
  try {
    const ctx = await requireRole('admin');

    // Query deals grouped by stage and join pipeline_stages
    const { data: deals, error: dErr } = await ctx.supabase
      .from('deals')
      .select('stage_id, pipeline_stages(name, position)')
      .eq('account_id', ctx.accountId)
      .eq('status', 'open'); // Assuming we only want the funnel for open deals

    if (dErr) {
      console.error('[GET /api/dashboard/pipeline-funnel] error:', dErr);
      return NextResponse.json(
        { error: 'Failed to fetch deals' },
        { status: 500 }
      );
    }

    const stageCounts = new Map<
      string,
      { name: string; position: number; count: number }
    >();

    for (const d of deals || []) {
      if (!d.pipeline_stages) continue;

      const stage = Array.isArray(d.pipeline_stages)
        ? d.pipeline_stages[0]
        : d.pipeline_stages;
      const key = d.stage_id;

      if (!stageCounts.has(key)) {
        stageCounts.set(key, {
          name: stage.name,
          position: stage.position,
          count: 0,
        });
      }
      const existing = stageCounts.get(key)!;
      existing.count += 1;
    }

    // Include empty stages as well by fetching all stages for this account's pipelines
    // For simplicity we just use the ones we found if that's enough,
    // but a real funnel should probably show 0s for empty stages.
    const { data: allStages, error: sErr } = await ctx.supabase
      .from('pipeline_stages')
      .select('id, name, position')
      .eq('account_id', ctx.accountId)
      .order('position', { ascending: true });

    if (sErr) throw sErr;

    const funnel = (allStages || []).map((s) => {
      const count = stageCounts.get(s.id)?.count || 0;
      return { stage: s.name, count };
    });

    return NextResponse.json({ funnel });
  } catch (err) {
    return toErrorResponse(err);
  }
}
