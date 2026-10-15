import { z } from 'zod';

export const createManualTimeEntrySchema = z.object({
  task_id: z.coerce.number().int().positive('Task ID is required'),
  user_id: z.coerce.number().int().positive().optional(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'entry_date must be YYYY-MM-DD').default(() => new Date().toISOString().split('T')[0]),
  duration_seconds: z.coerce.number().int().positive('Duration must be greater than 0 seconds').max(86400, 'Duration cannot exceed 24 hours per entry'),
  note: z.string().trim().max(1000).optional().nullable()
});

export const updateTimeEntrySchema = z.object({
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration_seconds: z.coerce.number().int().positive().max(86400).optional(),
  note: z.string().trim().max(1000).optional().nullable()
});
