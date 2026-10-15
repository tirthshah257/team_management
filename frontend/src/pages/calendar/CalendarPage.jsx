import React, { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Calendar as CalendarIcon, CheckSquare, Coffee, Filter, RefreshCw } from 'lucide-react';
import { planningService } from '../../services/planningService.js';
import { TaskDrawer } from '../../components/tasks/TaskDrawer.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';

export function CalendarPage() {
  const queryClient = useQueryClient();
  const calendarRef = useRef(null);

  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0],
    to: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  });

  const [filterType, setFilterType] = useState('all'); // 'all' | 'task' | 'leave'
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedLeave, setSelectedLeave] = useState(null);

  const { data: events = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['calendar-events', dateRange.from, dateRange.to],
    queryFn: () => planningService.getCalendarEvents(dateRange.from, dateRange.to),
    staleTime: 60000
  });

  const handleDatesSet = (dateInfo) => {
    const from = dateInfo.startStr.split('T')[0];
    const to = dateInfo.endStr.split('T')[0];
    if (from !== dateRange.from || to !== dateRange.to) {
      setDateRange({ from, to });
    }
  };

  const handleEventClick = (clickInfo) => {
    const event = clickInfo.event;
    const props = event.extendedProps || {};

    if (props.taskId || event.id.startsWith('task-')) {
      const taskId = props.taskId || Number(event.id.replace('task-', ''));
      setSelectedTaskId(taskId);
    } else if (props.leaveId || event.id.startsWith('leave-')) {
      setSelectedLeave({
        id: props.leaveId || event.id,
        title: event.title,
        userName: props.userName || 'Member',
        leaveType: props.leaveType || 'General',
        start: event.startStr,
        end: event.endStr
      });
    }
  };

  const filteredEvents = events.filter((ev) => {
    if (filterType === 'all') return true;
    return ev.type === filterType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Calendar & Schedule
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unified overview of task milestones, due dates, and approved team leaves
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter options */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs font-medium">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                filterType === 'all'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              All Events
            </button>
            <button
              onClick={() => setFilterType('task')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                filterType === 'task'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5 text-brand-500" />
              Tasks
            </button>
            <button
              onClick={() => setFilterType('leave')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                filterType === 'leave'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Coffee className="w-3.5 h-3.5 text-amber-500" />
              Leaves
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Calendar View Card */}
      <Card className="p-4 bg-white dark:bg-slate-900 shadow-card border border-slate-200/80 dark:border-slate-800">
        <style>{`
          .fc {
            font-family: inherit;
          }
          .fc-header-toolbar {
            margin-bottom: 1.25rem !important;
            flex-wrap: wrap;
            gap: 0.5rem;
          }
          .fc-toolbar-title {
            font-size: 1.125rem !important;
            font-weight: 700 !important;
            color: #0f172a;
          }
          .dark .fc-toolbar-title {
            color: #f8fafc;
          }
          .fc-button {
            background-color: #f1f5f9 !important;
            border: 1px solid #e2e8f0 !important;
            color: #334155 !important;
            font-weight: 500 !important;
            font-size: 0.75rem !important;
            padding: 0.35rem 0.65rem !important;
            border-radius: 0.375rem !important;
            box-shadow: none !important;
            text-transform: capitalize !important;
          }
          .dark .fc-button {
            background-color: #1e293b !important;
            border-color: #334155 !important;
            color: #cbd5e1 !important;
          }
          .fc-button:hover {
            background-color: #e2e8f0 !important;
          }
          .dark .fc-button:hover {
            background-color: #334155 !important;
          }
          .fc-button-active {
            background-color: #4f46e5 !important;
            color: #ffffff !important;
            border-color: #4f46e5 !important;
          }
          .dark .fc-button-active {
            background-color: #6366f1 !important;
            color: #ffffff !important;
            border-color: #6366f1 !important;
          }
          .fc-theme-standard td, .fc-theme-standard th {
            border-color: #e2e8f0;
          }
          .dark .fc-theme-standard td, .dark .fc-theme-standard th {
            border-color: #1e293b;
          }
          .fc-col-header-cell {
            padding: 0.5rem 0;
            background-color: #f8fafc;
            font-size: 0.75rem;
            font-weight: 600;
            color: #64748b;
          }
          .dark .fc-col-header-cell {
            background-color: #0f172a;
            color: #94a3b8;
          }
          .fc-daygrid-day-number {
            font-size: 0.75rem;
            font-weight: 500;
            padding: 0.25rem 0.5rem;
            color: #475569;
          }
          .dark .fc-daygrid-day-number {
            color: #94a3b8;
          }
          .fc-daygrid-event {
            font-size: 0.75rem;
            border-radius: 4px;
            padding: 2px 5px;
            cursor: pointer;
            margin-top: 1px;
            border: none;
            transition: transform 0.1s ease;
          }
          .fc-daygrid-event:hover {
            transform: translateY(-1px);
            filter: brightness(1.05);
          }
        `}</style>

        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
          }}
          events={filteredEvents}
          datesSet={handleDatesSet}
          eventClick={handleEventClick}
          height="auto"
          dayMaxEvents={3}
          editable={false}
          selectable={false}
        />
      </Card>

      {/* Task Drawer */}
      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          isOpen={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskDeleted={() => {
            setSelectedTaskId(null);
            queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
          }}
        />
      )}

      {/* Leave Detail Modal */}
      {selectedLeave && (
        <Modal
          isOpen={!!selectedLeave}
          onClose={() => setSelectedLeave(null)}
          title="Team Leave Record"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <Avatar name={selectedLeave.userName} size="md" />
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {selectedLeave.userName}
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 capitalize">
                  {selectedLeave.leaveType} Leave
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 block mb-0.5">Start Date</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedLeave.start}
                </span>
              </div>
              <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-400 block mb-0.5">End Date</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedLeave.end || selectedLeave.start}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="outline" onClick={() => setSelectedLeave(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default CalendarPage;
