'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

type Subtask = {
    id: number;
    goal_id: number;
    title: string;
    is_completed: boolean;
    weight: number;
    order_index: number;
    due_date: string | null;
    created_at: string;
};

type GoalSubtasksProps = {
    goalId: number;
    subtasks?: Subtask[];
    onSubtasksChange?: () => void;
};

export default function GoalSubtasks({ goalId, subtasks: initialSubtasks, onSubtasksChange }: GoalSubtasksProps) {
    const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks || []);
    const [loading, setLoading] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    // Track when we're doing an optimistic update to prevent parent props from overwriting
    const skipNextSyncRef = useRef(false);

    useEffect(() => {
        if (skipNextSyncRef.current) {
            // Skip this sync — we just did an optimistic update
            skipNextSyncRef.current = false;
            return;
        }
        if (initialSubtasks) {
            setSubtasks(initialSubtasks);
        } else {
            loadSubtasks();
        }
    }, [goalId, initialSubtasks]);

    const getSession = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    }, []);

    const loadSubtasks = async () => {
        setLoading(true);
        try {
            const session = await getSession();
            if (!session) return;

            const res = await fetch(`/api/subtasks?goal_id=${goalId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                cache: 'no-store',
            });

            if (res.ok) {
                const data = await res.json();
                setSubtasks(data.items || []);
            }
        } catch (error) {
            console.error('Failed to load subtasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleComplete = useCallback(async (subtaskId: number, currentStatus: boolean) => {
        const newStatus = !currentStatus;

        // Optimistic update — update UI immediately
        setSubtasks(prev => prev.map(s =>
            s.id === subtaskId ? { ...s, is_completed: newStatus } : s
        ));
        // Prevent parent re-render from reverting our optimistic update
        skipNextSyncRef.current = true;

        try {
            const session = await getSession();
            if (!session) {
                // Revert optimistic update
                setSubtasks(prev => prev.map(s =>
                    s.id === subtaskId ? { ...s, is_completed: currentStatus } : s
                ));
                return;
            }

            const res = await fetch(`/api/subtasks/${subtaskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_completed: newStatus }),
            });

            if (res.ok) {
                // Notify parent to refresh progress bar, but our local state is already correct
                onSubtasksChange?.();
            } else {
                console.error('[GoalSubtasks] Failed to update subtask:', res.status);
                // Revert optimistic update on error
                setSubtasks(prev => prev.map(s =>
                    s.id === subtaskId ? { ...s, is_completed: currentStatus } : s
                ));
            }
        } catch (error) {
            console.error('[GoalSubtasks] Error updating subtask:', error);
            // Revert optimistic update on error
            setSubtasks(prev => prev.map(s =>
                s.id === subtaskId ? { ...s, is_completed: currentStatus } : s
            ));
        }
    }, [getSession, onSubtasksChange]);

    const handleAddSubtask = useCallback(async () => {
        if (!newSubtaskTitle.trim()) return;
        setIsAdding(true);
        try {
            const session = await getSession();
            if (!session) return;

            const res = await fetch('/api/subtasks', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    goal_id: goalId,
                    title: newSubtaskTitle.trim(),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                // Add to local state immediately
                setSubtasks(prev => [...prev, data.item]);
                setNewSubtaskTitle('');
                skipNextSyncRef.current = true;
                onSubtasksChange?.();
            }
        } catch (error) {
            console.error('Failed to add subtask:', error);
        } finally {
            setIsAdding(false);
        }
    }, [goalId, newSubtaskTitle, getSession, onSubtasksChange]);

    const handleDeleteSubtask = useCallback(async (subtaskId: number) => {
        // Optimistic delete — remove from UI immediately
        const previousSubtasks = subtasks;
        setSubtasks(prev => prev.filter(s => s.id !== subtaskId));
        skipNextSyncRef.current = true;

        try {
            const session = await getSession();
            if (!session) {
                // Revert optimistic delete
                setSubtasks(previousSubtasks);
                alert('Session expired. Please refresh the page.');
                return;
            }

            const res = await fetch(`/api/subtasks/${subtaskId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (res.ok) {
                onSubtasksChange?.();
            } else {
                const responseData = await res.json().catch(() => ({}));
                // Revert optimistic delete on error
                setSubtasks(previousSubtasks);
                alert(`Failed to delete subtask: ${responseData.error || responseData.details || 'Unknown error'}`);
            }
        } catch (error) {
            // Revert optimistic delete on error
            setSubtasks(previousSubtasks);
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [subtasks, getSession, onSubtasksChange]);

    if (loading && subtasks.length === 0) {
        return <div className="text-sm text-white/60">Loading subtasks...</div>;
    }

    const completedCount = subtasks.filter(s => s.is_completed).length;
    const totalCount = subtasks.length;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white/90">Subtasks</h4>
                {totalCount > 0 && (
                    <div className="flex items-center gap-2 text-xs text-white/70">
                        <span>Progress: {completedCount}/{totalCount}</span>
                        <span className="text-white/50">
                            {Math.round((completedCount / totalCount) * 100)}%
                        </span>
                    </div>
                )}
            </div>

            <div className="space-y-1.5">
                {subtasks.map((subtask) => (
                    <div
                        key={subtask.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <button
                            type="button"
                            onClick={() => handleToggleComplete(subtask.id, subtask.is_completed)}
                            className="flex items-center justify-center w-6 h-6 flex-shrink-0 cursor-pointer"
                            aria-label={subtask.is_completed ? 'Mark incomplete' : 'Mark complete'}
                        >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                subtask.is_completed
                                    ? 'bg-purple-500 border-purple-500'
                                    : 'border-white/30 bg-transparent'
                            }`}>
                                {subtask.is_completed && (
                                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                )}
                            </div>
                        </button>
                        <span
                            className={`flex-1 text-sm ${subtask.is_completed
                                ? 'line-through text-white/50'
                                : 'text-white/80'
                                }`}
                        >
                            {subtask.title}
                        </span>
                        <button
                            type="button"
                            onClick={() => handleDeleteSubtask(subtask.id)}
                            className="flex items-center justify-center w-8 h-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer flex-shrink-0 transition-colors"
                            aria-label="Delete subtask"
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>

            <div className="flex gap-2 mt-2">
                <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            handleAddSubtask();
                        }
                    }}
                    placeholder="Add subtask..."
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-[#8B5CF6]"
                    disabled={isAdding}
                />
                <button
                    onClick={handleAddSubtask}
                    disabled={!newSubtaskTitle.trim() || isAdding}
                    className="px-3 py-1.5 text-sm rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Add
                </button>
            </div>
        </div>
    );
}
