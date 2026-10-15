import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  UserCheck, Lock, User, AlertCircle, Sparkles, Copy, Check, Eye, EyeOff, KeyRound
} from 'lucide-react';
import { invitationService } from '../../services/invitationService.js';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const acceptSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password')
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

function generateSecurePassword() {
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const symbols = '!@#$%&*';
  
  let pwd = 'Pass-';
  for (let i = 0; i < 4; i++) pwd += letters[Math.floor(Math.random() * letters.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += symbols[Math.floor(Math.random() * symbols.length)];
  for (let i = 0; i < 2; i++) pwd += digits[Math.floor(Math.random() * digits.length)];
  return pwd;
}

function nameFromEmail(email) {
  if (!email || !email.includes('@')) return '';
  const prefix = email.split('@')[0];
  return prefix
    .split(/[._-]/)
    .filter(Boolean)
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
}

export function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const { success, error: toastError } = useToast();

  const [isValidating, setIsValidating] = useState(true);
  const [validationError, setValidationError] = useState('');
  const [inviteData, setInviteData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(acceptSchema)
  });

  const currentName = watch('name');

  useEffect(() => {
    async function validate() {
      if (!token) {
        setValidationError('Missing invitation token in URL.');
        setIsValidating(false);
        return;
      }
      try {
        const data = await invitationService.validateToken(token);
        setInviteData(data);
        if (data?.email) {
          const suggested = nameFromEmail(data.email);
          if (suggested) {
            setValue('name', suggested);
          }
        }
      } catch (err) {
        setValidationError(err.message || 'Invalid, expired, or already accepted invitation link.');
      } finally {
        setIsValidating(false);
      }
    }
    validate();
  }, [token, setValue]);

  const handleAutoGenerate = () => {
    const newPwd = generateSecurePassword();
    setValue('password', newPwd, { shouldValidate: true });
    setValue('confirmPassword', newPwd, { shouldValidate: true });
    
    if (!currentName && inviteData?.email) {
      setValue('name', nameFromEmail(inviteData.email), { shouldValidate: true });
    }
    
    setGeneratedCreds({
      email: inviteData?.email,
      password: newPwd
    });
    setShowPassword(true);
  };

  const handleCopyCredentials = () => {
    if (!generatedCreds) return;
    const text = `Email: ${generatedCreds.email}\nPassword: ${generatedCreds.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      await invitationService.acceptInvitation(token, {
        name: formData.name,
        password: formData.password,
        email: inviteData.email
      });
      await refreshUser();
      success('Welcome to TeamFlow!', 'Your account has been created and you are now a team member.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toastError('Failed to accept invitation', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <AuthLayout title="Validating Invitation..." subtitle="Please wait while we verify your link">
        <div className="space-y-4 py-4">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-24 w-full" />
        </div>
      </AuthLayout>
    );
  }

  if (validationError) {
    return (
      <AuthLayout title="Invitation Invalid" subtitle="This link cannot be used">
        <div className="text-center py-4 space-y-4">
          <div className="w-12 h-12 bg-rose-50 dark:bg-rose-950/50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <p className="text-xs text-rose-700 dark:text-rose-400">
            {validationError}
          </p>
          <div className="pt-2">
            <Link to="/login">
              <Button variant="primary" className="w-full">
                Go to Sign In
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={`Join ${inviteData?.workspaceName}`}
      subtitle={`You've been invited as a ${inviteData?.role}`}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Email Address (User ID)
          </label>
          <input
            type="text"
            readOnly
            value={inviteData?.email || ''}
            className="block w-full rounded-btn border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-xs px-3 py-2 text-slate-500 cursor-not-allowed font-mono"
          />
        </div>

        <Input
          label="Your Full Name"
          placeholder="Jane Doe"
          icon={User}
          error={errors.name?.message}
          {...register('name')}
        />

        {/* Auto-generate credentials toolbar */}
        <div className="flex items-center justify-between pt-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Account Password
          </label>
          <button
            type="button"
            onClick={handleAutoGenerate}
            className="inline-flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-semibold"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Auto-generate password
          </button>
        </div>

        {/* If password was generated, display copyable credentials box */}
        {generatedCreds && (
          <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 space-y-2 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Generated Credentials
              </span>
              <button
                type="button"
                onClick={handleCopyCredentials}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy ID & Password'}
              </button>
            </div>
            <div className="bg-white/80 dark:bg-slate-900/80 p-2 rounded border border-amber-100 dark:border-amber-900/40 text-xs font-mono space-y-1">
              <div><span className="text-slate-400 select-none">Email: </span><span className="text-slate-800 dark:text-slate-200 font-bold">{generatedCreds.email}</span></div>
              <div><span className="text-slate-400 select-none">Password: </span><span className="text-amber-600 dark:text-amber-400 font-bold">{generatedCreds.password}</span></div>
            </div>
            <p className="text-[10px] text-amber-700 dark:text-amber-300">
              Save these credentials. You can use them to log into TeamFlow on any device.
            </p>
          </div>
        )}

        <div className="relative">
          <Input
            label="Create Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            helperText="At least 8 characters, with letters and numbers"
            icon={Lock}
            error={errors.password?.message}
            {...register('password')}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Input
          label="Confirm Password"
          type={showPassword ? 'text' : 'password'}
          placeholder="••••••••"
          icon={Lock}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isSubmitting}
        >
          Accept Invitation & Join Team
        </Button>
      </form>
    </AuthLayout>
  );
}
