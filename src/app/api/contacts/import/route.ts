import { NextResponse } from 'next/server';
import { getCurrentAccount } from '@/lib/auth/account';
import { createClient } from '@/lib/supabase/server';
import { hasMinRole } from '@/lib/auth/roles';
import { toApiErrorResponse } from '@/lib/api/v1/respond';
import { normalizeKey } from '@/lib/contacts/dedupe';

export async function POST(request: Request) {
  try {
    const account = await getCurrentAccount();
    if (!account)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!hasMinRole(account.role, 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const supabase = await createClient();

    let created = 0;
    let skipped = 0;
    let errors = 0;

    // Deduplicate within the payload
    const uniqueRows = new Map();
    for (const row of body) {
      if (!row.phone) {
        skipped++;
        continue;
      }
      const norm = normalizeKey(row.phone);
      if (!norm) {
        skipped++;
        continue;
      }
      if (!uniqueRows.has(norm)) {
        uniqueRows.set(norm, row);
      } else {
        skipped++;
      }
    }

    const rowsToProcess = Array.from(uniqueRows.values());
    if (rowsToProcess.length === 0) {
      return NextResponse.json({ success: true, created, skipped, errors });
    }

    const contactsPayload = rowsToProcess.map(row => ({
      account_id: account.accountId,
      user_id: account.userId,
      name: row.name || null,
      phone: row.phone,
      phone_normalized: normalizeKey(row.phone),
      email: row.email || null
    }));

    const { data: insertedContacts, error: contactError } = await supabase
      .from('contacts')
      .upsert(contactsPayload, { onConflict: 'account_id,phone_normalized', ignoreDuplicates: true })
      .select('id, phone_normalized');

    if (contactError) {
      console.error('Batch insert error:', contactError);
      return NextResponse.json({ error: 'Failed to insert contacts' }, { status: 500 });
    }

    created = insertedContacts ? insertedContacts.length : 0;
    skipped += (rowsToProcess.length - created);

    if (created > 0 && insertedContacts) {
      const insertedMap = new Map(insertedContacts.map((c: { phone_normalized: string; id: string }) => [c.phone_normalized, c.id]));
      
      const ldPayload = [];
      const notesPayload = [];

      for (const row of rowsToProcess) {
        const norm = normalizeKey(row.phone);
        const contactId = insertedMap.get(norm);
        if (!contactId) continue;

        if (row.source || row.budget_min || row.budget_max || row.location || row.bhk_config || row.stage) {
          ldPayload.push({
            account_id: account.accountId,
            contact_id: contactId,
            budget_min: row.budget_min || null,
            budget_max: row.budget_max || null,
            location_preference: row.location || null,
            property_type: row.bhk_config || null,
            intent: row.stage || null,
            source: row.source || null,
          });
        }

        if (row.notes) {
          notesPayload.push({
            contact_id: contactId,
            user_id: account.userId,
            content: row.notes,
          });
        }
      }

      if (ldPayload.length > 0) {
        const { error: ldError } = await supabase
          .from('lead_details')
          .upsert(ldPayload, { onConflict: 'contact_id' });
          
        if (ldError) {
          console.error('Lead details insert error:', ldError);
          errors += ldPayload.length;
        }
      }

      if (notesPayload.length > 0) {
        const { error: notesError } = await supabase
          .from('contact_notes')
          .insert(notesPayload);
          
        if (notesError) {
          console.error('Contact notes insert error:', notesError);
          errors += notesPayload.length;
        }
      }
    }

    return NextResponse.json({ success: true, created, skipped, errors });
  } catch (error) {
    return toApiErrorResponse(error);
  }
}
