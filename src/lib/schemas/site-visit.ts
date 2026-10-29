import { z } from 'zod';

export const SiteVisitStatusEnum = z.enum(
  ['pending', 'confirmed', 'completed', 'no_show', 'rescheduled'],
  {
    errorMap: () => ({ message: 'Invalid status' }),
  }
);

export const SiteVisitInputSchema = z.object({
  contact_id: z
    .string()
    .uuid({ message: 'contact_id must be a valid UUID' })
    .nullable()
    .optional(),
  property_id: z
    .string()
    .uuid({ message: 'property_id must be a valid UUID' })
    .nullable()
    .optional(),
  /**
   * ISO-8601 datetime with offset. Required when creating a visit, but
   * nullable in the DB (TIMESTAMPTZ without NOT NULL) — null on legacy rows.
   * SiteVisitPatchSchema inherits this as optional via .partial().
   */
  scheduled_at: z
    .string()
    .datetime({ offset: true, message: 'Must be a valid ISO datetime' })
    .nullable()
    .optional(),
  status: SiteVisitStatusEnum.default('pending'),
  notes: z.string().nullable().optional(),
  pickup_required: z.boolean().default(false),
  pickup_location: z.string().nullable().optional(),
});

export const SiteVisitPatchSchema = SiteVisitInputSchema.partial();

export type SiteVisitStatusType = z.infer<typeof SiteVisitStatusEnum>;
export type SiteVisitInput = z.infer<typeof SiteVisitInputSchema>;
export type SiteVisitPatch = z.infer<typeof SiteVisitPatchSchema>;
