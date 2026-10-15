import React, { useState } from 'react';
import {
  Calendar, CheckCircle2, Clock, Users, Shield, Archive, RotateCcw,
  Trash2, Copy, Edit3, Plus, UserPlus
} from 'lucide-react';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { StatusBadge } from '../../components/ui/StatusBadge.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';

export function ProjectOverviewTab({
  project,
  user,
  onUpdateProject,
  onArchiveProject,
  onRestoreProject,
  onDeleteProject,
  onSaveAsTemplate,
  onOpenMembersModal
}) {
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState(`${project.name} Template`);
  const [templateDesc, setTemplateDesc] = useState('');

  const isArchived = project.status === 'archived';
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canManage = isAdmin || project.owner_id === user?.id || isManager;

  const handleTemplateSubmit = (e) => {
    e.preventDefault();
    if (templateName.trim()) {
      onSaveAsTemplate({ name: templateName.trim(), description: templateDesc.trim() || null });
      setIsTemplateModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Progress Card */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              Overall Progress
            </div>
            <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
              {project.progress_percentage}%
            </div>
          </div>
          <ProgressBar value={project.progress_percentage} color="primary" size="md" />
        </div>

        {/* Total Tasks Card */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Total Tasks
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
            {project.total_tasks}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="text-emerald-500 font-semibold">{project.done_tasks} done</span>
            <span>•</span>
            <span className="text-blue-500 font-semibold">{project.in_progress_tasks} in progress</span>
          </div>
        </div>

        {/* Time Estimate Card */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Estimated Effort
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-white mb-2">
            {Math.round((project.total_estimated_minutes || 0) / 60)} hrs
          </div>
          <div className="text-xs text-slate-400">
            Across {project.total_tasks} total tasks
          </div>
        </div>

        {/* Team & Owner Card */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Project Lead
          </div>
          <div className="flex items-center gap-2.5 mt-2">
            <Avatar name={project.owner_name} size="sm" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-white">{project.owner_name}</div>
              <div className="text-[11px] text-slate-400">Project Owner</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Description & Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Description */}
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Description & Scope
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {project.description || 'No description provided for this project.'}
            </p>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">Start Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {project.start_date || 'Not set'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">Due Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {project.due_date || 'Not set'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">Status</span>
                <StatusBadge status={project.status} />
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          {canManage && (
            <div className="p-5 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsTemplateModalOpen(true)}
                  className="gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> Save as Template
                </Button>

                {isArchived ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onRestoreProject}
                    className="gap-1.5 text-primary-600"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restore Project
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={onArchiveProject}
                    className="gap-1.5 text-amber-600"
                  >
                    <Archive className="w-3.5 h-3.5" /> Archive Project
                  </Button>
                )}
              </div>

              {isAdmin && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={onDeleteProject}
                  className="gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hard Delete Project
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Right Col: Team Members */}
        <div className="space-y-4">
          <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Users className="w-4 h-4" /> Members ({project.members?.length || 0})
              </h3>
              {canManage && (
                <button
                  onClick={onOpenMembersModal}
                  className="text-xs text-primary-600 hover:text-primary-700 font-semibold flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Manage
                </button>
              )}
            </div>

            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {project.members?.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} color={m.avatar_color} size="sm" />
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{m.name}</div>
                      <div className="text-[10px] text-slate-400 capitalize">{m.role}</div>
                    </div>
                  </div>
                  {project.owner_id === m.id && (
                    <span className="text-[10px] bg-primary-50 dark:bg-primary-950 text-primary-600 dark:text-primary-400 font-bold px-2 py-0.5 rounded-full">
                      Owner
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Save As Template Modal */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Save Project as Template"
      >
        <form onSubmit={handleTemplateSubmit} className="space-y-4">
          <p className="text-xs text-slate-500">
            This will create a reusable project template containing all current tasks, sub-tasks, and label configurations with relative due dates.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Template Name
            </label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={templateDesc}
              onChange={(e) => setTemplateDesc(e.target.value)}
              className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5"
              placeholder="e.g. Standard 2-week sprint template for platform work..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsTemplateModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Template
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
