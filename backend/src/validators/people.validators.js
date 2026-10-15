import { z } from 'zod';

export const createLeaveRequestSchema = z.object({
  leave_type: z.enum(['casual', 'sick', 'other']),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'start_date must be YYYY-MM-DD'),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD'),
  days: z.coerce.number().positive('Days must be greater than 0'),
  reason: z.string().trim().max(1000).optional().nullable()
}).refine(data => data.end_date >= data.start_date, {
  message: 'end_date cannot be earlier than start_date',
  path: ['end_date']
});

export const reviewLeaveRequestSchema = z.object({
  review_note: z.string().trim().max(1000).optional().nullable()
});

export const adjustLeaveBalanceSchema = z.object({
  adjustment_days: z.coerce.number(),
  adjustment_reason: z.string().trim().min(3, 'Adjustment reason is required').max(500)
});

export const performanceReviewSchema = z.object({
  user_id: z.coerce.number().int().positive('User ID is required'),
  review_month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'review_month must be YYYY-MM'),
  review_note: z.string().trim().min(1, 'Review note cannot be empty').max(5000)
});
