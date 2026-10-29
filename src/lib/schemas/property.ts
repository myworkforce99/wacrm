import { z } from 'zod';

export const PropertyTypeEnum = z.enum([
  'Apartment',
  'Villa',
  'Plot',
  'Commercial',
  'Penthouse',
  'Builder Floor',
]);

export const PossessionStatusEnum = z.enum([
  'ready_to_move',
  'under_construction',
  'nearing_possession',
]);

/**
 * Canonical compass-facing directions for property listings.
 * Matches the UI options in property-form-modal.tsx.
 * DB column `properties.facing` is plain TEXT — no DB-level CHECK constraint.
 */
export const FacingDirectionEnum = z.enum([
  'East',
  'North',
  'North-East',
  'West',
  'South',
  'North-West',
  'South-East',
  'South-West',
]);

export type FacingDirection = z.infer<typeof FacingDirectionEnum>;

export const FACING_DIRECTIONS = FacingDirectionEnum.options;

export const PropertyInputSchema = z.object({
  title: z
    .string({
      required_error: "'title' is required",
      invalid_type_error: "'title' must be a string",
    })
    .trim()
    .min(1, "'title' is required")
    .max(200, 'Title cannot exceed 200 characters'),
  location: z.string().trim().nullable().optional(),
  price: z
    .number({ invalid_type_error: 'Price must be a number' })
    .nonnegative('Price cannot be negative')
    .nullable()
    .optional(),
  property_type: PropertyTypeEnum.nullable().optional(),
  bedrooms: z
    .number({ invalid_type_error: 'Bedrooms must be a number' })
    .int('Bedrooms must be an integer')
    .min(0, 'Bedrooms cannot be negative')
    .max(20, 'Bedrooms cannot exceed 20')
    .nullable()
    .optional(),
  tags: z.array(z.string()).nullable().optional(),
  configuration: z.string().nullable().optional(),
  builder_name: z.string().nullable().optional(),
  project_name: z.string().nullable().optional(),
  rera_id: z.string().nullable().optional(),
  possession_status: PossessionStatusEnum.nullable().optional(),
  /**
   * Date-only ISO string (YYYY-MM-DD). DB column type is DATE, not TIMESTAMPTZ.
   */
  possession_date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'possession_date must be a date string in YYYY-MM-DD format'
    )
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  carpet_area: z
    .number({ invalid_type_error: 'Carpet area must be a number' })
    .positive('Carpet area must be positive')
    .nullable()
    .optional(),
  facing: FacingDirectionEnum.nullable().optional(),
});

export const PropertyPatchSchema = PropertyInputSchema.partial();

export type PropertyType = z.infer<typeof PropertyTypeEnum>;
export type PossessionStatus = z.infer<typeof PossessionStatusEnum>;
export type PropertyInput = z.infer<typeof PropertyInputSchema>;
export type PropertyPatch = z.infer<typeof PropertyPatchSchema>;

export const PropertyFormSchema = z.object({
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(1, 'Title is required')
    .max(200, 'Title cannot exceed 200 characters'),
  project_name: z.string().trim().optional(),
  builder_name: z.string().trim().optional(),
  location: z.string().trim().optional(),
  property_type: PropertyTypeEnum.optional(),
  configuration: z.string().optional(),
  bedrooms: z.string().optional(),
  carpet_area: z.string().trim().optional(),
  facing: FacingDirectionEnum.optional(),
  price_input: z.string().trim().optional(),
  rera_id: z.string().trim().optional(),
  possession_status: PossessionStatusEnum.optional(),
  possession_date: z.string().optional(),
});

export type PropertyFormValues = z.infer<typeof PropertyFormSchema>;
