import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, User, Mail, Lock, ShieldAlert } from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const registerSchema = z.object({
  workspaceName: z.string().trim().min(2, 'Workspace name must be at least 2 characters').max(100),
  name: z.string().trim().min(2, 'Your name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid work email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number')
});

export function RegisterPage() {
  const { register: registerWorkspace, canRegister } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { workspaceName: '', name: '', email: '', password: '' }
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await registerWorkspace(data);
      toastSuccess('Workspace Created', 'Welcome to TeamFlow! You are the workspace administrator.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toastError('Registration Failed', err.message || 'Could not complete workspace setup');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!canRegister) {
    return (
      <AuthLayout
        title="Registration Closed"
        subtitle="This workspace already has an active administrator"
      >
        <div className="text-center py-4 space-y-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Initial setup has already been completed. New users can only join by invitation from an existing Admin or Manager.
          </p>
          <div className="pt-2">
            <Link to="/login">
              <Button variant="primary" className="w-full">
                Return to Login
              </Button>
            </Link>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your Workspace"
      subtitle="Set up your primary team instance and Admin account"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Workspace Name"
          placeholder="e.g. Acme Corporation"
          icon={Building2}
          error={errors.workspaceName?.message}
          {...register('workspaceName')}
        />

        <Input
          label="Your Full Name"
          placeholder="Alice Johnson"
          icon={User}
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Administrator Email"
          type="email"
          placeholder="admin@company.com"
          icon={Mail}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Admin Password"
          type="password"
          placeholder="••••••••"
          helperText="At least 8 characters, with letters and numbers"
          icon={Lock}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full mt-2"
          isLoading={isSubmitting}
        >
          Initialize Workspace & Start
        </Button>

        <div className="text-center text-xs text-slate-500 pt-2">
          Already registered?{' '}
          <Link to="/login" className="text-brand-600 font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
