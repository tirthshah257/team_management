import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000, 'Comment cannot exceed 5000 characters')
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(5000, 'Comment cannot exceed 5000 characters')
});

export const updateNotificationSettingsSchema = z.object({
  settings: z.array(z.object({
    notification_type: z.string(),
    in_app_enabled: z.coerce.number().int().min(0).max(1)
  }))
});
