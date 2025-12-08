'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useMiniApp } from '@neynar/react';

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
    const { isSDKLoaded } = useMiniApp();
    const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks || []);
    const [loading, setLoading] = useState(false);
    const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    useEffect(() => {
        if (initialSubtasks) {
            setSubtasks(initialSubtasks);
        } else {
            loadSubtasks();
        }
    }, [goalId, initialSubtasks]);

    const loadSubtasks = async () => {
        if (!isSDKLoaded) return;
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const res = await fetch(`/api/subtasks?goal_id=${goalId}`, {
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
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

    const handleToggleComplete = async (subtaskId: number, currentStatus: boolean) => {
        if (!isSDKLoaded) {
            console.log('[GoalSubtasks] SDK not loaded');
            return;
        }
        
        console.log('[GoalSubtasks] Toggle subtask:', subtaskId, 'current:', currentStatus);
        
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.log('[GoalSubtasks] No session');
                return;
            }

            const newStatus = !currentStatus;
            console.log('[GoalSubtasks] Updating subtask to:', newStatus);
            
            const res = await fetch(`/api/subtasks/${subtaskId}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ is_completed: newStatus }),
            });

            if (res.ok) {
                console.log('[GoalSubtasks] Subtask updated successfully');
                const updated = subtasks.map(s => 
                    s.id === subtaskId ? { ...s, is_completed: newStatus } : s
                );
                setSubtasks(updated);
                onSubtasksChange?.();
            } else {
                console.error('[GoalSubtasks] Failed to update subtask:', res.status);
                const errorData = await res.json().catch(() => ({}));
                console.error('[GoalSubtasks] Error details:', errorData);
            }
        } catch (error) {
            console.error('[GoalSubtasks] Error updating subtask:', error);
        }
    };

    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim() || !isSDKLoaded) return;
        setIsAdding(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
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
                setSubtasks([...subtasks, data.item]);
                setNewSubtaskTitle('');
                onSubtasksChange?.();
            }
        } catch (error) {
            console.error('Failed to add subtask:', error);
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeleteSubtask = async (subtaskId: number) => {
        if (!isSDKLoaded) return;
        
        if (!confirm('Delete this subtask?')) return;

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session || !session.access_token) {
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

            const responseData = await res.json().catch(() => ({}));

            if (res.ok) {
                setSubtasks(subtasks.filter(s => s.id !== subtaskId));
                onSubtasksChange?.();
            } else {
                alert(`Failed to delete subtask: ${responseData.error || responseData.details || 'Unknown error'}`);
            }
        } catch (error) {
            alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

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
                        <input
                            type="checkbox"
                            checked={subtask.is_completed}
                            onChange={() => handleToggleComplete(subtask.id, subtask.is_completed)}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-2 cursor-pointer flex-shrink-0"
                        />
                        <span
                            className={`flex-1 text-sm ${
                                subtask.is_completed
                                    ? 'line-through text-white/50'
                                    : 'text-white/80'
                            }`}
                        >
                            {subtask.title}
                        </span>
                        <button
                            type="button"
                            data-subtask-id={subtask.id}
                            onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleDeleteSubtask(subtask.id);
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                e.nativeEvent.stopImmediatePropagation();
                                handleDeleteSubtask(subtask.id);
                            }}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 cursor-pointer flex-shrink-0"
                            style={{ touchAction: 'manipulation' }}
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
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleAddSubtask();
                        }
                    }}
                    placeholder="Add subtask..."
                    className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/40 focus:outline-none focus:border-purple-500/50"
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

