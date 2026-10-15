import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import {
  Mail, Lock, ArrowRight, ShieldCheck, Users, Shield, User,
  Sparkles, Copy, Check, Eye, EyeOff, KeyRound, ChevronRight
} from 'lucide-react';
import { AuthLayout } from '../../layouts/AuthLayout.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

const loginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});

const DEFAULT_DEMO_USERS = [
  {
    id: 1,
    name: 'Alice Johnson',
    email: 'admin@teamflow.local',
    role: 'admin',
    defaultPassword: 'Admin123!',
    avatar_color: '#4F46E5',
    description: 'Full workspace administration, invitations, backups, settings & all projects'
  },
  {
    id: 2,
    name: 'Sarah Connor',
    email: 'sarah.manager@teamflow.local',
    role: 'manager',
    defaultPassword: 'Manager123!',
    avatar_color: '#0D9488',
    description: 'Project lead, team management, task assignments, leave approvals'
  },
  {
    id: 4,
    name: 'David Chen',
    email: 'dev1.chen@teamflow.local',
    role: 'member',
    defaultPassword: 'Member123!',
    avatar_color: '#2563EB',
    description: 'Assigned tasks, workload, attendance, time tracking, collaboration'
  },
  {
    id: 5,
    name: 'Marcus Brody',
    email: 'dev2.marcus@teamflow.local',
    role: 'member',
    defaultPassword: 'Member123!',
    avatar_color: '#7C3AED',
    description: 'Full-stack engineering, assigned project tasks & sprint workload'
  },
  {
    id: 6,
    name: 'Elena Rostova',
    email: 'designer.elena@teamflow.local',
    role: 'member',
    defaultPassword: 'Member123!',
    avatar_color: '#DB2777',
    description: 'UI/UX design, design system tasks, comments & attachments'
  },
  {
    id: 7,
    name: 'Priya Patel',
    email: 'qa.priya@teamflow.local',
    role: 'member',
    defaultPassword: 'Member123!',
    avatar_color: '#059669',
    description: 'QA testing, automated regression tasks, bug tracking'
  },
  {
    id: 8,
    name: 'Jordan Lee',
    email: 'dev3.jordan@teamflow.local',
    role: 'member',
    defaultPassword: 'Member123!',
    avatar_color: '#EA580C',
    description: 'Frontend engineering, assigned tickets & leave requests'
  }
];

export function LoginPage() {
  const { login, quickLogin, getSystemMembers, canRegister } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switchingUserId, setSwitchingUserId] = useState(null);
  const [systemMembers, setSystemMembers] = useState(DEFAULT_DEMO_USERS);
  const [roleTab, setRoleTab] = useState('all'); // 'all' | 'member' | 'manager' | 'admin'
  const [copiedId, setCopiedId] = useState(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  });

  // Fetch real database members if available
  useEffect(() => {
    async function fetchMembers() {
      try {
        const data = await getSystemMembers();
        if (Array.isArray(data) && data.length > 0) {
          setSystemMembers(data);
        }
      } catch (err) {
        // Fallback to DEFAULT_DEMO_USERS
      }
    }
    fetchMembers();
  }, [getSystemMembers]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await login(data);
      toastSuccess('Welcome back!', 'Successfully signed in to TeamFlow.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toastError('Login Failed', err.message || 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLoginAs = async (member) => {
    setSwitchingUserId(member.id);
    try {
      await quickLogin({ email: member.email, userId: member.id });
      toastSuccess(
        `Signed in as ${member.name}!`,
        `You are now viewing TeamFlow as a ${member.role.toUpperCase()}.`
      );
      navigate('/dashboard', { replace: true });
    } catch (err) {
      // Fallback: try regular login with default password
      try {
        await login({ email: member.email, password: member.defaultPassword || 'Member123!' });
        toastSuccess(`Signed in as ${member.name}!`, `Role: ${member.role}`);
        navigate('/dashboard', { replace: true });
      } catch (e) {
        toastError('Sign In Failed', err.message || 'Unable to sign in');
      }
    } finally {
      setSwitchingUserId(null);
    }
  };

  const handleFillCredentials = (member) => {
    setValue('email', member.email, { shouldValidate: true });
    setValue('password', member.defaultPassword || 'Member123!', { shouldValidate: true });
  };

  const handleCopyCredentials = (member) => {
    const text = `Email: ${member.email}\nPassword: ${member.defaultPassword || 'Member123!'}`;
    navigator.clipboard.writeText(text);
    setCopiedId(member.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredMembers = systemMembers.filter(m => {
    if (roleTab === 'all') return true;
    return m.role === roleTab;
  });

  const memberCount = systemMembers.filter(m => m.role === 'member').length;
  const managerCount = systemMembers.filter(m => m.role === 'manager').length;
  const adminCount = systemMembers.filter(m => m.role === 'admin').length;

  const sideContent = (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-5 sm:p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            System Members & RBAC Roles
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Role-Based Access Control &bull; ID & Password for all members
          </p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 px-2 py-0.5 rounded-full">
          {systemMembers.length} Accounts
        </span>
      </div>

      {/* Role Tabs Filter */}
      <div className="flex items-center gap-1.5 pt-3 pb-2 text-xs">
        <button
          type="button"
          onClick={() => setRoleTab('all')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
            roleTab === 'all'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          All ({systemMembers.length})
        </button>
        <button
          type="button"
          onClick={() => setRoleTab('member')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
            roleTab === 'member'
              ? 'bg-blue-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Members ({memberCount})
        </button>
        <button
          type="button"
          onClick={() => setRoleTab('manager')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
            roleTab === 'manager'
              ? 'bg-amber-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Managers ({managerCount})
        </button>
        <button
          type="button"
          onClick={() => setRoleTab('admin')}
          className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
            roleTab === 'admin'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          Admins ({adminCount})
        </button>
      </div>

      {/* Scrollable Members List */}
      <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[380px] pr-1 mt-1">
        {filteredMembers.map((m) => {
          const isSelected = switchingUserId === m.id;
          const isCopied = copiedId === m.id;
          const roleBadgeColor =
            m.role === 'admin'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
              : m.role === 'manager'
              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800';

          return (
            <div
              key={m.id}
              className="p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-850/60 hover:border-brand-500/40 dark:hover:border-brand-500/40 transition-all flex flex-col justify-between gap-2 text-xs"
            >
              {/* Member Top Row */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-xs"
                    style={{ backgroundColor: m.avatar_color || '#4F46E5' }}
                  >
                    {m.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 dark:text-white truncate">
                      {m.name}
                    </div>
                    <span
                      className={`inline-block text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.2 rounded border ${roleBadgeColor}`}
                    >
                      {m.role === 'admin' ? 'Administrator' : m.role === 'manager' ? 'Project Manager' : 'Team Member'}
                    </span>
                  </div>
                </div>

                {/* 1-Click Quick Login Button */}
                <button
                  type="button"
                  onClick={() => handleQuickLoginAs(m)}
                  disabled={isSelected}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-semibold text-xs shadow-xs transition-colors shrink-0 disabled:opacity-50"
                  title={`Sign in immediately as ${m.name}`}
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  {isSelected ? 'Signing in...' : 'Log in as Member'}
                </button>
              </div>

              {/* ID & Password Display Card */}
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2 text-[11px] font-mono">
                <div className="truncate flex-1">
                  <span className="text-slate-400 select-none">ID: </span>
                  <span className="text-slate-800 dark:text-slate-200 font-semibold">{m.email}</span>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <div>
                    <span className="text-slate-400 select-none">Pass: </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{m.defaultPassword || 'Member123!'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(m)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                    title="Copy Email & Password"
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFillCredentials(m)}
                    className="text-[10px] font-sans font-semibold text-primary-600 dark:text-primary-400 hover:underline"
                    title="Fill into sign in form"
                  >
                    Fill form
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* RBAC Info Footer */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span className="flex items-center gap-1 font-medium">
          <Shield className="w-3 h-3 text-emerald-500" /> RBAC Enforced: Members see only assigned projects & tasks
        </span>
        <span className="text-slate-400 font-mono">TeamFlow 2.0</span>
      </div>
    </div>
  );

  return (
    <AuthLayout
      title="Sign in to your account"
      subtitle="Enter credentials or choose any member from the side to log in"
      sideContent={sideContent}
    >
      {/* If database is fresh and no users exist, notify user to register first workspace */}
      {canRegister && (
        <div className="mb-6 p-3.5 rounded-btn bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-xs text-brand-800 dark:text-brand-300 flex items-start gap-2.5">
          <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-semibold">Initial Setup Required:</span> No administrator account exists yet.
            <div className="mt-1.5">
              <Link
                to="/register"
                className="font-bold underline hover:text-brand-900 dark:hover:text-brand-100"
              >
                Create Workspace & First Admin &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email Address (Member ID)"
          type="email"
          autoComplete="email"
          placeholder="member@teamflow.local"
          icon={Mail}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
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
          Sign In
        </Button>
      </form>
    </AuthLayout>
  );
}
