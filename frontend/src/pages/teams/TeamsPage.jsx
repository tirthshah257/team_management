import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, FolderKanban, ArrowRight } from 'lucide-react';
import { teamService } from '../../services/teamService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardHeader, CardContent } from '../../components/ui/Card.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Textarea } from '../../components/ui/Textarea.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';
import { SkeletonCard } from '../../components/ui/Skeleton.jsx';

export function TeamsPage() {
  const { isAdmin, isManager } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamService.listTeams()
  });

  const createMutation = useMutation({
    mutationFn: (data) => teamService.createTeam(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setCreateModalOpen(false);
      setName('');
      setDescription('');
      success('Team Created', `Team "${data.name}" has been established.`);
      navigate(`/teams/${data.id}`);
    },
    onError: (err) => toastError('Failed to create team', err.message)
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate({ name: name.trim(), description: description.trim() });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Teams
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Functional groups, departments, and project squads
          </p>
        </div>

        {(isAdmin || isManager) && (
          <Button
            icon={Plus}
            onClick={() => setCreateModalOpen(true)}
          >
            Create Team
          </Button>
        )}
      </div>

      {/* Grid of Teams */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : teams?.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams found"
          description="Create your first team to organize members and collaborate across projects."
          actionLabel={isAdmin || isManager ? 'Create Team' : undefined}
          onAction={() => setCreateModalOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams?.map((team) => (
            <Card
              key={team.id}
              onClick={() => navigate(`/teams/${team.id}`)}
              className="cursor-pointer hover:border-brand-500/50 hover:shadow-dropdown transition-all group flex flex-col justify-between"
            >
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0 font-bold group-hover:bg-brand-600 group-hover:text-white transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-700 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors" />
                </div>

                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                    {team.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[32px]">
                    {team.description || 'No description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{team.member_count} {team.member_count === 1 ? 'member' : 'members'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
                    <span>{team.active_project_count} {team.active_project_count === 1 ? 'project' : 'projects'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Team Modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="Create New Team"
        description="Group members together to assign projects and balance team workloads."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Team Name"
            placeholder="e.g. Engineering, Design, QA"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Description (Optional)"
            placeholder="Brief overview of team responsibilities..."
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createMutation.isPending}>
              Create Team
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
