import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X, Calendar, Clock, CheckSquare, Plus, Trash2, Tag, UserPlus,
  Repeat, ArrowRight, AlertCircle, Undo2, CheckCircle2, ChevronDown, MessageSquare
} from 'lucide-react';
import { taskService } from '../../services/taskService.js';
import { labelService } from '../../services/labelService.js';
import { projectService } from '../../services/projectService.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Drawer } from '../ui/Drawer.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { StatusBadge } from '../ui/StatusBadge.jsx';
import { PriorityBadge } from '../ui/PriorityBadge.jsx';
import { Button } from '../ui/Button.jsx';
import { Modal } from '../ui/Modal.jsx';
import { Input } from '../ui/Input.jsx';
import { Select } from '../ui/Select.jsx';
import { TaskCommentsSection } from './TaskCommentsSection.jsx';
import { TaskTimeTab } from './TaskTimeTab.jsx';

export function TaskDrawer({ taskId, projectId, isOpen, onClose, onTaskDeleted }) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('details');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [isRecurrenceModalOpen, setIsRecurrenceModalOpen] = useState(false);
  const [recurrenceForm, setRecurrenceForm] = useState({
    frequency: 'weekly',
    interval_value: 1,
    starts_on: new Date().toISOString().split('T')[0],
    ends_on: ''
  });

  // Fetch full task details
  const { data: task, isLoading, isError } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => taskService.getTask(taskId),
    enabled: !!taskId && isOpen
  });

  // Fetch project members for assignee selection
  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId || task?.project_id],
    queryFn: () => projectService.listMembers(projectId || task?.project_id),
    enabled: !!(projectId || task?.project_id) && isOpen
  });

  // Fetch workspace labels
  const { data: allLabels = [] } = useQuery({
    queryKey: ['labels'],
    queryFn: () => labelService.listLabels(),
    enabled: isOpen
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: (data) => taskService.updateTask(taskId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['task', taskId], (old) => ({ ...old, ...updated }));
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to update task', 'error');
    }
  });

  // Subtask mutations
  const createSubtaskMutation = useMutation({
    mutationFn: (title) => taskService.createSubtask(taskId, { title }),
    onSuccess: () => {
      setNewSubtaskTitle('');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ id, is_completed }) => taskService.updateSubtask(id, { is_completed }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  const deleteSubtaskMutation = useMutation({
    mutationFn: (id) => taskService.deleteSubtask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  // Assignee mutations
  const addAssigneeMutation = useMutation({
    mutationFn: (userId) => taskService.addAssignee(taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    }
  });

  const removeAssigneeMutation = useMutation({
    mutationFn: (userId) => taskService.removeAssignee(taskId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    }
  });

  // Labels mutation
  const setLabelsMutation = useMutation({
    mutationFn: (labelIds) => taskService.setTaskLabels(taskId, labelIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  });

  // Recurrence mutations
  const setRecurrenceMutation = useMutation({
    mutationFn: (data) => taskService.setRecurrence(taskId, data),
    onSuccess: () => {
      setIsRecurrenceModalOpen(false);
      showToast('Recurrence rule applied successfully', 'success');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
    onError: (err) => {
      showToast(err.response?.data?.error || 'Failed to set recurrence rule', 'error');
    }
  });

  const deleteRecurrenceMutation = useMutation({
    mutationFn: (ruleId) => taskService.deleteRecurrence(ruleId),
    onSuccess: () => {
      showToast('Recurrence rule removed', 'info');
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    }
  });

  // Delete task mutation with Undo
  const deleteTaskMutation = useMutation({
    mutationFn: () => taskService.deleteTask(taskId),
    onSuccess: () => {
      onClose();
      if (onTaskDeleted) onTaskDeleted(taskId);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['my-tasks'] });

      showToast(
        <div className="flex items-center justify-between gap-4">
          <span>Task deleted</span>
          <button
            onClick={() => {
              taskService.restoreTask(taskId).then(() => {
                queryClient.invalidateQueries({ queryKey: ['tasks'] });
                queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
                showToast('Task restored successfully', 'success');
              });
            }}
            className="flex items-center gap-1 font-semibold text-primary-400 hover:text-primary-300 underline text-xs"
          >
            <Undo2 className="w-3.5 h-3.5" /> Undo
          </button>
        </div>,
        'info',
        6000
      );
    }
  });

  if (!isOpen) return null;

  const currentLabelIds = task?.labels?.map(l => l.id) || [];
  const unassignedMembers = members.filter(m => !task?.assignees?.some(a => a.id === m.id));
  const unselectedLabels = allLabels.filter(l => !currentLabelIds.includes(l.id));

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        title={
          task ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">TASK-{task.id}</span>
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
          ) : 'Task Details'
        }
        size="lg"
      >
        {isLoading ? (
          <div className="p-6 space-y-4 animate-pulse">
            <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-3/4" />
            <div className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
            <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded w-1/2" />
          </div>
        ) : isError || !task ? (
          <div className="p-8 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <p>Task could not be loaded or has been deleted.</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header / Tabs */}
            <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-2 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    activeTab === 'details'
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('subtasks')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === 'subtasks'
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  Sub-tasks ({task.subtasks?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('comments')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === 'comments'
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comments
                </button>
                <button
                  onClick={() => setActiveTab('time')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                    activeTab === 'time'
                      ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  Time
                </button>
              </div>

              <button
                onClick={() => deleteTaskMutation.mutate()}
                className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2.5 py-1.5 rounded flex items-center gap-1"
                title="Delete Task"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {activeTab === 'details' && (
                <>
                  {/* Task Title (Inline Editable) */}
                  <div>
                    <input
                      type="text"
                      defaultValue={task.title}
                      onBlur={(e) => {
                        if (e.target.value.trim() && e.target.value !== task.title) {
                          updateTaskMutation.mutate({ title: e.target.value.trim() });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                      }}
                      className="w-full text-xl font-bold bg-transparent border-0 border-b-2 border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-primary-500 focus:ring-0 text-slate-900 dark:text-white px-0 py-1 transition-colors"
                      placeholder="Task Title..."
                    />
                  </div>

                  {/* Properties Grid */}
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    {/* Status */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Status
                      </label>
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskMutation.mutate({ status: e.target.value })}
                        className="w-full text-xs font-medium rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-1.5 px-2.5 focus:ring-primary-500"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    </div>

                    {/* Priority */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                        Priority
                      </label>
                      <select
                        value={task.priority}
                        onChange={(e) => updateTaskMutation.mutate({ priority: e.target.value })}
                        className="w-full text-xs font-medium rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-1.5 px-2.5 focus:ring-primary-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    {/* Start Date */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Start Date
                      </label>
                      <input
                        type="date"
                        defaultValue={task.start_date || ''}
                        onChange={(e) => updateTaskMutation.mutate({ start_date: e.target.value || null })}
                        className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-1.5 px-2.5"
                      />
                    </div>

                    {/* Due Date */}
                    <div>
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-rose-500" /> Due Date
                      </label>
                      <input
                        type="date"
                        defaultValue={task.due_date || ''}
                        onChange={(e) => updateTaskMutation.mutate({ due_date: e.target.value || null })}
                        className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-1.5 px-2.5"
                      />
                    </div>

                    {/* Estimated Time (Minutes) */}
                    <div className="col-span-2">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Estimated Minutes
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="15"
                        defaultValue={task.estimated_minutes || ''}
                        onBlur={(e) => {
                          const val = e.target.value === '' ? null : Number(e.target.value);
                          if (val !== task.estimated_minutes) {
                            updateTaskMutation.mutate({ estimated_minutes: val });
                          }
                        }}
                        className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 py-1.5 px-2.5"
                        placeholder="e.g. 120 (2 hours)"
                      />
                    </div>
                  </div>

                  {/* Assignees Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Assignees
                      </label>
                      {unassignedMembers.length > 0 && (
                        <div className="relative group">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                addAssigneeMutation.mutate(Number(e.target.value));
                                e.target.value = '';
                              }
                            }}
                            className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg py-1 px-2 border-0 cursor-pointer"
                          >
                            <option value="">+ Add Assignee</option>
                            {unassignedMembers.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {task.assignees?.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No assignees yet</span>
                      ) : (
                        task.assignees?.map(a => (
                          <div
                            key={a.id}
                            className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs border border-slate-200 dark:border-slate-700"
                          >
                            <Avatar name={a.name} color={a.avatar_color} size="xs" />
                            <span className="font-medium">{a.name}</span>
                            <button
                              onClick={() => removeAssigneeMutation.mutate(a.id)}
                              className="text-slate-400 hover:text-rose-500 rounded-full p-0.5 ml-1"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Labels Section */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5" /> Labels
                      </label>
                      {unselectedLabels.length > 0 && (
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              const newIds = [...currentLabelIds, Number(e.target.value)];
                              setLabelsMutation.mutate(newIds);
                              e.target.value = '';
                            }
                          }}
                          className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg py-1 px-2 border-0 cursor-pointer"
                        >
                          <option value="">+ Add Label</option>
                          {unselectedLabels.map(l => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {task.labels?.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">No labels</span>
                      ) : (
                        task.labels?.map(l => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold text-white shadow-sm"
                            style={{ backgroundColor: l.color }}
                          >
                            {l.name}
                            <button
                              onClick={() => {
                                const newIds = currentLabelIds.filter(id => id !== l.id);
                                setLabelsMutation.mutate(newIds);
                              }}
                              className="hover:opacity-75"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Recurrence Status & Action */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Repeat className="w-4 h-4 text-primary-500" />
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {task.recurrence_rule ? (
                            <>Repeats {task.recurrence_rule.frequency} (Occurrence #{task.recurrence_sequence})</>
                          ) : (
                            'One-time task'
                          )}
                        </div>
                        {task.recurrence_rule && (
                          <div className="text-[11px] text-slate-400">
                            Next due: {task.recurrence_rule.next_due_date || 'N/A'}
                          </div>
                        )}
                      </div>
                    </div>

                    {task.recurrence_rule ? (
                      <button
                        onClick={() => deleteRecurrenceMutation.mutate(task.recurrence_rule.id)}
                        className="text-xs text-rose-500 hover:text-rose-600 underline font-medium"
                      >
                        Remove Rule
                      </button>
                    ) : (
                      <Button
                        size="xs"
                        variant="secondary"
                        onClick={() => setIsRecurrenceModalOpen(true)}
                      >
                        Set Recurring
                      </Button>
                    )}
                  </div>

                  {/* Description (Inline Editable) */}
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                      Description
                    </label>
                    <textarea
                      rows={4}
                      defaultValue={task.description || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (task.description || '')) {
                          updateTaskMutation.mutate({ description: e.target.value.trim() || null });
                        }
                      }}
                      placeholder="Add detailed task instructions, scope, or notes..."
                      className="w-full text-xs rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-3 focus:ring-primary-500 transition-colors"
                    />
                  </div>
                </>
              )}

              {activeTab === 'subtasks' && (
                <div className="space-y-4">
                  {/* Subtask Add Bar */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newSubtaskTitle.trim()) {
                        createSubtaskMutation.mutate(newSubtaskTitle.trim());
                      }
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add subtask and press Enter..."
                      className="text-xs py-2"
                    />
                    <Button type="submit" size="sm" variant="primary" disabled={!newSubtaskTitle.trim()}>
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </form>

                  {/* Subtask Checklist */}
                  <div className="space-y-2">
                    {task.subtasks?.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs">
                        No sub-tasks yet. Break this task down into bite-sized steps!
                      </div>
                    ) : (
                      task.subtasks?.map(st => (
                        <div
                          key={st.id}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors group"
                        >
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={st.is_completed === 1}
                              onChange={(e) => toggleSubtaskMutation.mutate({ id: st.id, is_completed: e.target.checked ? 1 : 0 })}
                              className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4"
                            />
                            <span className={`text-xs ${st.is_completed === 1 ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}`}>
                              {st.title}
                            </span>
                          </label>

                          <button
                            onClick={() => deleteSubtaskMutation.mutate(st.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="py-2">
                  <TaskCommentsSection taskId={taskId} members={members} />
                </div>
              )}

              {activeTab === 'time' && (
                <div className="py-2">
                  <TaskTimeTab taskId={taskId} />
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {/* Recurrence Configuration Modal */}
      <Modal
        isOpen={isRecurrenceModalOpen}
        onClose={() => setIsRecurrenceModalOpen(false)}
        title="Configure Recurring Task"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setRecurrenceMutation.mutate(recurrenceForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Frequency
            </label>
            <select
              value={recurrenceForm.frequency}
              onChange={(e) => setRecurrenceForm(prev => ({ ...prev, frequency: e.target.value }))}
              className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 p-2"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Interval (Every X {recurrenceForm.frequency === 'daily' ? 'days' : recurrenceForm.frequency === 'weekly' ? 'weeks' : 'months'})
            </label>
            <Input
              type="number"
              min="1"
              value={recurrenceForm.interval_value}
              onChange={(e) => setRecurrenceForm(prev => ({ ...prev, interval_value: Number(e.target.value) }))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Starts On
            </label>
            <Input
              type="date"
              value={recurrenceForm.starts_on}
              onChange={(e) => setRecurrenceForm(prev => ({ ...prev, starts_on: e.target.value }))}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ends On (Optional)
            </label>
            <Input
              type="date"
              value={recurrenceForm.ends_on}
              onChange={(e) => setRecurrenceForm(prev => ({ ...prev, ends_on: e.target.value || null }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={() => setIsRecurrenceModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={setRecurrenceMutation.isPending}>
              Save Rule
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
