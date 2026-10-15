import { z } from 'zod';
import { PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MSG } from '../utils/security.js';

export const createInvitationSchema = {
  body: z.object({
    email: z.string().trim().email('Please enter a valid email address'),
    role: z.enum(['admin', 'manager', 'member'], {
      errorMap: () => ({ message: 'Role must be admin, manager, or member' })
    })
  })
};

export const acceptInvitationSchema = {
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Please enter a valid email address'),
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MSG)
  }),
  query: z.object({
    token: z.string().min(1, 'Invitation token is required')
  })
};

export const validateInvitationTokenSchema = {
  query: z.object({
    token: z.string().min(1, 'Invitation token is required')
  })
};
