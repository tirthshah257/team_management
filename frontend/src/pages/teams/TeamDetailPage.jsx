import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  FolderKanban,
  UserPlus,
  Trash2,
  Edit2,
  ArrowLeft,
  X,
  Clock,
  Shield,
  CheckCircle2
} from 'lucide-react';
import { teamService } from '../../services/teamService.js';
import { userService } from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeaderCell } from '../../components/ui/Table.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { Skeleton, SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

export function TeamDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isAdmin, isManager } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // 1. Fetch team details
  const {
    data: team,
    isLoading,
    isError,
    error
  } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamService.getTeam(id)
  });

  // 2. Fetch all workspace users for member picker
  const { data: allUsersData } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => userService.listUsers({ pageSize: 100, isActive: true }),
    enabled: addMemberModalOpen
  });

  // Update Team Mutation
  const updateMutation = useMutation({
    mutationFn: (data) => teamService.updateTeam(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditModalOpen(false);
      success('Team Updated', 'Team details have been updated.');
    },
    onError: (err) => toastError('Update Failed', err.message)
  });

  // Delete Team Mutation
  const deleteMutation = useMutation({
    mutationFn: () => teamService.deleteTeam(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      success('Team Deleted', 'The team was deleted and associated projects were detached.');
      navigate('/teams');
    },
    onError: (err) => toastError('Delete Failed', err.message)
  });

  // Add Member Mutation
  const addMemberMutation = useMutation({
    mutationFn: (userId) => teamService.addMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setAddMemberModalOpen(false);
      setSelectedUserId('');
      success('Member Added', 'Teammate added to the team.');
    },
    onError: (err) => toastError('Failed to add member', err.message)
  });

  // Remove Member Mutation
  const removeMemberMutation = useMutation({
    mutationFn: (userId) => teamService.removeMember(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      success('Member Removed', 'Teammate removed from the team.');
    },
    onError: (err) => toastError('Failed to remove member', err.message)
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <SkeletonTable rows={4} cols={4} />
      </div>
    );
  }

  if (isError || !team) {
    return (
      <EmptyState
        title="Team Not Found"
        description="The requested team does not exist or you do not have permission to access it."
        actionLabel="Back to Teams"
        onAction={() => navigate('/teams')}
      />
    );
  }

  const canManageTeam = isAdmin || (isManager && team.is_member);

  // Available users not yet in this team
  const existingMemberIds = new Set(team.members?.map((m) => m.id));
  const availableUsers = allUsersData?.data?.filter((u) => !existingMemberIds.has(u.id)) || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/teams"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Teams
        </Link>
      </div>

      {/* Team Header Card */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {team.name}
            </h1>
            <Badge variant="default" className="text-xs">
              {team.members?.length || 0} Members
            </Badge>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
            {team.description || 'No description provided.'}
          </p>
        </div>

        {canManageTeam && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={Edit2}
              onClick={() => {
                setName(team.name);
                setDescription(team.description || '');
                setEditModalOpen(true);
              }}
            >
              Edit Team
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => setDeleteConfirmOpen(true)}
            >
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Grid: Members & Projects */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-600" />
              Team Members ({team.members?.length || 0})
            </h2>

            {canManageTeam && (
              <Button
                variant="outline"
                size="sm"
                icon={UserPlus}
                onClick={() => setAddMemberModalOpen(true)}
              >
                Add Member
              </Button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card overflow-hidden shadow-subtle">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Teammate</TableHeaderCell>
                  <TableHeaderCell>Role</TableHeaderCell>
                  <TableHeaderCell>Capacity</TableHeaderCell>
                  {canManageTeam && <TableHeaderCell className="text-right">Action</TableHeaderCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {team.members?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={member.name} color={member.avatar_color} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {member.name}
                          </div>
                          <div className="text-[11px] text-slate-400">{member.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default" className="capitalize">
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {member.capacity_hours_per_week}h/week
                    </TableCell>
                    {canManageTeam && (
                      <TableCell className="text-right">
                        <IconButton
                          icon={X}
                          label="Remove member from team"
                          size="sm"
                          variant="danger"
                          onClick={() => removeMemberMutation.mutate(member.id)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Projects Column (1 col) */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-brand-600" />
            Active Projects ({team.projects?.length || 0})
          </h2>

          <div className="space-y-3">
            {team.projects?.length === 0 ? (
              <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-card bg-white dark:bg-slate-900 text-xs text-slate-500">
                No active projects assigned to this team.
              </div>
            ) : (
              team.projects?.map((proj) => (
                <div
                  key={proj.id}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card shadow-subtle space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: proj.color }}
                      />
                      <h4 className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {proj.name}
                      </h4>
                    </div>
                    <Badge variant="default" className="text-[10px] capitalize">
                      {proj.status}
                    </Badge>
                  </div>

                  <ProgressBar
                    value={proj.completion_percentage}
                    showLabel
                    size="sm"
                  />

                  <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                    <span>{proj.done_tasks} / {proj.total_tasks} tasks done</span>
                    <span>{proj.due_date ? `Due ${proj.due_date}` : 'No deadline'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Edit Team */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Team"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate({ name: name.trim(), description: description.trim() });
          }}
          className="space-y-4"
        >
          <Input
            label="Team Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Add Member */}
      <Modal
        isOpen={addMemberModalOpen}
        onClose={() => setAddMemberModalOpen(false)}
        title="Add Teammate to Team"
        description="Select an active workspace member to add to this squad."
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!selectedUserId) return;
            addMemberMutation.mutate(selectedUserId);
          }}
          className="space-y-4"
        >
          {availableUsers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              All active workspace users are already members of this team.
            </p>
          ) : (
            <Select
              label="Select Teammate"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              required
            >
              <option value="">-- Choose a teammate --</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role}) - {u.email}
                </option>
              ))}
            </Select>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setAddMemberModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={availableUsers.length === 0 || !selectedUserId}
              isLoading={addMemberMutation.isPending}
            >
              Add to Team
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: Delete Team Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete Team?"
        message={`Are you sure you want to delete "${team.name}"? Active projects will NOT be deleted; they will simply be detached from this team.`}
        confirmText="Delete Team"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
