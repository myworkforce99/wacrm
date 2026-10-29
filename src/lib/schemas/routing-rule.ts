import { z } from 'zod';

export const RoutingConditionTypeEnum = z.enum([
  'source',
  'budget_gte',
  'budget_lte',
  'location_contains',
  'configuration',
]);

export const RoutingActionTypeEnum = z.enum([
  'assign_to_agent',
  'assign_to_role',
]);

export const LeadRoutingRuleInputSchema = z.object({
  priority: z.coerce.number().int().default(0),
  condition_type: RoutingConditionTypeEnum,
  condition_value: z
    .string({ required_error: 'condition_value is required' })
    .trim()
    .min(1, 'condition_value is required'),
  action_type: RoutingActionTypeEnum,
  action_value: z
    .string({ required_error: 'action_value is required' })
    .trim()
    .min(1, 'action_value is required'),
  is_active: z.boolean().default(true),
});

export const LeadRoutingRulePatchSchema = LeadRoutingRuleInputSchema.partial();

export type RoutingConditionType = z.infer<typeof RoutingConditionTypeEnum>;
export type RoutingActionType = z.infer<typeof RoutingActionTypeEnum>;
export type LeadRoutingRuleInput = z.infer<typeof LeadRoutingRuleInputSchema>;
export type LeadRoutingRulePatch = z.infer<typeof LeadRoutingRulePatchSchema>;
