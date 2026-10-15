import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FolderKanban, Plus, Search, Calendar, Users, CheckCircle2,
  Copy, Filter, ArrowRight, Clock, AlertCircle
} from 'lucide-react';
import { projectService } from '../../services/projectService.js';
import { templateService } from '../../services/templateService.js';
import { teamService } from '../../services/teamService.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  // Forms
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    color: '#4F46E5',
    start_date: '',
    due_date: '',
    member_ids: []
  });

  const [templateForm, setTemplateForm] = useState({
    template_id: '',
    name: '',
    color: '#4F46E5',
    start_date: new Date().toISOString().split('T')[0],
    member_ids: []
  });

  const canCreate = user?.role === 'admin' || user?.role === 'manager';

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['projects', statusFilter, teamFilter, search],
    queryFn: () => projectService.listProjects({
      status: statusFilter === 'all' ? undefined : statusFilter,
      teamId: teamFilter || undefined,
      search: search || undefined
    })
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.listTeams().then(r => r.teams)
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templateService.listTemplates(),
    enabled: isTemplateModalOpen
  });

  const { data: usersData } = useQuery({
    queryKey: ['workspace-users-projects'],
    queryFn: () => userService.listUsers({ pageSize: 100 }),
    enabled: isCreateModalOpen || isTemplateModalOpen
  });
  const workspaceUsers = usersData?.users || [];

  const toggleCreateMember = (userId) => {
    setCreateForm(prev => {
      const exists = prev.member_ids.includes(userId);
      return {
        ...prev,
        member_ids: exists
          ? prev.member_ids.filter(id => id !== userId)
          : [...prev.member_ids, userId]
      };
    });
  };

  const toggleTemplateMember = (userId) => {
    setTemplateForm(prev => {
      const exists = prev.member_ids.includes(userId);
      return {
        ...prev,
        member_ids: exists
          ? prev.member_ids.filter(id => id !== userId)
          : [...prev.member_ids, userId]
      };
    });
  };

  // Mutations
  const createProjectMutation = useMutation({
    mutationFn: (newProj) => projectService.createProject(newProj),
    onSuccess: () => {
      setIsCreateModalOpen(false);
      setCreateForm({ name: '', description: '', color: '#4F46E5', start_date: '', due_date: '', member_ids: [] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('Project created successfully', 'success');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to create project', 'error');
    }
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: ({ templateId, data }) => templateService.createProjectFromTemplate(templateId, data),
    onSuccess: () => {
      setIsTemplateModalOpen(false);
      setTemplateForm({ template_id: '', name: '', color: '#4F46E5', start_date: new Date().toISOString().split('T')[0], member_ids: [] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      showToast('Project created from template successfully', 'success');
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to create project from template', 'error');
    }
  });

  const projects = data?.projects || [];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <FolderKanban className="w-7 h-7 text-primary-500" />
            Projects
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Organize roadmaps, sprints, and cross-functional initiatives.
          </p>
        </div>

        {canCreate && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsTemplateModalOpen(true)}
              className="gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" /> From Template
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Project
            </Button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {['all', 'active', 'on_hold', 'completed', 'archived'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all capitalize whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Right side search & team filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border-0 rounded-xl text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="text-xs bg-slate-50 dark:bg-slate-800 border-0 rounded-xl py-1.5 px-3 text-slate-700 dark:text-slate-300 focus:ring-primary-500"
          >
            <option value="">All Teams</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-56 bg-slate-100 dark:bg-slate-800/40 rounded-2xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <FolderKanban className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Projects Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {search || statusFilter !== 'all' || teamFilter
              ? 'Try adjusting your search criteria or active filters.'
              : 'Get started by creating your team\'s first project or launching from a template.'}
          </p>
          {canCreate && (
            <Button size="sm" variant="primary" onClick={() => setIsCreateModalOpen(true)} className="mt-2">
              <Plus className="w-4 h-4 mr-1" /> Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(proj => {
            const isOverdue = proj.due_date && proj.status !== 'completed' && proj.due_date < new Date().toISOString().split('T')[0];

            return (
              <Link
                key={proj.id}
                to={`/projects/${proj.id}`}
                className="group p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3 h-3 text-brand-500" />
                      {proj.member_count || 1} {proj.member_count === 1 ? 'Member' : 'Members'}
                    </span>
                    <StatusBadge status={proj.status} />
                  </div>

                  {/* Name & Color bar */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <span
                      className="w-3.5 h-3.5 rounded-md mt-0.5 shrink-0 shadow-xs"
                      style={{ backgroundColor: proj.color }}
                    />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                      {proj.name}
                    </h3>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-4 leading-relaxed">
                    {proj.description || 'No project description provided.'}
                  </p>
                </div>

                <div>
                  {/* Progress Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                      <span>{proj.done_tasks}/{proj.total_tasks} Tasks Done</span>
                      <span>{proj.progress_percentage}%</span>
                    </div>
                    <ProgressBar value={proj.progress_percentage} color="primary" size="sm" />
                  </div>

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>{proj.member_count} members</span>
                    </div>

                    {proj.due_date && (
                      <div className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-500'}`}>
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{proj.due_date}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createProjectMutation.mutate({
              name: createForm.name,
              description: createForm.description || null,
              color: createForm.color,
              start_date: createForm.start_date || null,
              due_date: createForm.due_date || null,
              member_ids: createForm.member_ids
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Project Name
            </label>
            <Input
              value={createForm.name}
              onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Website Redesign 2026"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm(p => ({ ...p, description: e.target.value }))}
              className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
              placeholder="Outline goals, deliverables, and timeline..."
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={createForm.color}
                onChange={(e) => setCreateForm(p => ({ ...p, color: e.target.value }))}
                className="w-8 h-8 rounded border-0 cursor-pointer p-0"
              />
              <span className="text-xs font-mono text-slate-500">{createForm.color}</span>
            </div>
          </div>

          {/* Add Project Members selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Add Project Members
              </label>
              <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold">
                {createForm.member_ids.length} selected
              </span>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
              {workspaceUsers.length === 0 ? (
                <div className="text-xs text-slate-400 p-2 text-center">No workspace members found</div>
              ) : (
                workspaceUsers.map(u => {
                  const isSelected = createForm.member_ids.includes(u.id);
                  const isOwner = u.id === user?.id;
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected || isOwner
                          ? 'bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 font-medium'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={u.name} color={u.avatar_color} size="xs" />
                        <span className="text-xs truncate">{u.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">({u.role})</span>
                        {isOwner && (
                          <span className="text-[9px] bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 px-1.5 py-0.2 rounded font-bold">
                            Lead / Creator
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected || isOwner}
                        disabled={isOwner}
                        onChange={() => toggleCreateMember(u.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Select workspace members who should participate in this project.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date
              </label>
              <Input
                type="date"
                value={createForm.start_date}
                onChange={(e) => setCreateForm(p => ({ ...p, start_date: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Due Date
              </label>
              <Input
                type="date"
                value={createForm.due_date}
                onChange={(e) => setCreateForm(p => ({ ...p, due_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={createProjectMutation.isPending}>
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create From Template Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Create Project from Template"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!templateForm.template_id) return;
            createFromTemplateMutation.mutate({
              templateId: Number(templateForm.template_id),
              data: {
                name: templateForm.name,
                color: templateForm.color,
                start_date: templateForm.start_date,
                member_ids: templateForm.member_ids
              }
            });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Select Template
            </label>
            <select
              value={templateForm.template_id}
              onChange={(e) => {
                const tplId = e.target.value;
                const chosen = templates.find(t => String(t.id) === tplId);
                setTemplateForm(p => ({
                  ...p,
                  template_id: tplId,
                  name: chosen ? `${chosen.name} - Instance` : p.name
                }));
              }}
              required
              className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2"
            >
              <option value="">Choose a template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.task_count} tasks, {t.subtask_count} subtasks)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              New Project Name
            </label>
            <Input
              value={templateForm.name}
              onChange={(e) => setTemplateForm(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Sprint 24 Platform"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Start Date
            </label>
            <Input
              type="date"
              value={templateForm.start_date}
              onChange={(e) => setTemplateForm(p => ({ ...p, start_date: e.target.value }))}
              required
            />
          </div>

          {/* Add Project Members selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Add Project Members
              </label>
              <span className="text-[11px] text-brand-600 dark:text-brand-400 font-semibold">
                {templateForm.member_ids.length} selected
              </span>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
              {workspaceUsers.length === 0 ? (
                <div className="text-xs text-slate-400 p-2 text-center">No workspace members found</div>
              ) : (
                workspaceUsers.map(u => {
                  const isSelected = templateForm.member_ids.includes(u.id);
                  const isOwner = u.id === user?.id;
                  return (
                    <label
                      key={u.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                        isSelected || isOwner
                          ? 'bg-brand-50/70 dark:bg-brand-950/40 text-brand-900 dark:text-brand-200 font-medium'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar name={u.name} color={u.avatar_color} size="xs" />
                        <span className="text-xs truncate">{u.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">({u.role})</span>
                        {isOwner && (
                          <span className="text-[9px] bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 px-1.5 py-0.2 rounded font-bold">
                            Lead / Creator
                          </span>
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={isSelected || isOwner}
                        disabled={isOwner}
                        onChange={() => toggleTemplateMember(u.id)}
                        className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Select workspace members who should participate in this template project.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!templateForm.template_id || !templateForm.name.trim()}
              loading={createFromTemplateMutation.isPending}
            >
              Instantiate Project
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
