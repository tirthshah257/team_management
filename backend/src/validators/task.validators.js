import { z } from 'zod';

const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD').optional().nullable(),
  estimated_minutes: z.coerce.number().int().min(0).max(525600).optional().nullable(),
  assignee_ids: z.array(z.coerce.number().int().positive()).optional(),
  label_ids: z.array(z.coerce.number().int().positive()).optional()
}).refine(data => {
  if (data.start_date && data.due_date) {
    return data.due_date >= data.start_date;
  }
  return true;
}, {
  message: 'Due date cannot be earlier than start date',
  path: ['due_date']
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimated_minutes: z.coerce.number().int().min(0).max(525600).optional().nullable()
}).refine(data => {
  if (data.start_date && data.due_date) {
    return data.due_date >= data.start_date;
  }
  return true;
}, {
  message: 'Due date cannot be earlier than start date',
  path: ['due_date']
});

export const moveTaskSchema = z.object({
  status: z.enum(['todo', 'in_progress', 'done']),
  position: z.number().optional(),
  previous_task_id: z.coerce.number().int().positive().optional().nullable(),
  next_task_id: z.coerce.number().int().positive().optional().nullable()
});

export const taskAssigneeSchema = z.object({
  user_id: z.coerce.number().int().positive('User ID is required')
});

export const setTaskLabelsSchema = z.object({
  label_ids: z.array(z.coerce.number().int().positive())
});

export const createSubtaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  sort_order: z.number().default(0)
});

export const updateSubtaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  is_completed: z.coerce.number().int().min(0).max(1).optional(),
  sort_order: z.number().optional()
});

export const labelSchema = z.object({
  name: z.string().trim().min(1, 'Label name is required').max(50),
  color: z.string().regex(hexColorRegex, 'Color must be a valid 6-character hex code').default('#64748B')
});
