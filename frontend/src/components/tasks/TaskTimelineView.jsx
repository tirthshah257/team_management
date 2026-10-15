import React, { useMemo } from 'react';
import {
  addDays,
  differenceInDays,
  format,
  isSameDay,
  isToday,
  parseISO,
  startOfDay
} from 'date-fns';
import { PriorityBadge } from '../ui/PriorityBadge.jsx';

export function TaskTimelineView({ tasks, project, onSelectTask }) {
  // Determine date bounds
  const { startDate, daysCount, days } = useMemo(() => {
    const today = startOfDay(new Date());

    let minDate = today;
    let maxDate = addDays(today, 21);

    tasks.forEach(t => {
      if (t.start_date) {
        const d = parseISO(t.start_date);
        if (d < minDate) minDate = d;
      }
      if (t.due_date) {
        const d = parseISO(t.due_date);
        if (d > maxDate) maxDate = d;
      }
    });

    // Pad by 3 days on each side
    const start = addDays(minDate, -3);
    const end = addDays(maxDate, 5);
    const count = Math.max(14, differenceInDays(end, start) + 1);

    const dayList = [];
    for (let i = 0; i < count; i++) {
      dayList.push(addDays(start, i));
    }

    return { startDate: start, daysCount: count, days: dayList };
  }, [tasks]);

  const columnWidth = 44; // pixels per day

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Header Info */}
      <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Project Timeline & Schedule
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Gantt-style bars showing task durations from start date to due date
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-slate-500">To Do</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-500">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Done</span>
          </div>
        </div>
      </div>

      {/* Timeline Scroll Area */}
      <div className="overflow-x-auto relative">
        <div style={{ minWidth: `${daysCount * columnWidth + 240}px` }}>
          {/* Days Header */}
          <div className="flex border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 sticky top-0 z-10">
            {/* Left fixed label */}
            <div className="w-60 min-w-[240px] p-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 border-r border-slate-200/80 dark:border-slate-800">
              Task
            </div>

            {/* Days columns */}
            <div className="flex">
              {days.map((day, idx) => {
                const isCurrent = isToday(day);
                return (
                  <div
                    key={idx}
                    style={{ width: `${columnWidth}px` }}
                    className={`text-center py-2 border-r border-slate-100 dark:border-slate-800/50 select-none ${
                      isCurrent
                        ? 'bg-primary-50 dark:bg-primary-950/40 font-bold text-primary-600 dark:text-primary-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-semibold">{format(day, 'EEE')}</div>
                    <div className="text-xs">{format(day, 'd')}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/60 relative">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No tasks available to plot on timeline.
              </div>
            ) : (
              tasks.map(task => {
                let leftOffset = 0;
                let barWidth = columnWidth; // default 1 day

                const tStart = task.start_date ? parseISO(task.start_date) : (task.due_date ? parseISO(task.due_date) : new Date());
                const tEnd = task.due_date ? parseISO(task.due_date) : tStart;

                const dayDiff = differenceInDays(tStart, startDate);
                leftOffset = Math.max(0, dayDiff * columnWidth);

                const durationDays = Math.max(1, differenceInDays(tEnd, tStart) + 1);
                barWidth = durationDays * columnWidth - 8;

                const statusBg =
                  task.status === 'done'
                    ? 'bg-emerald-500'
                    : task.status === 'in_progress'
                    ? 'bg-blue-500'
                    : 'bg-amber-500';

                return (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className="flex items-center hover:bg-slate-50/70 dark:hover:bg-slate-800/30 cursor-pointer h-12 group transition-colors"
                  >
                    {/* Left label */}
                    <div className="w-60 min-w-[240px] px-3 py-2 border-r border-slate-200/80 dark:border-slate-800 truncate">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {task.title}
                      </span>
                    </div>

                    {/* Timeline bar track */}
                    <div className="flex-1 relative h-full">
                      {/* Grid vertical lines */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {days.map((day, idx) => (
                          <div
                            key={idx}
                            style={{ width: `${columnWidth}px` }}
                            className={`h-full border-r border-slate-100 dark:border-slate-800/40 ${
                              isToday(day) ? 'bg-primary-50/40 dark:bg-primary-950/20' : ''
                            }`}
                          />
                        ))}
                      </div>

                      {/* The task bar */}
                      <div
                        style={{
                          left: `${leftOffset + 4}px`,
                          width: `${Math.max(28, barWidth)}px`
                        }}
                        className={`absolute top-2.5 h-7 rounded-lg ${statusBg} text-white shadow-sm flex items-center px-2.5 text-[11px] font-semibold truncate hover:brightness-110 transition-all z-10`}
                        title={`${task.title} (${task.start_date || 'No start'} → ${task.due_date || 'No due'})`}
                      >
                        <span className="truncate">{task.title}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
