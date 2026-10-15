import { z } from 'zod';

export const createProjectTemplateSchema = z.object({
  name: z.string().trim().min(2, 'Template name is required').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  tasks: z.array(z.object({
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional().nullable(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
    estimated_minutes: z.coerce.number().int().min(0).optional().nullable(),
    due_offset_days: z.coerce.number().int().min(0).max(365).optional().nullable(),
    sort_order: z.number().default(0),
    subtasks: z.array(z.string().trim().min(1).max(200)).optional()
  })).optional()
});

export const saveProjectAsTemplateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional().nullable()
});

export const createProjectFromTemplateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  team_id: z.coerce.number().int().positive().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4F46E5'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').default(() => new Date().toISOString().split('T')[0]),
  member_ids: z.array(z.coerce.number().int().positive()).optional()
});
