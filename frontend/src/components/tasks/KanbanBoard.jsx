import React, { useState } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, CheckSquare, Calendar, Clock, AlertCircle } from 'lucide-react';
import { PriorityBadge } from '../ui/PriorityBadge.jsx';
import { Avatar } from '../ui/Avatar.jsx';

function SortableTaskCard({ task, onClick }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  };

  const isOverdue = task.due_date && task.status !== 'done' && task.due_date < new Date().toISOString().split('T')[0];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onClick(task.id)}
      className="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary-500/50 dark:hover:border-primary-500/50 transition-all cursor-pointer group select-none"
    >
      {/* Top Meta: Priority & Labels */}
      <div className="flex items-center justify-between gap-1.5 mb-2">
        <PriorityBadge priority={task.priority} />
        <div className="flex items-center gap-1 overflow-hidden">
          {task.labels?.slice(0, 2).map(l => (
            <span
              key={l.id}
              className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white truncate max-w-[80px]"
              style={{ backgroundColor: l.color }}
            >
              {l.name}
            </span>
          ))}
          {task.labels?.length > 2 && (
            <span className="text-[10px] text-slate-400 font-medium">+{task.labels.length - 2}</span>
          )}
        </div>
      </div>

      {/* Title */}
      <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-2 mb-3 leading-snug">
        {task.title}
      </h4>

      {/* Footer Meta */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-rose-500' : 'text-slate-500 dark:text-slate-400'}`}>
              <Calendar className="w-3 h-3" />
              {task.due_date.slice(5)}
            </span>
          )}

          {task.subtask_count > 0 && (
            <span className="flex items-center gap-0.5 text-slate-400">
              <CheckSquare className="w-3 h-3" />
              {task.subtask_completed_count || 0}/{task.subtask_count}
            </span>
          )}
        </div>

        {/* Assignees stack */}
        <div className="flex items-center -space-x-1.5 overflow-hidden">
          {task.assignees?.map(a => (
            <Avatar key={a.id} name={a.name} color={a.avatar_color} size="xs" />
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ status, title, colorClass, tasks, onSelectTask, onQuickAddTask }) {
  const [isAdding, setIsAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState('');

  const handleQuickSubmit = (e) => {
    e.preventDefault();
    if (quickTitle.trim()) {
      onQuickAddTask(status, quickTitle.trim());
      setQuickTitle('');
    }
  };

  return (
    <div className="flex flex-col flex-1 min-w-[280px] max-w-[360px] bg-slate-50/70 dark:bg-slate-900/40 rounded-2xl border border-slate-200/70 dark:border-slate-800/80 p-3 h-full max-h-[calc(100vh-220px)]">
      {/* Column Header */}
      <div className="flex items-center justify-between px-2 py-2 mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${colorClass}`} />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {title}
          </h3>
          <span className="text-[11px] font-bold text-slate-400 bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>

        <button
          onClick={() => setIsAdding(true)}
          className="text-slate-400 hover:text-primary-500 transition-colors p-1 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800"
          title="Quick add task"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Add Form */}
      {isAdding && (
        <form onSubmit={handleQuickSubmit} className="mb-3 px-1">
          <div className="p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-primary-500 shadow-md">
            <input
              type="text"
              autoFocus
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="What needs to be done? Press Enter..."
              className="w-full text-xs bg-transparent border-0 focus:ring-0 p-0 text-slate-900 dark:text-white"
              onKeyDown={(e) => {
                if (e.key === 'Escape') setIsAdding(false);
              }}
            />
            <div className="flex justify-end gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-[10px] text-slate-400 hover:text-slate-600 px-2 py-1 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="text-[10px] bg-primary-600 hover:bg-primary-700 text-white font-semibold px-2.5 py-1 rounded-md disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Task Cards List */}
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[150px]">
          {tasks.map(task => (
            <SortableTaskCard key={task.id} task={task} onClick={onSelectTask} />
          ))}

          {tasks.length === 0 && !isAdding && (
            <div className="h-28 border border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl flex items-center justify-center text-slate-400 text-xs">
              No tasks in this column
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({ tasks, onSelectTask, onMoveTask, onQuickAddTask }) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5 // Avoid triggering drag on simple click
      }
    })
  );

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeTask = tasks.find(t => t.id === active.id);
    if (!activeTask) return;

    let targetStatus = activeTask.status;
    let targetTasks = [];

    // Check if dropped directly over a column container or another task card
    const overId = over.id;
    const overTask = tasks.find(t => t.id === overId);

    if (overTask) {
      targetStatus = overTask.status;
    }

    if (targetStatus === 'todo') targetTasks = todoTasks;
    else if (targetStatus === 'in_progress') targetTasks = inProgressTasks;
    else if (targetStatus === 'done') targetTasks = doneTasks;

    const overIndex = targetTasks.findIndex(t => t.id === overId);
    let prevTaskId = null;
    let nextTaskId = null;

    if (overIndex >= 0) {
      prevTaskId = targetTasks[overIndex - 1]?.id || null;
      nextTaskId = targetTasks[overIndex]?.id || null;
    } else {
      prevTaskId = targetTasks[targetTasks.length - 1]?.id || null;
    }

    onMoveTask(activeTask.id, {
      status: targetStatus,
      previous_task_id: prevTaskId,
      next_task_id: nextTaskId
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-full items-start">
        <KanbanColumn
          status="todo"
          title="To Do"
          colorClass="bg-amber-400"
          tasks={todoTasks}
          onSelectTask={onSelectTask}
          onQuickAddTask={onQuickAddTask}
        />

        <KanbanColumn
          status="in_progress"
          title="In Progress"
          colorClass="bg-blue-500"
          tasks={inProgressTasks}
          onSelectTask={onSelectTask}
          onQuickAddTask={onQuickAddTask}
        />

        <KanbanColumn
          status="done"
          title="Done"
          colorClass="bg-emerald-500"
          tasks={doneTasks}
          onSelectTask={onSelectTask}
          onQuickAddTask={onQuickAddTask}
        />
      </div>
    </DndContext>
  );
}
