import React, { useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  LayoutList, Kanban, Calendar, Info, Plus, Settings, Users,
  ArrowLeft, Archive, CheckCircle2, AlertTriangle, UserPlus
} from 'lucide-react';
import { projectService } from '../../services/projectService.js';
import { taskService } from '../../services/taskService.js';
import { teamService } from '../../services/teamService.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ProjectOverviewTab } from './ProjectOverviewTab.jsx';
import { KanbanBoard } from '../../components/tasks/KanbanBoard.jsx';
import { TaskListView } from '../../components/tasks/TaskListView.jsx';
import { TaskTimelineView } from '../../components/tasks/TaskTimelineView.jsx';
import { TaskDrawer } from '../../components/tasks/TaskDrawer.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';

export function ProjectDetailPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();

  const activeTab = searchParams.get('tab') || 'board';
  const selectedTaskId = searchParams.get('taskId');

  const setTab = (tab) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', tab);
      return next;
    });
  };

  const openTask = (taskId) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('taskId', taskId);
      return next;
    });
  };

  const closeTask = () => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('taskId');
      return next;
    });
  };

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // Forms state
  const [createTaskForm, setCreateTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    due_date: ''
  });

  // Queries
  const { data: project, isLoading: isProjectLoading, isError } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectService.getProject(id)
  });

  const { data: tasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => taskService.listProjectTasks(id)
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.listUsers({ limit: 100 }).then(r => r.users),
    enabled: isMembersModalOpen
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.listTeams().then(r => r.teams),
    enabled: isEditModalOpen
  });

  // Mutations
  const updateProjectMutation = useMutation({
    mutationFn: (data) => projectService.updateProject(id, data),
    onSuccess: () => {
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('Project updated successfully', 'success');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to update project', 'error');
    }
  });

  const archiveMutation = useMutation({
    mutationFn: () => projectService.archiveProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('Project archived successfully', 'info');
    }
  });

  const restoreMutation = useMutation({
    mutationFn: () => projectService.restoreProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('Project restored successfully', 'success');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => projectService.deleteProject(id),
    onSuccess: () => {
      navigate('/projects');
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('Project permanently deleted', 'info');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Cannot delete project', 'error');
    }
  });

  const saveAsTemplateMutation = useMutation({
    mutationFn: (data) => projectService.saveAsTemplate(id, data),
    onSuccess: () => {
      showToast('Project successfully saved as template', 'success');
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to save template', 'error');
    }
  });

  const quickAddTaskMutation = useMutation({
    mutationFn: ({ status, title }) => taskService.createTask(id, { status, title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to create task', 'error');
    }
  });

  const moveTaskMutation = useMutation({
    mutationFn: ({ taskId, data }) => taskService.moveTask(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to move task', 'error');
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
    }
  });

  const toggleTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }) => taskService.updateTask(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', id] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId) => projectService.addMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      showToast('Member added to project', 'success');
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId) => projectService.removeMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      showToast('Member removed from project', 'info');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to remove member', 'error');
    }
  });

  const addTeamMembersMutation = useMutation({
    mutationFn: (teamId) => projectService.addTeamMembers(id, teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      showToast('Team members successfully added', 'success');
    }
  });

  if (isProjectLoading || isTasksLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
        <div className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded" />
        <div className="h-96 bg-slate-100 dark:bg-slate-800/40 rounded-2xl" />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-12 text-center max-w-md mx-auto">
        <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Project Not Found</h2>
        <p className="text-xs text-slate-500 mb-6">
          This project may have been deleted or you do not have permission to access it.
        </p>
        <Link to="/projects">
          <Button size="sm" variant="secondary">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const isArchived = project.status === 'archived';
  const existingMemberIds = project.members?.map(m => m.id) || [];
  const nonMembers = allUsers.filter(u => !existingMemberIds.includes(u.id));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Breadcrumb & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/projects"
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-md shadow-sm"
              style={{ backgroundColor: project.color }}
            />
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {!isArchived && (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreateTaskModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Task
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsMembersModalOpen(true)}
            className="gap-1.5"
          >
            <Users className="w-4 h-4" /> Members ({project.members?.length || 0})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsEditModalOpen(true)}
            className="p-2"
            title="Project Settings"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Archived Warning Banner */}
      {isArchived && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-800 dark:text-amber-200">
          <div className="flex items-center gap-2 font-medium">
            <Archive className="w-4 h-4" />
            This project is archived and read-only.
          </div>
          <Button
            size="xs"
            variant="secondary"
            onClick={() => restoreMutation.mutate()}
            className="text-amber-700"
          >
            Restore Project
          </Button>
        </div>
      )}

      {/* View Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setTab('board')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'board'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Kanban className="w-3.5 h-3.5" /> Board (Kanban)
        </button>

        <button
          onClick={() => setTab('list')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'list'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutList className="w-3.5 h-3.5" /> List View
        </button>

        <button
          onClick={() => setTab('timeline')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'timeline'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" /> Timeline
        </button>

        <button
          onClick={() => setTab('overview')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Info className="w-3.5 h-3.5" /> Overview
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'board' && (
        <KanbanBoard
          tasks={tasks}
          onSelectTask={openTask}
          onMoveTask={(taskId, data) => moveTaskMutation.mutate({ taskId, data })}
          onQuickAddTask={(status, title) => quickAddTaskMutation.mutate({ status, title })}
        />
      )}

      {activeTab === 'list' && (
        <TaskListView
          tasks={tasks}
          onSelectTask={openTask}
          onToggleStatus={(taskId, status) => toggleTaskStatusMutation.mutate({ taskId, status })}
          onQuickAddTask={(status, title) => quickAddTaskMutation.mutate({ status, title })}
        />
      )}

      {activeTab === 'timeline' && (
        <TaskTimelineView
          tasks={tasks}
          project={project}
          onSelectTask={openTask}
        />
      )}

      {activeTab === 'overview' && (
        <ProjectOverviewTab
          project={project}
          user={user}
          onUpdateProject={(data) => updateProjectMutation.mutate(data)}
          onArchiveProject={() => archiveMutation.mutate()}
          onRestoreProject={() => restoreMutation.mutate()}
          onDeleteProject={() => setIsDeleteDialogOpen(true)}
          onSaveAsTemplate={(data) => saveAsTemplateMutation.mutate(data)}
          onOpenMembersModal={() => setIsMembersModalOpen(true)}
        />
      )}

      {/* Task Drawer */}
      <TaskDrawer
        taskId={selectedTaskId}
        projectId={id}
        isOpen={!!selectedTaskId}
        onClose={closeTask}
        onTaskDeleted={closeTask}
      />

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Project"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            updateProjectMutation.mutate({
              name: formData.get('name'),
              description: formData.get('description') || null,
              color: formData.get('color'),
              team_id: formData.get('team_id') ? Number(formData.get('team_id')) : null,
              start_date: formData.get('start_date') || null,
              due_date: formData.get('due_date') || null
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project Name
            </label>
            <Input name="name" defaultValue={project.name} required />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              defaultValue={project.description || ''}
              className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  name="color"
                  defaultValue={project.color}
                  className="w-8 h-8 rounded border-0 cursor-pointer p-0"
                />
                <span className="text-xs font-mono text-slate-500">{project.color}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <Input type="date" name="start_date" defaultValue={project.start_date || ''} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <Input type="date" name="due_date" defaultValue={project.due_date || ''} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={updateProjectMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Members Management Modal */}
      <Modal
        isOpen={isMembersModalOpen}
        onClose={() => setIsMembersModalOpen(false)}
        title="Manage Project Members"
      >
        <div className="space-y-4">
          {/* Add member dropdown */}
          {nonMembers.length > 0 && (
            <div className="flex gap-2">
              <select
                id="select-member-to-add"
                className="flex-1 text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2"
              >
                <option value="">Select workspace member to add...</option>
                {nonMembers.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const sel = document.getElementById('select-member-to-add');
                  if (sel?.value) {
                    addMemberMutation.mutate(Number(sel.value));
                    sel.value = '';
                  }
                }}
              >
                Add
              </Button>
            </div>
          )}

          {/* Current members list */}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {project.members?.map(m => (
              <div
                key={m.id}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs"
                    style={{ backgroundColor: m.avatar_color || '#4F46E5' }}
                  >
                    {m.name.charAt(0)}
                  </span>
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{m.name}</div>
                    <div className="text-[10px] text-slate-400 capitalize">{m.role}</div>
                  </div>
                </div>

                {project.owner_id === m.id ? (
                  <span className="text-[10px] text-primary-500 font-bold bg-primary-50 dark:bg-primary-950 px-2 py-0.5 rounded">
                    Owner
                  </span>
                ) : (
                  <button
                    onClick={() => removeMemberMutation.mutate(m.id)}
                    className="text-xs text-rose-500 hover:text-rose-700 font-medium px-2 py-1"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Hard Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Hard Delete Project?"
        message="This will permanently delete this project and all its tasks. If time entries have been logged on this project, deletion will be rejected to protect payroll/timesheet integrity."
        confirmText="Permanently Delete"
        variant="danger"
      />

      {/* New Task Modal */}
      <Modal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        title="Create New Task"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            taskService.createTask(id, createTaskForm).then(() => {
              setIsCreateTaskModalOpen(false);
              setCreateTaskForm({ title: '', description: '', priority: 'medium', due_date: '' });
              queryClient.invalidateQueries({ queryKey: ['tasks', id] });
              queryClient.invalidateQueries({ queryKey: ['project', id] });
              showToast('Task created successfully', 'success');
            }).catch(err => {
              showToast(err.response?.data?.error || 'Failed to create task', 'error');
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Title
            </label>
            <Input
              value={createTaskForm.title}
              onChange={(e) => setCreateTaskForm(p => ({ ...p, title: e.target.value }))}
              placeholder="e.g. Design authentication modal"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={createTaskForm.description}
              onChange={(e) => setCreateTaskForm(p => ({ ...p, description: e.target.value }))}
              className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
              placeholder="Detailed instructions..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Priority
              </label>
              <select
                value={createTaskForm.priority}
                onChange={(e) => setCreateTaskForm(p => ({ ...p, priority: e.target.value }))}
                className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={createTaskForm.due_date}
                onChange={(e) => setCreateTaskForm(p => ({ ...p, due_date: e.target.value || null }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateTaskModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" disabled={!createTaskForm.title.trim()}>
              Create Task
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
