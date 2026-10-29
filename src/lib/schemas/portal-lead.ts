import { z } from 'zod';

export const PortalSourceEnum = z.enum([
  '99acres',
  'MagicBricks',
  'Housing.com',
  'NoBroker',
  'MetaLeadAds',
  'Generic',
  'Manual',
]);

/**
 * Standard normalized lead representation accepted across all portal webhooks
 */
export const NormalizedPortalLeadSchema = z.object({
  name: z.string().trim().nullable().optional(),
  phone: z.string().trim().min(7, 'Phone number is required'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .nullable()
    .optional()
    .or(z.literal('')),
  source: z.string().default('Generic'),
  project_name: z.string().trim().nullable().optional(),
  property_type: z.string().trim().nullable().optional(),
  budget_min: z.number().nonnegative().nullable().optional(),
  budget_max: z.number().nonnegative().nullable().optional(),
  configuration: z.string().trim().nullable().optional(),
  location_preference: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
});

export type NormalizedPortalLead = z.infer<typeof NormalizedPortalLeadSchema>;

/**
 * 99acres Webhook Payload Schema
 */
export const NinetyNineAcresPayloadSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z.string().min(7, 'Phone number is required'),
  email: z.string().nullable().optional(),
  projName: z.string().nullable().optional(),
  query: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});

/**
 * MagicBricks Webhook Payload Schema
 */
export const MagicBricksPayloadSchema = z.object({
  name: z.string().nullable().optional(),
  mobile: z.string().min(7, 'Mobile number is required'),
  email: z.string().nullable().optional(),
  project: z.string().nullable().optional(),
  message: z.string().nullable().optional(),
  budget: z.union([z.string(), z.number()]).nullable().optional(),
  city: z.string().nullable().optional(),
});

/**
 * Housing.com Webhook Payload Schema
 */
export const HousingComPayloadSchema = z.object({
  lead_name: z.string().nullable().optional(),
  lead_phone: z.string().min(7, 'Lead phone is required'),
  lead_email: z.string().nullable().optional(),
  property_title: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

/**
 * NoBroker Webhook Payload Schema
 */
export const NoBrokerPayloadSchema = z.object({
  customer_name: z.string().nullable().optional(),
  contact_number: z.string().min(7, 'Contact number is required'),
  email_id: z.string().nullable().optional(),
  locality: z.string().nullable().optional(),
  property_type: z.string().nullable().optional(),
});

/**
 * Meta Lead Ads Webhook Payload Schema
 */
export const MetaLeadAdsPayloadSchema = z.object({
  leadgen_id: z.string().nullable().optional(),
  form_id: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  phone_number: z.string().min(7, 'Phone number is required'),
  email: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  bhk: z.string().nullable().optional(),
});

/**
 * Universal helper that safely normalizes raw portal payloads into NormalizedPortalLead
 */
export function normalizePortalPayload(
  source: string,
  raw: Record<string, unknown>
): NormalizedPortalLead {
  const normSource = source.toLowerCase();

  if (normSource.includes('99acres')) {
    const parsed = NinetyNineAcresPayloadSchema.parse(raw);
    return {
      name: parsed.name ?? null,
      phone: parsed.phone,
      email: parsed.email || null,
      source: '99acres',
      project_name: parsed.projName ?? null,
      location_preference: parsed.location ?? null,
      notes: parsed.query ?? null,
    };
  }

  if (normSource.includes('magicbricks')) {
    const parsed = MagicBricksPayloadSchema.parse(raw);
    return {
      name: parsed.name ?? null,
      phone: parsed.mobile,
      email: parsed.email || null,
      source: 'MagicBricks',
      project_name: parsed.project ?? null,
      location_preference: parsed.city ?? null,
      notes: parsed.message ?? null,
    };
  }

  if (normSource.includes('housing')) {
    const parsed = HousingComPayloadSchema.parse(raw);
    return {
      name: parsed.lead_name ?? null,
      phone: parsed.lead_phone,
      email: parsed.lead_email || null,
      source: 'Housing.com',
      project_name: parsed.property_title ?? null,
      location_preference: parsed.city ?? null,
      notes: parsed.notes ?? null,
    };
  }

  if (normSource.includes('nobroker')) {
    const parsed = NoBrokerPayloadSchema.parse(raw);
    return {
      name: parsed.customer_name ?? null,
      phone: parsed.contact_number,
      email: parsed.email_id || null,
      source: 'NoBroker',
      property_type: parsed.property_type ?? null,
      location_preference: parsed.locality ?? null,
    };
  }

  if (normSource.includes('meta')) {
    const parsed = MetaLeadAdsPayloadSchema.parse(raw);
    return {
      name: parsed.full_name ?? null,
      phone: parsed.phone_number,
      email: parsed.email || null,
      source: 'MetaLeadAds',
      configuration: parsed.bhk ?? null,
      notes: parsed.form_id ? `Form ID: ${parsed.form_id}` : null,
    };
  }

  // Fallback to generic normalized schema
  return NormalizedPortalLeadSchema.parse({
    ...raw,
    source: raw.source || source || 'Generic',
  });
}
