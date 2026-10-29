import { z } from 'zod';

export const AgentTargetInputSchema = z.object({
  agent_id: z
    .string({ required_error: 'agent_id is required' })
    .uuid('agent_id must be a valid UUID'),
  period_start: z
    .string({ required_error: 'period_start is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'period_start must be in YYYY-MM-DD format'),
  period_end: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'period_end must be in YYYY-MM-DD format')
    .optional(),
  target_visits: z.coerce
    .number({ invalid_type_error: 'target_visits must be a number' })
    .int('target_visits must be an integer')
    .nonnegative('target_visits cannot be negative')
    .default(0),
  target_bookings: z.coerce
    .number({ invalid_type_error: 'target_bookings must be a number' })
    .int('target_bookings must be an integer')
    .nonnegative('target_bookings cannot be negative')
    .default(0),
});

export const AgentTargetPatchSchema = AgentTargetInputSchema.partial();

export type AgentTargetInput = z.infer<typeof AgentTargetInputSchema>;
export type AgentTargetPatch = z.infer<typeof AgentTargetPatchSchema>;
