import { z } from 'zod';

export const createTeamSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(100),
    description: z.string().trim().max(500).optional().nullable()
  })
};

export const updateTeamSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Team name must be at least 2 characters').max(100).optional(),
    description: z.string().trim().max(500).optional().nullable()
  })
};

export const addTeamMemberSchema = {
  body: z.object({
    userId: z.coerce.number().int().positive('Valid user ID is required')
  })
};
