import { z } from 'zod';

export const recurrenceRuleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly', 'custom']),
  interval_value: z.coerce.number().int().min(1).default(1),
  custom_unit: z.enum(['day', 'week', 'month']).optional().nullable(),
  days_of_week: z.string().regex(/^([1-7](,[1-7])*)?$/, 'days_of_week must be comma-separated 1-7').optional().nullable(),
  day_of_month: z.coerce.number().int().min(1).max(31).optional().nullable(),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'starts_on must be YYYY-MM-DD'),
  ends_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ends_on must be YYYY-MM-DD').optional().nullable()
}).refine(data => {
  if (data.frequency === 'custom' && !data.custom_unit) {
    return false;
  }
  return true;
}, {
  message: 'custom_unit is required when frequency is custom',
  path: ['custom_unit']
}).refine(data => {
  if (data.starts_on && data.ends_on) {
    return data.ends_on >= data.starts_on;
  }
  return true;
}, {
  message: 'ends_on cannot be earlier than starts_on',
  path: ['ends_on']
});
