import React, { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  UserPlus,
  KeyRound,
  Shield,
  UserCheck,
  UserX,
  Copy,
  Check,
  RefreshCw,
  Mail,
  MoreVertical,
  Clock,
  ShieldAlert,
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';
import { userService } from '../../services/userService.js';
import { invitationService } from '../../services/invitationService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Table, TableHead, TableBody, TableRow, TableCell, TableHeaderCell } from '../../components/ui/Table.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { IconButton } from '../../components/ui/IconButton.jsx';
import { Avatar } from '../../components/ui/Avatar.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Dropdown, DropdownItem } from '../../components/ui/Dropdown.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { SearchInput } from '../../components/ui/SearchInput.jsx';
import { SkeletonTable } from '../../components/ui/Skeleton.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

export function MembersPage() {
  const { user: currentUser, isAdmin, isManager } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'invitations'
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);

  // Modals state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [generatedLink, setGeneratedLink] = useState('');
  const [hasCopied, setHasCopied] = useState(false);

  // Role change modal
  const [roleModalUser, setRoleModalUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('member');

  // Deactivate confirm
  const [statusConfirmUser, setStatusConfirmUser] = useState(null);

  // Temporary password modal
  const [tempPasswordResult, setTempPasswordResult] = useState(null);

  // Onboard existing pending invitation modal state
  const [onboardModalInv, setOnboardModalInv] = useState(null);
  const [onboardName, setOnboardName] = useState('');
  const [onboardPassword, setOnboardPassword] = useState('');
  const [showOnboardPassword, setShowOnboardPassword] = useState(false);
  const [onboardSuccessResult, setOnboardSuccessResult] = useState(null);

  // Direct onboard in invite modal
  const [inviteMode, setInviteMode] = useState('direct'); // 'direct' | 'link'
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [showInvitePassword, setShowInvitePassword] = useState(false);
  const [directSuccessResult, setDirectSuccessResult] = useState(null);

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    let pass = '';
    for (let i = 0; i < 5; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
    for (let i = 0; i < 3; i++) pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
    return `${pass}!`;
  };

  // 1. Fetch Users query
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    refetch: refetchUsers
  } = useQuery({
    queryKey: ['users', { search, role: roleFilter, page }],
    queryFn: () => userService.listUsers({ search, role: roleFilter, page, pageSize: 15 })
  });

  // 2. Fetch Invitations query
  const {
    data: invitations,
    isLoading: isLoadingInvitations,
    refetch: refetchInvitations
  } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationService.listInvitations(),
    enabled: isAdmin || isManager
  });

  // Create Invitation Mutation
  const inviteMutation = useMutation({
    mutationFn: (data) => invitationService.createInvitation(data),
    onSuccess: (data) => {
      setGeneratedLink(data.inviteLink);
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      success('Invitation Link Created', 'Share this single-use link with the teammate.');
    },
    onError: (err) => {
      toastError('Invitation Failed', err.message);
    }
  });

  // Revoke Invitation Mutation
  const revokeMutation = useMutation({
    mutationFn: (id) => invitationService.revokeInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      success('Revoked', 'Invitation link has been revoked.');
    },
    onError: (err) => toastError('Error', err.message)
  });

  // Regenerate Invitation Mutation
  const regenMutation = useMutation({
    mutationFn: (id) => invitationService.regenerateInvitation(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      setGeneratedLink(data.inviteLink);
      setInviteModalOpen(true);
      success('New Link Generated', 'The previous invitation was revoked.');
    },
    onError: (err) => toastError('Error', err.message)
  });

  // Onboard Pending Invitation Mutation
  const onboardMutation = useMutation({
    mutationFn: ({ id, name, password }) => invitationService.onboardInvitation(id, { name, password }),
    onSuccess: (data) => {
      setOnboardSuccessResult(data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      success('Teammate Onboarded!', `${data.email} is now an active team member.`);
    },
    onError: (err) => {
      toastError('Onboarding Failed', err.message);
    }
  });

  // Direct Onboard Mutation
  const directOnboardMutation = useMutation({
    mutationFn: (data) => invitationService.directOnboard(data),
    onSuccess: (data) => {
      setDirectSuccessResult(data);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      success('Teammate Added!', `${data.email} created with active credentials.`);
    },
    onError: (err) => {
      toastError('Add Teammate Failed', err.message);
    }
  });

  // Role Change Mutation
  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => userService.changeRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setRoleModalUser(null);
      success('Role Updated', 'User permissions have been updated.');
    },
    onError: (err) => toastError('Update Failed', err.message)
  });

  // Status Toggle Mutation
  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }) => userService.toggleStatus(id, is_active),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setStatusConfirmUser(null);
      success('Status Changed', `User has been ${data.is_active ? 'activated' : 'deactivated'}.`);
    },
    onError: (err) => toastError('Failed', err.message)
  });

  // Issue Temporary Password Mutation
  const tempPasswordMutation = useMutation({
    mutationFn: (id) => userService.issueTemporaryPassword(id),
    onSuccess: (data) => {
      setTempPasswordResult(data);
      success('Temporary Password Generated', 'Provide this password to the member.');
    },
    onError: (err) => toastError('Failed', err.message)
  });

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  const handleCreateInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate({ email: inviteEmail, role: inviteRole });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Members & Invitations
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Manage teammates, workspace roles, and pending invitations
          </p>
        </div>

        {(isAdmin || isManager) && (
          <Button
            icon={UserPlus}
            onClick={() => {
              setGeneratedLink('');
              setInviteEmail('');
              setInviteRole('member');
              setInviteModalOpen(true);
            }}
          >
            Invite Teammate
          </Button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-brand-600 text-brand-600 dark:text-brand-400'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          Members ({usersData?.meta?.total || 0})
        </button>
        {(isAdmin || isManager) && (
          <button
            onClick={() => setActiveTab('invitations')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'invitations'
                ? 'border-brand-600 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Invitations ({invitations?.filter(i => i.computed_status === 'pending').length || 0})
          </button>
        )}
      </div>

      {/* TAB 1: MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <SearchInput
              value={search}
              onChange={(val) => { setSearch(val); setPage(1); }}
              placeholder="Search by name or email..."
              className="w-full sm:w-72"
            />

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select
                value={roleFilter}
                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                className="text-xs py-1.5"
              >
                <option value="">All Roles</option>
                <option value="admin">Admins</option>
                <option value="manager">Managers</option>
                <option value="member">Members</option>
              </Select>
            </div>
          </div>

          {/* Members Table */}
          {isLoadingUsers ? (
            <SkeletonTable rows={5} cols={5} />
          ) : usersData?.data?.length === 0 ? (
            <EmptyState
              title="No members found"
              description="Try adjusting your search criteria."
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card overflow-hidden shadow-subtle">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Member</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Capacity</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usersData?.data?.map((u) => {
                    const isSelf = u.id === currentUser.id;

                    return (
                      <TableRow key={u.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name} color={u.avatar_color} size="sm" />
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                {u.name}
                                {isSelf && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">{u.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={u.role === 'admin' ? 'primary' : u.role === 'manager' ? 'warning' : 'default'}
                            className="capitalize"
                          >
                            {u.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.capacity_hours_per_week}h/week</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Deactivated
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {isAdmin && !isSelf ? (
                            <Dropdown
                              trigger={
                                <IconButton
                                  icon={MoreVertical}
                                  label="Actions"
                                  size="sm"
                                />
                              }
                            >
                              <DropdownItem
                                icon={Shield}
                                onClick={() => {
                                  setSelectedRole(u.role);
                                  setRoleModalUser(u);
                                }}
                              >
                                Change Role
                              </DropdownItem>
                              <DropdownItem
                                icon={KeyRound}
                                onClick={() => tempPasswordMutation.mutate(u.id)}
                              >
                                Issue Temporary Password
                              </DropdownItem>
                              <DropdownItem
                                icon={u.is_active ? UserX : UserCheck}
                                danger={u.is_active}
                                onClick={() => setStatusConfirmUser(u)}
                              >
                                {u.is_active ? 'Deactivate Member' : 'Activate Member'}
                              </DropdownItem>
                            </Dropdown>
                          ) : (
                            <span className="text-[11px] text-slate-400">&mdash;</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Pagination
                page={usersData?.meta?.page || 1}
                pageSize={usersData?.meta?.pageSize || 15}
                total={usersData?.meta?.total || 0}
                onPageChange={(p) => setPage(p)}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeTab === 'invitations' && (isAdmin || isManager) && (
        <div className="space-y-4">
          {isLoadingInvitations ? (
            <SkeletonTable rows={4} cols={5} />
          ) : invitations?.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No invitations found"
              description="Send invitation links to bring teammates into TeamFlow."
              actionLabel="Create Invitation"
              onAction={() => setInviteModalOpen(true)}
            />
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-card overflow-hidden shadow-subtle">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Invited Email</TableHeaderCell>
                    <TableHeaderCell>Role</TableHeaderCell>
                    <TableHeaderCell>Invited By</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell>Expires</TableHeaderCell>
                    <TableHeaderCell className="text-right">Actions</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invitations?.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-semibold text-slate-900 dark:text-slate-100">
                        {inv.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="default" className="capitalize">
                          {inv.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {inv.invited_by_name}
                      </TableCell>
                      <TableCell>
                        {inv.computed_status === 'pending' && <Badge variant="warning">Pending</Badge>}
                        {inv.computed_status === 'accepted' && <Badge variant="success">Accepted</Badge>}
                        {inv.computed_status === 'revoked' && <Badge variant="default">Revoked</Badge>}
                        {inv.computed_status === 'expired' && <Badge variant="danger">Expired</Badge>}
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {inv.computed_status === 'pending' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="primary"
                              size="xs"
                              icon={UserCheck}
                              onClick={() => {
                                setOnboardModalInv(inv);
                                setOnboardName(inv.email.split('@')[0]);
                                setOnboardPassword(generateRandomPassword());
                                setOnboardSuccessResult(null);
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                              title="Accept invitation and generate credentials"
                            >
                              Accept & Onboard
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              icon={RefreshCw}
                              onClick={() => regenMutation.mutate(inv.id)}
                              title="Regenerate link"
                            >
                              Regen
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              onClick={() => revokeMutation.mutate(inv.id)}
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">&mdash;</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Invite / Add Teammate */}
      <Modal
        isOpen={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setGeneratedLink('');
          setDirectSuccessResult(null);
        }}
        title="Invite or Add Teammate"
        description="Choose whether to create login credentials directly or generate a shareable link."
        maxWidth="max-w-md"
      >
        {!generatedLink && !directSuccessResult && (
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg mb-4 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setInviteMode('direct')}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                inviteMode === 'direct'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Direct Onboard (Create ID & Password)
            </button>
            <button
              type="button"
              onClick={() => setInviteMode('link')}
              className={`flex-1 py-1.5 rounded-md transition-all ${
                inviteMode === 'link'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Generate Shareable Link
            </button>
          </div>
        )}

        {/* Mode A: Direct Onboard Form */}
        {inviteMode === 'direct' && !directSuccessResult && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              directOnboardMutation.mutate({
                email: inviteEmail,
                name: inviteName || inviteEmail.split('@')[0],
                role: inviteRole,
                password: invitePassword || generateRandomPassword()
              });
            }}
            className="space-y-4"
          >
            <Input
              label="Teammate's Email Address *"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (!inviteName && e.target.value.includes('@')) {
                  setInviteName(e.target.value.split('@')[0]);
                }
              }}
              required
            />

            <Input
              label="Full Name (Optional)"
              type="text"
              placeholder="e.g. John Smith"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
            />

            <Select
              label="Assigned Workspace Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="member">Member (view & participate in assigned projects)</option>
              {isAdmin && <option value="manager">Manager (team scope & project ownership)</option>}
              {isAdmin && <option value="admin">Administrator (full workspace access)</option>}
            </Select>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Temporary Password
                </label>
                <button
                  type="button"
                  onClick={() => setInvitePassword(generateRandomPassword())}
                  className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  <Sparkles className="w-3 h-3" /> Auto-Generate
                </button>
              </div>
              <div className="relative">
                <Input
                  type={showInvitePassword ? 'text' : 'password'}
                  placeholder="Set password or click auto-generate..."
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowInvitePassword(!showInvitePassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showInvitePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Member will be prompted to change this password upon first login.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={directOnboardMutation.isPending}>
                Create Member & Credentials
              </Button>
            </div>
          </form>
        )}

        {/* Direct Onboard Result */}
        {directSuccessResult && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-card bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
              <span className="font-semibold">Teammate successfully onboarded!</span> Share these credentials with the member so they can log in immediately.
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 font-medium">Email ID:</span>
                <span className="font-bold text-slate-800 dark:text-slate-100 select-all">{directSuccessResult.email}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Password:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">{directSuccessResult.temporaryPassword}</span>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <Button
                variant={hasCopied ? 'secondary' : 'primary'}
                icon={hasCopied ? Check : Copy}
                size="sm"
                onClick={() => {
                  handleCopy(`Email: ${directSuccessResult.email}\nPassword: ${directSuccessResult.temporaryPassword}`);
                }}
              >
                {hasCopied ? 'Copied Both Credentials!' : 'Copy Email & Password'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setInviteModalOpen(false);
                  setDirectSuccessResult(null);
                  setInviteEmail('');
                  setInviteName('');
                  setInvitePassword('');
                }}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* Mode B: Shareable Link Form */}
        {inviteMode === 'link' && !generatedLink && (
          <form onSubmit={handleCreateInvite} className="space-y-4">
            <Input
              label="Teammate's Email Address *"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />

            <Select
              label="Assigned Workspace Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="member">Member (view & participate in assigned projects)</option>
              {isAdmin && <option value="manager">Manager (team scope & project ownership)</option>}
              {isAdmin && <option value="admin">Administrator (full workspace access)</option>}
            </Select>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setInviteModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={inviteMutation.isPending}>
                Generate Invitation Link
              </Button>
            </div>
          </form>
        )}

        {/* Shareable Link Result */}
        {inviteMode === 'link' && generatedLink && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-card bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
              <span className="font-semibold">Single-use link generated:</span> Copy and share this link directly with your teammate. No email is sent.
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={generatedLink}
                className="w-full text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-btn p-2.5 text-slate-700 dark:text-slate-200"
              />
              <Button
                variant={hasCopied ? 'secondary' : 'primary'}
                icon={hasCopied ? Check : Copy}
                onClick={() => handleCopy(generatedLink)}
              >
                {hasCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setInviteModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Change Role */}
      {roleModalUser && (
        <Modal
          isOpen={true}
          onClose={() => setRoleModalUser(null)}
          title={`Change Role: ${roleModalUser.name}`}
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <Select
              label="Select New Role"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="member">Member</option>
              <option value="manager">Manager</option>
              <option value="admin">Administrator</option>
            </Select>

            <p className="text-xs text-slate-500">
              Changing a user's role immediately bumps their session token version and invalidates existing sessions.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setRoleModalUser(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                isLoading={roleMutation.isPending}
                onClick={() => roleMutation.mutate({ id: roleModalUser.id, role: selectedRole })}
              >
                Save Role
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 3: Deactivate / Activate Confirm */}
      {statusConfirmUser && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setStatusConfirmUser(null)}
          onConfirm={() => statusMutation.mutate({
            id: statusConfirmUser.id,
            is_active: !statusConfirmUser.is_active
          })}
          title={statusConfirmUser.is_active ? 'Deactivate Member?' : 'Reactivate Member?'}
          message={
            statusConfirmUser.is_active
              ? `Are you sure you want to deactivate ${statusConfirmUser.name}? Their sessions will be invalidated immediately, but their historical tasks, comments, and time entries will be preserved.`
              : `Are you sure you want to reactivate ${statusConfirmUser.name}? They will be able to log in again.`
          }
          confirmText={statusConfirmUser.is_active ? 'Deactivate' : 'Reactivate'}
          confirmVariant={statusConfirmUser.is_active ? 'danger' : 'primary'}
          isLoading={statusMutation.isPending}
        />
      )}

      {/* MODAL 4: Temporary Password Result */}
      {tempPasswordResult && (
        <Modal
          isOpen={true}
          onClose={() => setTempPasswordResult(null)}
          title="Temporary Password Issued"
          description="Copy this password now. It is shown only once and will not be displayed again."
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-card bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
              The user's current session has been revoked. They must change this password immediately upon their next login.
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={tempPasswordResult.temporaryPassword}
                className="w-full text-sm font-mono font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-btn p-2.5 text-slate-800 dark:text-slate-100"
              />
              <Button
                variant={hasCopied ? 'secondary' : 'primary'}
                icon={hasCopied ? Check : Copy}
                onClick={() => handleCopy(tempPasswordResult.temporaryPassword)}
              >
                {hasCopied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setTempPasswordResult(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {/* MODAL 4: Accept & Onboard Pending Invitation */}
      {onboardModalInv && (
        <Modal
          isOpen={true}
          onClose={() => setOnboardModalInv(null)}
          title="Accept Invitation & Onboard Member"
          description="Activate this invitation immediately and generate credentials for the teammate."
          maxWidth="max-w-md"
        >
          {!onboardSuccessResult ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onboardMutation.mutate({
                  id: onboardModalInv.id,
                  name: onboardName || onboardModalInv.email.split('@')[0],
                  password: onboardPassword
                });
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Invited Email
                </label>
                <input
                  type="text"
                  readOnly
                  value={onboardModalInv.email}
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-btn p-2.5 text-slate-600 dark:text-slate-400 cursor-not-allowed font-medium"
                />
              </div>

              <Input
                label="Member's Full Name"
                type="text"
                placeholder="e.g. John Doe"
                value={onboardName}
                onChange={(e) => setOnboardName(e.target.value)}
                required
              />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Temporary Password *
                  </label>
                  <button
                    type="button"
                    onClick={() => setOnboardPassword(generateRandomPassword())}
                    className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Sparkles className="w-3 h-3" /> Auto-Generate
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type={showOnboardPassword ? 'text' : 'password'}
                    value={onboardPassword}
                    onChange={(e) => setOnboardPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOnboardPassword(!showOnboardPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showOnboardPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Admin can view and copy these credentials to share directly with the member.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setOnboardModalInv(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={onboardMutation.isPending}>
                  Confirm & Activate Member
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-3.5 rounded-card bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-semibold">Teammate Activated!</span> {onboardSuccessResult.email} is now an active member of your workspace.
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 font-medium">Email ID:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-100 select-all">{onboardSuccessResult.email}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 font-medium">Password:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 select-all">{onboardSuccessResult.temporaryPassword}</span>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <Button
                  variant={hasCopied ? 'secondary' : 'primary'}
                  icon={hasCopied ? Check : Copy}
                  size="sm"
                  onClick={() => {
                    handleCopy(`Email: ${onboardSuccessResult.email}\nPassword: ${onboardSuccessResult.temporaryPassword}`);
                  }}
                >
                  {hasCopied ? 'Copied Both Credentials!' : 'Copy Email & Password'}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setOnboardModalInv(null);
                    setOnboardSuccessResult(null);
                    setActiveTab('members');
                  }}
                >
                  View in Members List
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
