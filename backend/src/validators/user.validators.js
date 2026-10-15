import { z } from 'zod';

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export const updateProfileSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    avatar_color: z.string().regex(HEX_COLOR_REGEX, 'Avatar color must be a valid 6-digit hex code (#RRGGBB)').optional(),
    timezone: z.string().max(100).nullable().optional()
  })
};

export const updatePreferencesSchema = {
  body: z.object({
    theme: z.enum(['light', 'dark']).optional(),
    timezone: z.string().max(100).nullable().optional(),
    onboarding_dismissed: z.boolean().or(z.number().min(0).max(1)).optional()
  })
};

export const updateUserSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    capacity_hours_per_week: z.number().positive('Capacity must be greater than 0').max(168, 'Capacity cannot exceed 168 hours').optional()
  })
};

export const changeRoleSchema = {
  body: z.object({
    role: z.enum(['admin', 'manager', 'member'], {
      errorMap: () => ({ message: 'Role must be admin, manager, or member' })
    })
  })
};

export const toggleStatusSchema = {
  body: z.object({
    is_active: z.boolean().or(z.number().min(0).max(1))
  })
};
