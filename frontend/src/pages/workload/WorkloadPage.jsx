import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users2, AlertTriangle, CheckCircle, Clock, ArrowRightLeft,
  Filter, Layers, UserCheck, ChevronRight
} from 'lucide-react';
import { planningService } from '../../services/planningService.js';
import { teamService } from '../../services/teamService.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { PriorityBadge } from '../../components/ui/PriorityBadge.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { TaskDrawer } from '../../components/tasks/TaskDrawer.jsx';

export function WorkloadPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [reassignModal, setReassignModal] = useState({
    isOpen: false,
    task: null,
    fromUserId: null,
    targetUserId: ''
  });

  const canManage = user?.role === 'admin' || user?.role === 'manager';

  // Fetch workload data
  const { data: workloadData, isLoading, refetch } = useQuery({
    queryKey: ['workload', selectedTeamId],
    queryFn: () => planningService.getWorkload(selectedTeamId ? { teamId: selectedTeamId } : {})
  });

  // Fetch teams for filtering
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.listTeams()
  });

  // Fetch users for reassignment
  const { data: usersData } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => userService.listUsers({ limit: 100 }),
    enabled: canManage
  });

  const allUsers = usersData?.users || [];

  // Mutation for reassigning task
  const reassignMutation = useMutation({
    mutationFn: ({ taskId, fromUserId, toUserId }) =>
      planningService.reassignTask(taskId, { fromUserId, toUserId: Number(toUserId) }),
    onSuccess: () => {
      success('Task Reassigned', 'The task has been successfully reassigned.');
      setReassignModal({ isOpen: false, task: null, fromUserId: null, targetUserId: '' });
      queryClient.invalidateQueries({ queryKey: ['workload'] });
      queryClient.invalidateQueries({ queryKey: ['task'] });
    },
    onError: (err) => {
      toastError('Reassign Failed', err.response?.data?.message || err.message);
    }
  });

  const handleOpenReassign = (task, fromUserId, e) => {
    e.stopPropagation();
    setReassignModal({
      isOpen: true,
      task,
      fromUserId,
      targetUserId: ''
    });
  };

  const handleConfirmReassign = (e) => {
    e.preventDefault();
    if (!reassignModal.targetUserId) {
      toastError('Selection Required', 'Please select a member to reassign this task to.');
      return;
    }
    reassignMutation.mutate({
      taskId: reassignModal.task.id,
      fromUserId: reassignModal.fromUserId,
      toUserId: reassignModal.targetUserId
    });
  };

  const members = workloadData?.workload || [];
  const totalMembers = workloadData?.total_members || members.length;
  const overloadedCount = workloadData?.overloaded_count || members.filter(m => m.status === 'overloaded').length;
  const busyCount = members.filter(m => m.status === 'busy').length;
  const normalCount = members.filter(m => m.status === 'normal').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold">
            <Users2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Team Workload & Capacity
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monitor active task allocation and rebalance workloads across team members
            </p>
          </div>
        </div>

        {/* Team filter dropdown */}
        <div className="flex items-center gap-3">
          <div className="w-48">
            <Select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="text-xs"
            >
              <option value="">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Members</span>
            <UserCheck className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalMembers}
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Healthy Capacity (&le;80%)</span>
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {normalCount}
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">High Load (80-100%)</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {busyCount}
          </div>
        </Card>

        <Card className={`p-4 border ${overloadedCount > 0 ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-900' : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">Overloaded (&gt;100%)</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {overloadedCount}
          </div>
        </Card>
      </div>

      {/* Member Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : members.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Users2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No team members found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No members found for the selected team filter.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {members.map((item) => {
            const u = item.user;
            const isOverloaded = item.status === 'overloaded';
            const isBusy = item.status === 'busy';

            let barColor = 'bg-emerald-500';
            let badgeVariant = 'success';
            if (isOverloaded) {
              barColor = 'bg-rose-500';
              badgeVariant = 'error';
            } else if (isBusy) {
              barColor = 'bg-amber-500';
              badgeVariant = 'warning';
            }

            return (
              <Card
                key={u.id}
                className="p-5 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:shadow-subtle transition-all"
              >
                <div>
                  {/* Top user profile header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} color={u.avatar_color} size="md" />
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {u.name}
                          </h3>
                          <span className="text-[10px] uppercase font-semibold text-slate-400 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                            {u.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{u.email}</p>
                      </div>
                    </div>

                    <Badge variant={badgeVariant} size="sm" className="capitalize font-semibold">
                      {item.status} ({item.utilization_percentage}%)
                    </Badge>
                  </div>

                  {/* Utilization Progress Bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Allocated: {item.allocated_hours}h</span>
                      <span>Weekly Capacity: {u.capacity_hours}h</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(item.utilization_percentage, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Task list preview */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      <span>Active Tasks ({item.task_count})</span>
                    </div>

                    {item.tasks.length === 0 ? (
                      <div className="text-xs text-slate-400 dark:text-slate-500 italic py-2">
                        No active tasks assigned
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {item.tasks.map((task) => (
                          <div
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="group flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 cursor-pointer transition-all text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: task.project_color || '#4F46E5' }}
                              />
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-brand-600 dark:group-hover:text-brand-400">
                                {task.title}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                ({task.project_name})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <PriorityBadge priority={task.priority} size="xs" />
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {task.estimated_minutes ? `${Math.round(task.estimated_minutes / 60)}h` : '1h'}
                              </span>

                              {/* Reassign action button for Managers/Admins */}
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={(e) => handleOpenReassign(task, u.id, e)}
                                  title="Reassign Task"
                                  className="p-1 rounded text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Task Drawer */}
      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskDeleted={() => {
            setSelectedTaskId(null);
            queryClient.invalidateQueries({ queryKey: ['workload'] });
          }}
        />
      )}

      {/* Reassign Modal */}
      {reassignModal.isOpen && (
        <Modal
          isOpen={reassignModal.isOpen}
          onClose={() => setReassignModal({ isOpen: false, task: null, fromUserId: null, targetUserId: '' })}
          title="Reassign Task"
          size="sm"
        >
          <form onSubmit={handleConfirmReassign} className="space-y-4">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Reassign <strong className="text-slate-900 dark:text-slate-100">{reassignModal.task?.title}</strong> to another team member to optimize workload balance.
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assign to Member *
              </label>
              <Select
                value={reassignModal.targetUserId}
                onChange={(e) => setReassignModal(prev => ({ ...prev, targetUserId: e.target.value }))}
                required
                className="text-xs"
              >
                <option value="">Select team member...</option>
                {allUsers
                  .filter(m => m.id !== reassignModal.fromUserId && m.is_active)
                  .map(m => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role}) - Cap: {m.capacity_hours_per_week || 40}h
                    </option>
                  ))}
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReassignModal({ isOpen: false, task: null, fromUserId: null, targetUserId: '' })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={reassignMutation.isPending || !reassignModal.targetUserId}
              >
                {reassignMutation.isPending ? 'Reassigning...' : 'Confirm Reassign'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export default WorkloadPage;
