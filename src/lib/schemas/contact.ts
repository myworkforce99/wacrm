import { z } from 'zod';

export const ContactInputSchema = z.object({
  name: z.string().trim().max(100).nullable().optional(),
  phone: z
    .string({ required_error: 'Phone number is required' })
    .trim()
    .min(7, 'Phone number must be at least 7 digits')
    .max(25, 'Phone number too long'),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .nullable()
    .optional()
    .or(z.literal('')),
  company: z.string().trim().max(100).nullable().optional(),
  source: z.string().default('Manual Entry'),
  other_source: z.string().trim().max(100).nullable().optional(),
  location_preference: z.string().trim().max(150).nullable().optional(),
  budget_min_input: z.string().trim().optional(),
  budget_max_input: z.string().trim().optional(),
  configuration_preference: z.array(z.string()).default([]),
  property_type: z.string().default('all'),
  intent: z.string().default('all'),
  possession_preference: z.string().default('any'),
  /**
   * UUID of the agent to assign, or null/undefined for unassigned.
   * NOTE: The contact form uses the sentinel string 'unassigned' in its
   * local state (for the dropdown), but converts it to null before
   * calling the API. Never pass 'unassigned' to the DB.
   */
  assigned_agent_id: z.string().uuid().nullable().optional(),
  stage_id: z.string().optional(),
  selected_tag_ids: z.array(z.string()).default([]),
  note_text: z.string().trim().optional(),
});

export const ContactPatchSchema = ContactInputSchema.partial();

export const ContactFormSchema = ContactInputSchema.extend({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name cannot exceed 100 characters'),
});

export type ContactInput = z.infer<typeof ContactInputSchema>;
export type ContactPatch = z.infer<typeof ContactPatchSchema>;
export type ContactFormInput = z.input<typeof ContactFormSchema>;
export type ContactFormValues = z.infer<typeof ContactFormSchema>;
