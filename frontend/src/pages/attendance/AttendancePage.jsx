import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserCheck, LogIn, LogOut, Clock, Calendar, CheckCircle,
  AlertCircle, ChevronRight, User
} from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { attendanceService } from '../../services/peopleService.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

function formatDurationSeconds(sec) {
  if (!sec || sec <= 0) return '0m';
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m ${s}s`;
}

function formatTime(isoStr) {
  if (!isoStr) return '-';
  try {
    return format(new Date(isoStr), 'hh:mm:ss a');
  } catch {
    return isoStr;
  }
}

export function AttendancePage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [targetUserId, setTargetUserId] = useState('');
  const [liveElapsed, setLiveElapsed] = useState(0);

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // 1. Fetch live attendance status of current user
  const { data: statusData, isLoading: isStatusLoading } = useQuery({
    queryKey: ['attendance-status'],
    queryFn: () => attendanceService.getStatus(),
    refetchInterval: 15000
  });

  // 2. Fetch logs (strictly defaults to logged-in user)
  const { data: logs = [], isLoading: isLogsLoading } = useQuery({
    queryKey: ['attendance-logs', targetUserId || user?.id],
    queryFn: () => attendanceService.listLogs({
      targetUserId: targetUserId || undefined
    })
  });

  // 3. Fetch users for manager/admin filter
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => userService.listUsers({ limit: 100 }),
    enabled: canManage
  });

  const allUsers = usersData?.users || [];

  // Live timer tick when checked in
  useEffect(() => {
    if (!statusData?.is_checked_in || !statusData?.current_session?.check_in_at) {
      setLiveElapsed(0);
      return;
    }

    const calc = () => {
      const checkInMs = new Date(statusData.current_session.check_in_at).getTime();
      const diffSec = Math.max(0, Math.floor((Date.now() - checkInMs) / 1000));
      setLiveElapsed(diffSec);
    };

    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [statusData]);

  // Check In Mutation
  const checkInMutation = useMutation({
    mutationFn: () => attendanceService.checkIn(),
    onSuccess: () => {
      success('Checked In', 'Your work session has started.');
      queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    onError: (err) => {
      toastError('Check-In Failed', err.response?.data?.message || err.message);
    }
  });

  // Check Out Mutation
  const checkOutMutation = useMutation({
    mutationFn: () => attendanceService.checkOut(),
    onSuccess: () => {
      success('Checked Out', 'Your work session has been completed.');
      queryClient.invalidateQueries({ queryKey: ['attendance-status'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
    },
    onError: (err) => {
      toastError('Check-Out Failed', err.response?.data?.message || err.message);
    }
  });

  const isCheckedIn = !!statusData?.is_checked_in;
  const todayTotal = (statusData?.today_duration_seconds || 0) + (isCheckedIn ? liveElapsed : 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Attendance Tracking
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Check in for work, monitor active session hours, and review historical logs
            </p>
          </div>
        </div>

        {canManage && (
          <div className="w-52">
            <Select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="text-xs"
            >
              <option value="">My Attendance Logs</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      {/* Main Check-In Card & Today Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left: Interactive Check-in / Check-out Punch Card */}
        <Card className="md:col-span-2 p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`w-3 h-3 rounded-full ${
                    isCheckedIn ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                />
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {isCheckedIn ? 'Currently Working' : 'Not Checked In'}
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isCheckedIn
                  ? `Checked in at ${formatTime(statusData?.current_session?.check_in_at)}`
                  : 'Start your shift or workday by checking in below.'}
              </p>
            </div>

            {/* Live Timer Clock display */}
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                Session Duration
              </span>
              <span className="text-2xl font-mono font-bold text-brand-600 dark:text-brand-400">
                {formatDurationSeconds(liveElapsed)}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-500">
              Today is <strong>{format(new Date(), 'EEEE, MMMM d, yyyy')}</strong>
            </div>

            {isCheckedIn ? (
              <Button
                variant="destructive"
                size="md"
                onClick={() => checkOutMutation.mutate()}
                disabled={checkOutMutation.isPending}
                className="gap-2 shadow-xs"
              >
                <LogOut className="w-4 h-4" />
                {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out Now'}
              </Button>
            ) : (
              <Button
                size="md"
                onClick={() => checkInMutation.mutate()}
                disabled={checkInMutation.isPending}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <LogIn className="w-4 h-4" />
                {checkInMutation.isPending ? 'Checking In...' : 'Check In to Work'}
              </Button>
            )}
          </div>
        </Card>

        {/* Right: Summary Card */}
        <Card className="p-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Today&apos;s Total Work Time
            </h3>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              {formatDurationSeconds(todayTotal)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Sum of completed sessions plus active duration today
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>Target: 8h 00m standard shift</span>
          </div>
        </Card>
      </div>

      {/* Attendance Log History Table */}
      <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {targetUserId ? `Attendance History: ${allUsers.find(u => String(u.id) === String(targetUserId))?.name || 'Member'}` : 'Your Attendance History'}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {targetUserId ? 'Filtered records for selected member' : 'Personal check-in and check-out records'}
            </p>
          </div>
          <span className="text-xs text-slate-400">
            {logs.length} session{logs.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Check-In</th>
                <th className="py-3 px-4">Check-Out</th>
                <th className="py-3 px-4 text-right">Duration</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {targetUserId ? 'No attendance logs recorded for this member yet.' : 'You have not recorded any attendance sessions yet. Click "Check In to Work" above to start your shift.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const checkInTime = new Date(log.check_in_at);
                  const checkOutTime = log.check_out_at ? new Date(log.check_out_at) : null;
                  const durSeconds = checkOutTime
                    ? Math.max(0, differenceInSeconds(checkOutTime, checkInTime))
                    : Math.max(0, differenceInSeconds(new Date(), checkInTime));

                  const isComplete = !!log.check_out_at;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        {log.work_date}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={log.user_name} color={log.user_avatar_color} size="xs" />
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {log.user_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {formatTime(log.check_in_at)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {log.check_out_at ? formatTime(log.check_out_at) : 'Active Session'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-200">
                        {formatDurationSeconds(durSeconds)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge
                          variant={isComplete ? 'default' : 'success'}
                          size="xs"
                        >
                          {isComplete ? 'Completed' : 'Working'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
export default AttendancePage;
