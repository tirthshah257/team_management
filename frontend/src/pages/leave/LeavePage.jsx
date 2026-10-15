import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CalendarOff, Plus, CheckCircle2, XCircle, Clock, AlertCircle,
  FileText, User, ChevronRight, Check, X, ShieldAlert
} from 'lucide-react';
import { leaveService } from '../../services/peopleService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';

export function LeavePage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('my-requests'); // 'my-requests' | 'approvals' | 'all'
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [rejectModal, setRejectModal] = useState({ isOpen: false, requestId: null, note: '' });

  const [requestForm, setRequestForm] = useState({
    leave_type: 'casual',
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    days: 1,
    reason: ''
  });

  const canApprove = user?.role === 'admin' || user?.role === 'manager';

  // 1. Fetch user's leave balances
  const { data: balances = [], isLoading: isBalancesLoading } = useQuery({
    queryKey: ['leave-balances'],
    queryFn: () => leaveService.getBalances()
  });

  // 2. Fetch requests for current tab
  const { data: requests = [], isLoading: isRequestsLoading } = useQuery({
    queryKey: ['leave-requests', activeTab],
    queryFn: () => {
      if (activeTab === 'my-requests') {
        return leaveService.listRequests({ targetUserId: user?.id });
      } else if (activeTab === 'approvals') {
        return leaveService.listRequests({ status: 'pending' });
      } else {
        return leaveService.listRequests();
      }
    }
  });

  // Create Request Mutation
  const createRequestMutation = useMutation({
    mutationFn: (data) => leaveService.createRequest(data),
    onSuccess: () => {
      success('Leave Requested', 'Your request has been submitted for approval.');
      setIsRequestModalOpen(false);
      setRequestForm({
        leave_type: 'casual',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        days: 1,
        reason: ''
      });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
    onError: (err) => {
      toastError('Request Failed', err.response?.data?.message || err.message);
    }
  });

  // Approve Mutation
  const approveMutation = useMutation({
    mutationFn: (id) => leaveService.approveRequest(id),
    onSuccess: () => {
      success('Leave Approved', 'The request has been approved.');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: (err) => {
      toastError('Approval Failed', err.response?.data?.message || err.message);
    }
  });

  // Reject Mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, reviewNote }) => leaveService.rejectRequest(id, { reviewNote }),
    onSuccess: () => {
      success('Leave Declined', 'The request has been rejected.');
      setRejectModal({ isOpen: false, requestId: null, note: '' });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
    onError: (err) => {
      toastError('Rejection Failed', err.response?.data?.message || err.message);
    }
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: (id) => leaveService.cancelRequest(id),
    onSuccess: () => {
      success('Request Cancelled', 'Your pending request has been cancelled.');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] });
    },
    onError: (err) => {
      toastError('Cancel Failed', err.response?.data?.message || err.message);
    }
  });

  const handleSubmitRequest = (e) => {
    e.preventDefault();
    if (requestForm.days <= 0) {
      toastError('Invalid Days', 'Requested days must be at least 1.');
      return;
    }
    createRequestMutation.mutate(requestForm);
  };

  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'approved': return 'success';
      case 'rejected': return 'error';
      case 'pending': return 'warning';
      case 'cancelled': return 'secondary';
      default: return 'default';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <CalendarOff className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Leave Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Check leave balances, request paid time off, and manage team approvals
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => setIsRequestModalOpen(true)}
          className="gap-1.5 text-xs shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          Request Leave
        </Button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {balances.map((b) => {
          const totalAllowed = (b.allocated_days || 0) + (b.adjustment_days || 0);
          const remaining = Math.max(0, totalAllowed - (b.used_days || 0));

          return (
            <Card
              key={b.id || b.leave_type}
              className="p-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-card"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider capitalize">
                  {b.leave_type} Leave
                </span>
                <Badge variant={remaining > 0 ? 'success' : 'secondary'} size="xs">
                  {remaining} days left
                </Badge>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900 dark:text-slate-100">
                  {remaining}
                </span>
                <span className="text-xs text-slate-400">/ {totalAllowed} days allocated</span>
              </div>

              <div className="mt-3 w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${totalAllowed > 0 ? ((b.used_days || 0) / totalAllowed) * 100 : 0}%` }}
                />
              </div>

              <div className="mt-2 text-[11px] text-slate-500 flex justify-between">
                <span>Used: {b.used_days || 0}d</span>
                <span>Adjustments: {b.adjustment_days || 0}d</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('my-requests')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'my-requests'
              ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          My Leave Requests
        </button>

        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'approvals'
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Pending Approvals
          </button>
        )}

        {canApprove && (
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'all'
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            All Team Requests
          </button>
        )}
      </div>

      {/* Requests Table */}
      <Card className="overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase font-semibold">
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4 text-center">Days</th>
                <th className="py-3 px-4">Reason / Note</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No leave requests found in this category.
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const isOwn = req.user_id === user?.id;
                  const isPending = req.status === 'pending';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={req.user_name} color={req.user_avatar_color} size="xs" />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {req.user_name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 capitalize font-medium text-slate-700 dark:text-slate-300">
                        {req.leave_type}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {req.start_date} &rarr; {req.end_date}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                        {req.days}d
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-slate-500">
                        {req.reason || req.review_note || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={getStatusBadgeVariant(req.status)} size="xs" className="capitalize">
                          {req.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {/* Approval actions for managers/admins (cannot approve own request) */}
                        {canApprove && isPending && !isOwn && (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-emerald-600 hover:bg-emerald-50 border-emerald-300"
                              onClick={() => approveMutation.mutate(req.id)}
                              disabled={approveMutation.isPending}
                            >
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="xs"
                              variant="outline"
                              className="text-rose-600 hover:bg-rose-50 border-rose-300"
                              onClick={() => setRejectModal({ isOpen: true, requestId: req.id, note: '' })}
                              disabled={rejectMutation.isPending}
                            >
                              <X className="w-3 h-3 mr-1" />
                              Reject
                            </Button>
                          </div>
                        )}

                        {/* Cancel button for own pending request */}
                        {isOwn && isPending && (
                          <Button
                            size="xs"
                            variant="outline"
                            className="text-slate-600 hover:text-rose-600"
                            onClick={() => cancelMutation.mutate(req.id)}
                            disabled={cancelMutation.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Request Leave Modal */}
      {isRequestModalOpen && (
        <Modal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          title="Submit Leave Request"
          size="sm"
        >
          <form onSubmit={handleSubmitRequest} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Leave Type *
              </label>
              <Select
                value={requestForm.leave_type}
                onChange={(e) => setRequestForm(p => ({ ...p, leave_type: e.target.value }))}
                required
                className="text-xs"
              >
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="other">Other / Unpaid</option>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Start Date *
                </label>
                <Input
                  type="date"
                  value={requestForm.start_date}
                  onChange={(e) => setRequestForm(p => ({ ...p, start_date: e.target.value }))}
                  required
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  End Date *
                </label>
                <Input
                  type="date"
                  value={requestForm.end_date}
                  onChange={(e) => setRequestForm(p => ({ ...p, end_date: e.target.value }))}
                  required
                  className="text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Total Days *
              </label>
              <Input
                type="number"
                min="0.5"
                step="0.5"
                value={requestForm.days}
                onChange={(e) => setRequestForm(p => ({ ...p, days: parseFloat(e.target.value) }))}
                required
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Reason (Optional)
              </label>
              <Textarea
                placeholder="Reason for taking leave..."
                value={requestForm.reason}
                onChange={(e) => setRequestForm(p => ({ ...p, reason: e.target.value }))}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRequestModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reject Leave Note Modal */}
      {rejectModal.isOpen && (
        <Modal
          isOpen={rejectModal.isOpen}
          onClose={() => setRejectModal({ isOpen: false, requestId: null, note: '' })}
          title="Decline Leave Request"
          size="sm"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Provide an optional note to explain why this request is being rejected.
            </p>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Review Note
              </label>
              <Textarea
                placeholder="Explanation for rejection..."
                value={rejectModal.note}
                onChange={(e) => setRejectModal(p => ({ ...p, note: e.target.value }))}
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRejectModal({ isOpen: false, requestId: null, note: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate({ id: rejectModal.requestId, reviewNote: rejectModal.note })}
              >
                {rejectMutation.isPending ? 'Declining...' : 'Decline Request'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export default LeavePage;
