import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { AppShell } from '../layouts/AppShell.jsx';
import { LoginPage } from '../pages/auth/LoginPage.jsx';
import { RegisterPage } from '../pages/auth/RegisterPage.jsx';
import { AcceptInvitePage } from '../pages/auth/AcceptInvitePage.jsx';
import { DashboardPage } from '../pages/DashboardPage.jsx';
import { MembersPage } from '../pages/members/MembersPage.jsx';
import { TeamsPage } from '../pages/teams/TeamsPage.jsx';
import { TeamDetailPage } from '../pages/teams/TeamDetailPage.jsx';
import { ProfilePage } from '../pages/profile/ProfilePage.jsx';
import { ProjectsPage } from '../pages/projects/ProjectsPage.jsx';
import { ProjectDetailPage } from '../pages/projects/ProjectDetailPage.jsx';
import { MyTasksPage } from '../pages/tasks/MyTasksPage.jsx';
import { CalendarPage } from '../pages/calendar/CalendarPage.jsx';
import { WorkloadPage } from '../pages/workload/WorkloadPage.jsx';
import { TimesheetsPage } from '../pages/time/TimesheetsPage.jsx';
import { ReportsPage } from '../pages/reports/ReportsPage.jsx';
import { AttendancePage } from '../pages/attendance/AttendancePage.jsx';
import { LeavePage } from '../pages/leave/LeavePage.jsx';
import { PerformancePage } from '../pages/performance/PerformancePage.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="h-8 w-1/2 mx-auto" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function ManagerOrAdminRoute({ children }) {
  const { isAuthenticated, isLoading, isAdmin, isManager } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin && !isManager) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    )
  },
  {
    path: '/register',
    element: (
      <PublicOnlyRoute>
        <RegisterPage />
      </PublicOnlyRoute>
    )
  },
  {
    path: '/accept-invite',
    element: (
      <PublicOnlyRoute>
        <AcceptInvitePage />
      </PublicOnlyRoute>
    )
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: <DashboardPage />
      },
      {
        path: 'members',
        element: (
          <ManagerOrAdminRoute>
            <MembersPage />
          </ManagerOrAdminRoute>
        )
      },
      {
        path: 'teams',
        element: <TeamsPage />
      },
      {
        path: 'teams/:id',
        element: <TeamDetailPage />
      },
      {
        path: 'settings',
        element: <ProfilePage />
      },
      {
        path: 'my-tasks',
        element: <MyTasksPage />
      },
      {
        path: 'projects',
        element: <ProjectsPage />
      },
      {
        path: 'projects/:id',
        element: <ProjectDetailPage />
      },
      {
        path: 'calendar',
        element: <CalendarPage />
      },
      {
        path: 'workload',
        element: (
          <ManagerOrAdminRoute>
            <WorkloadPage />
          </ManagerOrAdminRoute>
        )
      },
      {
        path: 'timesheets',
        element: <TimesheetsPage />
      },
      {
        path: 'reports',
        element: (
          <ManagerOrAdminRoute>
            <ReportsPage />
          </ManagerOrAdminRoute>
        )
      },
      {
        path: 'attendance',
        element: <AttendancePage />
      },
      {
        path: 'leave',
        element: <LeavePage />
      },
      {
        path: 'performance',
        element: <PerformancePage />
      }
    ]
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />
  }
]);
