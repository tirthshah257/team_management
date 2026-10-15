import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { User, Lock, Clock, Moon, Sun, Shield, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { userService } from '../../services/userService.js';
import { backupService } from '../../services/peopleService.js';
import { Card, CardHeader, CardContent } from '../../components/ui/Card.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';

const AVATAR_COLORS = [
  '#4F46E5', '#2563EB', '#0D9488', '#059669',
  '#D97706', '#EA580C', '#DC2626', '#DB2777', '#7C3AED', '#475569'
];

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d)/, 'Password must contain at least one letter and one number'),
  confirmPassword: z.string().min(1, 'Please confirm your new password')
}).refine(data => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export function ProfilePage() {
  const { user, workspace, preferences, changePassword, refreshUser } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const { success, error: toastError } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || '#4F46E5');
  const [timezone, setTimezone] = useState(preferences?.timezone || '');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(passwordSchema)
  });

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await userService.updateProfile({
        name: name.trim(),
        avatar_color: avatarColor,
        timezone: timezone || null
      });
      await refreshUser();
      success('Profile Saved', 'Your profile details have been updated.');
    } catch (err) {
      toastError('Save Failed', err.message);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (data) => {
    setIsSavingPassword(true);
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword
      });
      reset();
      success('Password Updated', 'Your password has been changed successfully.');
    } catch (err) {
      toastError('Update Failed', err.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          Account Settings
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          Manage your personal profile, security credentials, and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Summary Card */}
        <Card className="p-6 flex flex-col items-center text-center space-y-3">
          <Avatar name={name} color={avatarColor} size="xl" />
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">{name}</h2>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
          <Badge variant="primary" className="capitalize text-xs">
            {user?.role}
          </Badge>
          <div className="w-full pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 text-left space-y-2">
            <div className="flex justify-between">
              <span>Workspace:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{workspace?.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Weekly Capacity:</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.capacity_hours_per_week}h</span>
            </div>
            <div className="flex justify-between">
              <span>Theme:</span>
              <button
                onClick={toggleTheme}
                className="font-semibold text-brand-600 hover:underline capitalize"
              >
                {theme} Mode
              </button>
            </div>
          </div>
        </Card>

        {/* Right Column: Profile Edit & Password Forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Profile Form */}
          <Card>
            <CardHeader
              title="Personal Details"
              subtitle="Update your display name and avatar color"
            />
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <Input
                  label="Display Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  icon={User}
                  required
                />

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Avatar Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {AVATAR_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setAvatarColor(hex)}
                        style={{ backgroundColor: hex }}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform ${
                          avatarColor === hex ? 'ring-2 ring-offset-2 ring-brand-500 scale-110' : 'hover:scale-105'
                        }`}
                      >
                        {avatarColor === hex && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                <Select
                  label="Timezone (Optional)"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  helperText="Leave empty to use workspace default timezone."
                >
                  <option value="">Workspace Default ({workspace?.timezone || 'UTC'})</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New York (EST/EDT)</option>
                  <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                </Select>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" isLoading={isSavingProfile}>
                    Save Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password */}
          <Card>
            <CardHeader
              title="Change Password"
              subtitle="Ensure your account is using a secure, unique password"
            />
            <CardContent>
              <form onSubmit={handleSubmit(handlePasswordSubmit)} className="space-y-4">
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="••••••••"
                  icon={Lock}
                  error={errors.currentPassword?.message}
                  {...register('currentPassword')}
                />

                <Input
                  label="New Password"
                  type="password"
                  placeholder="••••••••"
                  helperText="At least 8 characters, with letters and numbers"
                  icon={Lock}
                  error={errors.newPassword?.message}
                  {...register('newPassword')}
                />

                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="••••••••"
                  icon={Lock}
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                />

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" isLoading={isSavingPassword}>
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Admin Database Backups Section */}
          {user?.role === 'admin' && <AdminBackupsCard />}
        </div>
      </div>
    </div>
  );
}

function AdminBackupsCard() {
  const { success, error: toastError } = useToast();
  const [backups, setBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const data = await backupService.listBackups();
      setBackups(data || []);
    } catch (err) {
      toastError('Fetch Backups Failed', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchBackups();
  }, []);

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      await backupService.triggerBackup();
      success('Backup Created', 'Database snapshot created successfully.');
      await fetchBackups();
    } catch (err) {
      toastError('Backup Failed', err.response?.data?.message || err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Workspace Database Backups"
        subtitle="Create and download snapshots of the SQLite database"
      />
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Backups are stored locally and rotated automatically. Only Admins can download database files.
          </p>
          <Button
            size="sm"
            onClick={handleCreateBackup}
            disabled={isBackingUp}
            className="text-xs shrink-0"
          >
            {isBackingUp ? 'Backing Up...' : 'Create Backup Now'}
          </Button>
        </div>

        <div className="border border-slate-100 dark:border-slate-800 rounded-lg overflow-hidden">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-2.5 px-3">File Name</th>
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-400">
                    No backups created yet.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                      {b.filename}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {b.size_bytes ? `${Math.round(b.size_bytes / 1024)} KB` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {b.created_at ? b.created_at.slice(0, 19).replace('T', ' ') : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <a
                        href={backupService.getDownloadUrl(b.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline font-semibold"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

