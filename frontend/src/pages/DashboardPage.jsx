import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  Circle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { userService } from '../services/userService.js';
import { teamService } from '../services/teamService.js';
import { projectService } from '../services/projectService.js';
import { taskService } from '../services/taskService.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardContent } from '../components/ui/Card.jsx';
import { ProgressBar } from '../components/ui/ProgressBar.jsx';

export function DashboardPage() {
  const { user, workspace, preferences, refreshUser, isAdmin, isManager } = useAuth();
  const { success } = useToast();
  const queryClient = useQueryClient();

  // Queries for onboarding checklist state
  const { data: usersData } = useQuery({
    queryKey: ['users', 'count'],
    queryFn: () => userService.listUsers({ pageSize: 5 })
  });

  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.listTeams()
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'dashboard'],
    queryFn: () => projectService.listProjects({ status: 'active', limit: 4 })
  });

  const { data: myTasksData } = useQuery({
    queryKey: ['my-tasks', 'dashboard'],
    queryFn: () => taskService.getMyTasks()
  });

  const dismissMutation = useMutation({
    mutationFn: () => userService.updatePreferences({ onboarding_dismissed: 1 }),
    onSuccess: () => {
      refreshUser();
      success('Onboarding Checklist Dismissed', 'You can always manage settings in the sidebar.');
    }
  });

  // Calculate real onboarding completion:
  // Step 1: Team/Project created (teamsData has at least 1 team)
  const hasTeams = (teamsData?.length || 0) > 0;
  // Step 2: Teammate invited (more than 1 user in workspace)
  const hasTeammates = (usersData?.meta?.total || 0) > 1;
  // Step 3: Account profile configured
  const hasProfile = Boolean(user?.name && user?.avatar_color);

  const completedSteps = [hasTeams, hasTeammates, hasProfile].filter(Boolean).length;
  const isAllComplete = completedSteps === 3;
  const showOnboarding = (isAdmin || isManager) && !preferences?.onboarding_dismissed && !isAllComplete;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Banner */}
      <div className="p-6 rounded-card bg-gradient-to-r from-brand-600 to-indigo-700 text-white shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
              {workspace?.name}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white uppercase tracking-wider">
              {user?.role}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold">
            Welcome back, {user?.name}!
          </h1>
          <p className="text-sm text-brand-100 mt-1 max-w-xl">
            {workspace?.name} workspace is active. Manage projects, collaborate with teammates, track workload and schedules all in one place.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(isAdmin || isManager) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.location.href = '/members'}
            >
              Manage Members
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => window.location.href = '/teams'}
          >
            Explore Teams
          </Button>
        </div>
      </div>

      {/* Onboarding Checklist Widget (dismissible & real data driven) */}
      {showOnboarding && (
        <Card className="border-brand-200 dark:border-brand-900/50 bg-brand-50/30 dark:bg-brand-950/20">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-brand-600 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Getting Started with TeamFlow
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Complete these key steps to get your workspace fully operational.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-xs font-semibold text-brand-700 dark:text-brand-300">
                  {completedSteps} of 3 complete
                </div>
                <button
                  onClick={() => dismissMutation.mutate()}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  title="Dismiss checklist"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <ProgressBar value={completedSteps} max={3} size="sm" color="brand" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
              {/* Step 1: Teams */}
              <div
                onClick={() => window.location.href = '/teams'}
                className={`p-3 rounded-btn border text-left cursor-pointer transition-all ${
                  hasTeams
                    ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-400 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {hasTeams ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>1. Create a Team Squad</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6">
                  {hasTeams ? 'Team established' : 'Organize teammates into squads'}
                </p>
              </div>

              {/* Step 2: Teammates */}
              <div
                onClick={() => window.location.href = '/members'}
                className={`p-3 rounded-btn border text-left cursor-pointer transition-all ${
                  hasTeammates
                    ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-400 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {hasTeammates ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>2. Invite Teammates</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6">
                  {hasTeammates ? `${usersData?.meta?.total} members joined` : 'Generate invitation link'}
                </p>
              </div>

              {/* Step 3: Profile */}
              <div
                onClick={() => window.location.href = '/settings'}
                className={`p-3 rounded-btn border text-left cursor-pointer transition-all ${
                  hasProfile
                    ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand-400 text-slate-800 dark:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold">
                  {hasProfile ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>3. Personalize Profile</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6">
                  Set avatar color & timezone
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Teammates</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {usersData?.meta?.total || 1} Active Members
            </div>
          </div>
        </div>

        <div className="p-4 rounded-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 shrink-0">
            <FolderKanban className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Teams</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {teamsData?.length || 0} Functional Squads
            </div>
          </div>
        </div>

        <div className="p-4 rounded-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Your Role</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize">
              {user?.role} Permissions
            </div>
          </div>
        </div>

        <div className="p-4 rounded-card border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-subtle flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Weekly Capacity</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {user?.capacity_hours_per_week || 40}h capacity
            </div>
          </div>
        </div>
      </div>

      {/* Projects and Tasks Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Projects */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-primary-500" />
              Active Projects
            </h3>
            <Link to="/projects" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {(projectsData?.projects || []).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No active projects found.
              </div>
            ) : (
              (projectsData?.projects || []).slice(0, 3).map(p => (
                <Link
                  key={p.id}
                  to={`/projects/${p.id}`}
                  className="block p-3.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:border-primary-500/40 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{p.name}</span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-400">{p.progress_percentage}%</span>
                  </div>
                  <ProgressBar value={p.progress_percentage} color="primary" size="xs" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* My Upcoming Tasks */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              My Upcoming Tasks
            </h3>
            <Link to="/my-tasks" className="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1">
              View All ({myTasksData?.counts?.total_active || 0}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {((myTasksData?.all || []).filter(t => t.status !== 'done')).length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No pending tasks assigned to you.
              </div>
            ) : (
              (myTasksData?.all || []).filter(t => t.status !== 'done').slice(0, 4).map(t => (
                <Link
                  key={t.id}
                  to={`/projects/${t.project_id}?taskId=${t.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.project_color || '#4F46E5' }} />
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{t.title}</span>
                  </div>
                  {t.due_date && (
                    <span className="text-[11px] font-medium text-slate-400 shrink-0">
                      {t.due_date}
                    </span>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
