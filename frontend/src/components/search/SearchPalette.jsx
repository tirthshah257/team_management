import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, FolderKanban, CheckSquare, User, ArrowRight,
  CornerDownLeft, Loader2, X
} from 'lucide-react';
import { searchService } from '../../services/searchService.js';
import { Avatar } from '../ui/Avatar.jsx';

export function SearchPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  // Focus on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const { data, isLoading } = useQuery({
    queryKey: ['global-search', query],
    queryFn: () => searchService.search(query, 6),
    enabled: isOpen && query.trim().length > 0,
    staleTime: 5000
  });

  const projects = data?.projects || [];
  const tasks = data?.tasks || [];
  const members = data?.members || [];

  // Flatten items for keyboard navigation
  const allItems = [
    ...projects.map(p => ({ ...p, itemType: 'project' })),
    ...tasks.map(t => ({ ...t, itemType: 'task' })),
    ...members.map(m => ({ ...m, itemType: 'member' }))
  ];

  const handleSelect = (item) => {
    if (!item) return;
    onClose();

    if (item.itemType === 'project') {
      navigate(`/projects/${item.id}`);
    } else if (item.itemType === 'task') {
      navigate(`/projects/${item.project_id}?taskId=${item.id}`);
    } else if (item.itemType === 'member') {
      navigate('/members');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < allItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : allItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allItems[selectedIndex]) {
        handleSelect(allItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transform transition-all"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search projects, tasks, or teammates... (ESC to close)"
            className="flex-1 bg-transparent border-0 text-sm focus:ring-0 text-slate-900 dark:text-white placeholder-slate-400 p-0"
          />
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-primary-500 animate-spin shrink-0" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-block text-[10px] bg-slate-200/80 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2">
          {query.trim().length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Type to search across projects, tasks, and teammates...
            </div>
          ) : allItems.length === 0 && !isLoading ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No results found for "{query}".
            </div>
          ) : (
            <div className="space-y-4">
              {/* Projects */}
              {projects.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                    Projects
                  </div>
                  {projects.map((proj, idx) => {
                    const itemIndex = idx;
                    const isSelected = selectedIndex === itemIndex;
                    return (
                      <div
                        key={proj.id}
                        onClick={() => handleSelect({ ...proj, itemType: 'project' })}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-900 dark:text-primary-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span
                            className="w-3.5 h-3.5 rounded shrink-0"
                            style={{ backgroundColor: proj.color }}
                          />
                          <span className="text-xs font-semibold truncate">{proj.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">Project</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Tasks */}
              {tasks.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                    Tasks
                  </div>
                  {tasks.map((task, idx) => {
                    const itemIndex = projects.length + idx;
                    const isSelected = selectedIndex === itemIndex;
                    return (
                      <div
                        key={task.id}
                        onClick={() => handleSelect({ ...task, itemType: 'task' })}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-900 dark:text-primary-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <CheckSquare className="w-4 h-4 text-slate-400 shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-semibold">{task.title}</span>
                            <span className="text-[10px] text-slate-400 ml-2">in {task.project_name}</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize font-mono">{task.status}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Members */}
              {members.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">
                    Teammates
                  </div>
                  {members.map((member, idx) => {
                    const itemIndex = projects.length + tasks.length + idx;
                    const isSelected = selectedIndex === itemIndex;
                    return (
                      <div
                        key={member.id}
                        onClick={() => handleSelect({ ...member, itemType: 'member' })}
                        onMouseEnter={() => setSelectedIndex(itemIndex)}
                        className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary-50 dark:bg-primary-950/60 text-primary-900 dark:text-primary-100'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.name} color={member.avatar_color} size="xs" />
                          <div className="truncate">
                            <span className="text-xs font-semibold">{member.name}</span>
                            <span className="text-[10px] text-slate-400 ml-2">({member.email})</span>
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-400 capitalize font-mono">{member.role}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900 text-[11px] text-slate-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">↵</kbd> Select</span>
            <span><kbd className="font-mono bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded">esc</kbd> Dismiss</span>
          </div>
          <span>TeamFlow Global Search</span>
        </div>
      </div>
    </div>
  );
}
