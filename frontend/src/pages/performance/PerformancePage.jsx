import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, Award, Clock, CheckCircle2, MessageSquare,
  ChevronLeft, ChevronRight, Edit3, User, Star
} from 'lucide-react';
import { format, subMonths, addMonths } from 'date-fns';
import { performanceService } from '../../services/peopleService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export function PerformancePage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const monthStr = format(currentDate, 'yyyy-MM');

  const [reviewModal, setReviewModal] = useState({
    isOpen: false,
    member: null,
    reviewNote: ''
  });

  const canReview = user?.role === 'admin' || user?.role === 'manager';

  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['performance-metrics', monthStr],
    queryFn: () => performanceService.getMetrics({ month: monthStr })
  });

  // Save Review Mutation
  const saveReviewMutation = useMutation({
    mutationFn: (data) => performanceService.saveReview(data),
    onSuccess: () => {
      success('Review Saved', 'Monthly performance review has been recorded.');
      setReviewModal({ isOpen: false, member: null, reviewNote: '' });
      queryClient.invalidateQueries({ queryKey: ['performance-metrics'] });
    },
    onError: (err) => {
      toastError('Save Failed', err.response?.data?.message || err.message);
    }
  });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const handleOpenReview = (item) => {
    setReviewModal({
      isOpen: true,
      member: item.user,
      reviewNote: item.review?.review_note || ''
    });
  };

  const handleSaveReview = (e) => {
    e.preventDefault();
    if (!reviewModal.reviewNote.trim()) {
      toastError('Note Required', 'Please enter a review note.');
      return;
    }
    saveReviewMutation.mutate({
      user_id: reviewModal.member.id,
      review_month: monthStr,
      review_note: reviewModal.reviewNote.trim()
    });
  };

  const metrics = metricsData?.metrics || [];

  // Summary computations
  const totalCompleted = metrics.reduce((s, m) => s + m.completed_tasks_count, 0);
  const totalHours = metrics.reduce((s, m) => s + m.hours_logged, 0);
  const avgOnTime = metrics.length > 0
    ? Math.round(metrics.reduce((s, m) => s + m.on_time_percentage, 0) / metrics.length)
    : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Performance & Monthly Reviews
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Measure on-time task delivery, output volume, and manage monthly manager reviews
            </p>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-card">
          <button
            onClick={handlePrevMonth}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[120px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </div>
          <button
            onClick={handleNextMonth}
            className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Average On-Time Delivery</span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {avgOnTime}%
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tasks Completed</span>
            <CheckCircle2 className="w-4 h-4 text-brand-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalCompleted}
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Hours Logged</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {totalHours.toFixed(1)} hrs
          </div>
        </Card>
      </div>

      {/* Scorecards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : metrics.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <TrendingUp className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <h3 className="text-base font-semibold text-slate-700 dark:text-slate-300">
            No member metrics recorded for this month
          </h3>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metrics.map((item) => {
            const u = item.user;
            const rev = item.review;

            return (
              <Card
                key={u.id}
                className="p-5 flex flex-col justify-between bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:shadow-subtle transition-all"
              >
                <div>
                  {/* Member identity */}
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

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase font-medium">
                        On-Time Rate
                      </span>
                      <span className={`text-sm font-bold ${
                        item.on_time_percentage >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'
                      }`}>
                        {item.on_time_percentage}%
                      </span>
                    </div>
                  </div>

                  {/* Quantitative Stats Pills */}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Completed Tasks
                      </span>
                      <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {item.completed_tasks_count}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                        Hours Logged
                      </span>
                      <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {item.hours_logged} hrs
                      </span>
                    </div>
                  </div>

                  {/* Manager Review Note */}
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                        <MessageSquare className="w-3.5 h-3.5 text-brand-500" />
                        <span>Monthly Review</span>
                      </div>

                      {canReview && (
                        <button
                          onClick={() => handleOpenReview(item)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                        >
                          <Edit3 className="w-3 h-3" />
                          {rev ? 'Edit Review' : 'Add Review'}
                        </button>
                      )}
                    </div>

                    {rev ? (
                      <div className="p-2.5 rounded-lg bg-brand-50/50 dark:bg-brand-950/20 border border-brand-100 dark:border-brand-900 text-xs">
                        <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          &ldquo;{rev.review_note}&rdquo;
                        </p>
                        <div className="mt-1 text-[10px] text-slate-400">
                          Reviewed by {rev.reviewer_name}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No review submitted for {format(currentDate, 'MMMM yyyy')}.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewModal.isOpen && (
        <Modal
          isOpen={reviewModal.isOpen}
          onClose={() => setReviewModal({ isOpen: false, member: null, reviewNote: '' })}
          title={`Performance Review for ${reviewModal.member?.name}`}
          size="sm"
        >
          <form onSubmit={handleSaveReview} className="space-y-4">
            <div className="text-xs text-slate-500">
              Review period: <strong>{format(currentDate, 'MMMM yyyy')}</strong>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Performance Feedback & Notes *
              </label>
              <Textarea
                placeholder="Write constructive monthly performance feedback..."
                value={reviewModal.reviewNote}
                onChange={(e) => setReviewModal(p => ({ ...p, reviewNote: e.target.value }))}
                rows={4}
                required
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReviewModal({ isOpen: false, member: null, reviewNote: '' })}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saveReviewMutation.isPending}
              >
                {saveReviewMutation.isPending ? 'Saving...' : 'Save Review'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
export default PerformancePage;
