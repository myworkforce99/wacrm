import { z } from 'zod';

export const TaskInputSchema = z.object({
  title: z
    .string({ required_error: 'title is required' })
    .trim()
    .min(1, 'title is required')
    .max(300, 'Title cannot exceed 300 characters'),
  contact_id: z
    .string()
    .uuid('contact_id must be a valid UUID')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  site_visit_id: z
    .string()
    .uuid('site_visit_id must be a valid UUID')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  due_at: z
    .string()
    .datetime({
      offset: true,
      message: 'due_at must be an ISO datetime string',
    })
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  assigned_to: z
    .string()
    .uuid('assigned_to must be a valid UUID')
    .nullable()
    .optional()
    .or(z.literal('').transform(() => null)),
  done: z.boolean().default(false),
});

export const TaskPatchSchema = TaskInputSchema.partial();

export type TaskInput = z.infer<typeof TaskInputSchema>;
export type TaskPatch = z.infer<typeof TaskPatchSchema>;
