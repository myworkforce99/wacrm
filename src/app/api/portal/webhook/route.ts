import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/flows/admin-client';
import { findActiveKeyByHash } from '@/lib/api-keys/store';
import { hashApiKey, looksLikeApiKey } from '@/lib/api-keys/keys';
import { getCurrentAccount } from '@/lib/auth/account';
import {
  findOrCreateContact,
  setContactTags,
  resolveAuditUserId,
} from '@/lib/api/v1/contacts';
import { normalizePortalPayload } from '@/lib/schemas/portal-lead';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const token =
      url.searchParams.get('token') ||
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

    let accountId: string | null = null;

    if (token && looksLikeApiKey(token)) {
      const keyRow = await findActiveKeyByHash(hashApiKey(token));
      if (!keyRow || !keyRow.scopes.includes('contacts:write')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      accountId = keyRow.account_id;
    } else {
      // Allow authenticated CRM session for testing
      const sessionAccount = await getCurrentAccount().catch(() => null);
      if (sessionAccount?.accountId) {
        accountId = sessionAccount.accountId;
      }
    }

    if (!accountId) {
      return NextResponse.json(
        { error: 'Unauthorized: valid API key or session required' },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400 }
      );
    }

    const sourceParam =
      url.searchParams.get('source') ||
      (typeof body.source === 'string' ? body.source : 'Generic');

    let normalized;
    try {
      normalized = normalizePortalPayload(sourceParam, body);
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid portal lead payload', details: err },
        { status: 400 }
      );
    }

    const db = supabaseAdmin();
    const auditUserId = await resolveAuditUserId(db, accountId);

    // 1. Create or find contact with deduplication
    const { id: contactId, created } = await findOrCreateContact(
      db,
      accountId,
      auditUserId,
      {
        phone: normalized.phone,
        name: normalized.name || undefined,
        email: normalized.email || undefined,
      }
    );

    // 2. Persist lead details
    const leadDetailsUpdates: Record<string, unknown> = {
      account_id: accountId,
      contact_id: contactId,
      source: normalized.source,
    };
    if (normalized.budget_min !== undefined)
      leadDetailsUpdates.budget_min = normalized.budget_min;
    if (normalized.budget_max !== undefined)
      leadDetailsUpdates.budget_max = normalized.budget_max;
    if (normalized.location_preference)
      leadDetailsUpdates.location_preference = normalized.location_preference;
    if (normalized.property_type)
      leadDetailsUpdates.property_type = normalized.property_type;
    if (normalized.configuration) {
      leadDetailsUpdates.configuration_preference = [normalized.configuration];
    }

    await db
      .from('lead_details')
      .upsert(leadDetailsUpdates, { onConflict: 'contact_id' });

    // 3. Tag contact with the portal source
    if (normalized.source) {
      if (created) {
        await setContactTags(db, accountId, auditUserId, contactId, [
          normalized.source,
        ]);
      } else {
        const { data: currentTags } = await db
          .from('contact_tags')
          .select('tags(name)')
          .eq('contact_id', contactId);

        const existingTagNames = (currentTags || [])
          .map((t) => (t.tags as unknown as { name: string })?.name)
          .filter(Boolean);

        if (!existingTagNames.includes(normalized.source)) {
          await setContactTags(db, accountId, auditUserId, contactId, [
            ...existingTagNames,
            normalized.source,
          ]);
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        contact_id: contactId,
        created,
        source: normalized.source,
      },
      { status: created ? 201 : 200 }
    );
  } catch (err) {
    console.error('[api/portal/webhook] error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
