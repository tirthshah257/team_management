import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/env.js';

const BCRYPT_SALT_ROUNDS = 12;

export async function hashPassword(plainText) {
  return bcrypt.hash(plainText, BCRYPT_SALT_ROUNDS);
}

export async function comparePassword(plainText, hash) {
  if (!plainText || !hash || typeof plainText !== 'string' || typeof hash !== 'string') {
    return false;
  }
  try {
    return await bcrypt.compare(plainText, hash);
  } catch (err) {
    return false;
  }
}

export function generateToken(payload) {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.JWT_SECRET);
}

export function generateRandomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
export const PASSWORD_REQUIREMENTS_MSG = 'Password must be at least 8 characters long and contain at least one letter and one number';
