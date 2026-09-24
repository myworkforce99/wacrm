import type { SupabaseClient } from '@supabase/supabase-js';
import type { Property } from '@/types';

export const PROPERTY_SELECT = '*';

export class PropertyError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'PropertyError';
    this.status = status;
  }
}

export function serializeProperty(row: Record<string, unknown>): Property {
  return {
    id: row.id as string,
    account_id: row.account_id as string,
    title: row.title as string,
    location: (row.location as string | null) ?? undefined,
    price: (row.price as number | null) ?? undefined,
    property_type: (row.property_type as string | null) ?? undefined,
    bedrooms: (row.bedrooms as number | null) ?? undefined,
    tags: (row.tags as string[] | null) ?? undefined,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function getPropertyById(
  db: SupabaseClient,
  accountId: string,
  propertyId: string
): Promise<Property | null> {
  const { data, error } = await db
    .from('properties')
    .select(PROPERTY_SELECT)
    .eq('id', propertyId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (error || !data) return null;
  return serializeProperty(data as Record<string, unknown>);
}
