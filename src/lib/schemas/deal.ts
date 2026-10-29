import { z } from 'zod';

export const DealStatusEnum = z.enum(['open', 'won', 'lost']);

/**
 * Base fields shared between create and patch API requests.
 * Note: `value` uses z.coerce.number() — the DB column is NUMERIC,
 * so string representations are rejected early with a typed error.
 */
const DealBaseSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title cannot exceed 200 characters'),
  value: z.coerce
    .number({ invalid_type_error: 'Value must be a number' })
    .nonnegative('Value cannot be negative')
    .optional(),
  currency: z.string().default('INR'),
  stage_id: z.string().min(1, 'Stage is required'),
  contact_id: z.string().min(1, 'Contact is required'),
  pipeline_id: z.string().optional(),
  assigned_to: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  /**
   * Date-only ISO string (YYYY-MM-DD). DB column type is DATE, not TIMESTAMPTZ.
   */
  expected_close_date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'expected_close_date must be a date string in YYYY-MM-DD format'
    )
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  // Lifecycle fields (migration 129)
  status: DealStatusEnum.optional(),
  lost_reason_id: z
    .string()
    .uuid('lost_reason_id must be a valid UUID')
    .nullable()
    .optional(),
  lost_note: z.string().max(2000).nullable().optional(),
  /**
   * Date-only ISO string (YYYY-MM-DD). DB column type is DATE, not TIMESTAMPTZ.
   * Do NOT pass a full datetime-local string — Postgres will reject it.
   */
  re_engage_on: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      're_engage_on must be a date string in YYYY-MM-DD format'
    )
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  won_value: z.coerce
    .number({ invalid_type_error: 'Won value must be a number' })
    .nonnegative()
    .nullable()
    .optional(),
});

/**
 * API create/update schema. Validates that lost_reason_id is provided
 * when status is 'lost'.
 */
export const DealInputSchema = DealBaseSchema.superRefine((data, ctx) => {
  if (data.status === 'lost' && !data.lost_reason_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'lost_reason_id is required when marking a deal as lost',
      path: ['lost_reason_id'],
    });
  }
});

export const DealPatchSchema = DealBaseSchema.partial().superRefine(
  (data, ctx) => {
    if (data.status === 'lost' && !data.lost_reason_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'lost_reason_id is required when marking a deal as lost',
        path: ['lost_reason_id'],
      });
    }
  }
);

/**
 * Form schema — keeps string union for value since the form uses a
 * formatted currency string input (e.g. "1,50,000"). The form submit
 * handler is responsible for parsing before sending to the API.
 */
export const DealFormSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title cannot exceed 200 characters'),
  value: z.union([z.string(), z.number()]).optional(),
  currency: z.string(),
  stage_id: z.string().min(1, 'Stage is required'),
  contact_id: z.string().min(1, 'Contact is required'),
  assigned_to: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  expected_close_date: z.string().nullable().optional(),
});

export type DealStatus = z.infer<typeof DealStatusEnum>;
export type DealInput = z.infer<typeof DealInputSchema>;
export type DealPatch = z.infer<typeof DealPatchSchema>;
export type DealFormValues = z.infer<typeof DealFormSchema>;
