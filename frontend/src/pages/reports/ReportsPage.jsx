import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  BarChart3, Download, TrendingUp, CheckCircle2, Clock,
  FolderKanban, Filter, RefreshCw
} from 'lucide-react';
import { reportService } from '../../services/timeService.js';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

const CHART_COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#64748B'];

export function ReportsPage() {
  const [activeTab, setActiveTab] = useState('progress'); // 'progress' | 'productivity' | 'time'
  const [dateRange, setDateRange] = useState({
    from: `${new Date().getFullYear()}-01-01`,
    to: new Date().toISOString().split('T')[0]
  });

  // Queries for the 3 report types
  const { data: progressData = [], isLoading: isProgressLoading, refetch: refetchProgress } = useQuery({
    queryKey: ['report-progress'],
    queryFn: () => reportService.getProgressReport()
  });

  const { data: productivityData = [], isLoading: isProductivityLoading, refetch: refetchProductivity } = useQuery({
    queryKey: ['report-productivity', dateRange.from, dateRange.to],
    queryFn: () => reportService.getProductivityReport(dateRange)
  });

  const { data: timeSpentData, isLoading: isTimeLoading, refetch: refetchTime } = useQuery({
    queryKey: ['report-time-spent', dateRange.from, dateRange.to],
    queryFn: () => reportService.getTimeSpentReport(dateRange)
  });

  const timeByProject = timeSpentData?.by_project || [];

  const handleExportCsv = (reportType) => {
    const url = reportService.getExportUrl(reportType, dateRange.from, dateRange.to);
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Reports & Analytics
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Data-driven insights into project velocity, member productivity, and logged hours
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCsv(activeTab === 'time' ? 'time-spent' : activeTab)}
            className="gap-1.5 text-xs shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('progress')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'progress'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <FolderKanban className="w-4 h-4" />
          Project Progress
        </button>

        <button
          onClick={() => setActiveTab('productivity')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'productivity'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Team Productivity
        </button>

        <button
          onClick={() => setActiveTab('time')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'time'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Clock className="w-4 h-4" />
          Time Distribution
        </button>
      </div>

      {/* Tab 1: Project Progress */}
      {activeTab === 'progress' && (
        <div className="space-y-6">
          {isProgressLoading ? (
            <Skeleton className="h-80 w-full" />
          ) : progressData.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <FolderKanban className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
                No active projects found
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Create projects and tasks to see completion velocity and progress metrics.
              </p>
            </Card>
          ) : (
            <>
              {/* Visual Bar Chart */}
              <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                  Task Completion Breakdown by Project
                </h3>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={progressData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <RechartsTooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                          border: 'none'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="done_tasks" name="Done" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="in_progress_tasks" name="In Progress" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="todo_tasks" name="To Do" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Progress Table */}
              <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-sm text-slate-900 dark:text-slate-100">
                  Project Completion Summary
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                        <th className="py-3 px-4">Project</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-center">Total Tasks</th>
                        <th className="py-3 px-4 text-center">Completed</th>
                        <th className="py-3 px-4 text-center">Remaining</th>
                        <th className="py-3 px-4">Progress %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {progressData.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full"
                              style={{ backgroundColor: p.color || '#4F46E5' }}
                            />
                            {p.name}
                          </td>
                          <td className="py-3 px-4">
                            <span className="capitalize text-slate-600 dark:text-slate-400">
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center font-medium">{p.total_tasks}</td>
                          <td className="py-3 px-4 text-center text-emerald-600 dark:text-emerald-400 font-semibold">
                            {p.done_tasks}
                          </td>
                          <td className="py-3 px-4 text-center text-slate-500">
                            {p.in_progress_tasks + p.todo_tasks}
                          </td>
                          <td className="py-3 px-4 min-w-[140px]">
                            <div className="flex items-center gap-2">
                              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{ width: `${p.progress_percentage}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 w-8 text-right">
                                {p.progress_percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Team Productivity */}
      {activeTab === 'productivity' && (
        <div className="space-y-6">
          {/* Productivity Chart */}
          <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
              Member Output (Completed Tasks & Hours Logged)
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={productivityData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                      border: 'none'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="completed_tasks" name="Tasks Completed" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="hours_logged" name="Hours Logged" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Productivity Table */}
          <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4 text-center">Tasks Completed</th>
                    <th className="py-3 px-4 text-center">Total Hours Logged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {productivityData.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 flex items-center gap-2.5">
                        <Avatar name={item.name} color={item.avatar_color} size="sm" />
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                            {item.name}
                          </span>
                          <span className="text-[10px] text-slate-400">{item.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize text-slate-600 dark:text-slate-400">
                        {item.role}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-brand-600 dark:text-brand-400">
                        {item.completed_tasks}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {item.hours_logged}h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Time Distribution */}
      {activeTab === 'time' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
              Time Spent Distribution (Hours)
            </h3>
            {timeByProject.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400">
                No logged hours recorded yet.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={timeByProject}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={3}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {timeByProject.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val) => `${val} hours`}
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                        border: 'none'
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          <Card className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4">
                Project Time Allocation Breakdown
              </h3>
              <div className="space-y-3">
                {timeByProject.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No time entries recorded for projects.
                  </div>
                ) : (
                  timeByProject.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: item.color || CHART_COLORS[idx % CHART_COLORS.length] }}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {item.hours} hrs
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
              Total Recorded Hours: <strong className="text-slate-900 dark:text-slate-100 font-bold">{timeByProject.reduce((s, p) => s + p.hours, 0).toFixed(1)} hrs</strong>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
export default ReportsPage;
