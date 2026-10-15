import { z } from 'zod';
import { PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MSG } from '../utils/security.js';

export const registerSchema = {
  body: z.object({
    workspaceName: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(100),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Invalid email address').max(255),
    password: z.string().regex(PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MSG)
  })
};

export const loginSchema = {
  body: z.object({
    email: z.string().trim().email('Invalid email address'),
    password: z.string().min(1, 'Password is required')
  })
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().regex(PASSWORD_REGEX, PASSWORD_REQUIREMENTS_MSG)
  })
};
