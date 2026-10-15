import { z } from 'zod';

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const createProjectSchema = z.object({
  name: z.string().trim().min(2, 'Project name must be at least 2 characters').max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  team_id: z.coerce.number().int().positive().optional().nullable(),
  color: z.string().regex(hexColorRegex, 'Color must be a valid 6-character hex code (e.g. #4F46E5)').default('#4F46E5'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional().nullable(),
  member_ids: z.array(z.coerce.number().int().positive()).optional()
}).refine(data => {
  if (data.start_date && data.due_date) {
    return data.due_date >= data.start_date;
  }
  return true;
}, {
  message: 'Due date cannot be earlier than start date',
  path: ['due_date']
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  team_id: z.coerce.number().int().positive().optional().nullable(),
  color: z.string().regex(hexColorRegex).optional(),
  status: z.enum(['active', 'on_hold', 'completed', 'archived']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
}).refine(data => {
  if (data.start_date && data.due_date) {
    return data.due_date >= data.start_date;
  }
  return true;
}, {
  message: 'Due date cannot be earlier than start date',
  path: ['due_date']
});

export const addProjectMemberSchema = z.object({
  user_id: z.coerce.number().int().positive('User ID must be a positive integer')
});
