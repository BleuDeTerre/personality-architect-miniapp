'use client';

import { useMemo } from 'react';
import { CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react';

type Goal = {
    id: number;
    title: string;
    important?: boolean;
    urgent?: boolean;
    status: string;
    due_date?: string | null;
};

type EisenhowerMatrixProps = {
    goals: Goal[];
    onGoalClick?: (goal: Goal) => void;
    onQuadrantClick?: (quadrant: 'important-urgent' | 'important-not-urgent' | 'not-important-urgent' | 'not-important-not-urgent') => void;
};

type Quadrant = {
    id: 'important-urgent' | 'important-not-urgent' | 'not-important-urgent' | 'not-important-not-urgent';
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    bgColor: string;
    borderColor: string;
    textColor: string;
    goals: Goal[];
};

export default function EisenhowerMatrix({ goals, onGoalClick, onQuadrantClick }: EisenhowerMatrixProps) {
    const activeGoals = useMemo(() => goals.filter(g => g.status === 'active'), [goals]);

    const quadrants: Quadrant[] = useMemo(() => {
        return [
            {
                id: 'important-urgent',
                title: 'Important & Urgent',
                subtitle: 'Do First',
                icon: <AlertCircle className="h-5 w-5" />,
                bgColor: 'bg-red-500/10',
                borderColor: 'border-red-500/50',
                textColor: 'text-red-400',
                goals: activeGoals.filter(g => g.important && g.urgent),
            },
            {
                id: 'important-not-urgent',
                title: 'Important & Not Urgent',
                subtitle: 'Schedule',
                icon: <CheckCircle2 className="h-5 w-5" />,
                bgColor: 'bg-green-500/10',
                borderColor: 'border-green-500/50',
                textColor: 'text-green-400',
                goals: activeGoals.filter(g => g.important && !g.urgent),
            },
            {
                id: 'not-important-urgent',
                title: 'Not Important & Urgent',
                subtitle: 'Delegate',
                icon: <Info className="h-5 w-5" />,
                bgColor: 'bg-yellow-500/10',
                borderColor: 'border-yellow-500/50',
                textColor: 'text-yellow-400',
                goals: activeGoals.filter(g => !g.important && g.urgent),
            },
            {
                id: 'not-important-not-urgent',
                title: 'Not Important & Not Urgent',
                subtitle: 'Eliminate',
                icon: <XCircle className="h-5 w-5" />,
                bgColor: 'bg-gray-500/10',
                borderColor: 'border-gray-500/50',
                textColor: 'text-gray-400',
                goals: activeGoals.filter(g => !g.important && !g.urgent),
            },
        ];
    }, [activeGoals]);

    return (
        <div className="grid grid-cols-2 gap-2">
            {quadrants.map((quadrant) => (
                <button
                    key={quadrant.id}
                    onClick={() => onQuadrantClick?.(quadrant.id)}
                    className={`rounded-xl border-2 p-3 flex flex-col gap-2 ${quadrant.bgColor} ${quadrant.borderColor} transition-all hover:opacity-80 active:scale-95`}
                >
                    <div className="flex items-center gap-2">
                        <div className={quadrant.textColor}>
                            {quadrant.icon}
                        </div>
                        <div className="flex-1 text-left">
                            <h3 className={`text-xs font-semibold ${quadrant.textColor}`}>
                                {quadrant.title}
                            </h3>
                            <p className="text-xs text-white/60">{quadrant.subtitle}</p>
                        </div>
                        <span className={`text-sm font-bold ${quadrant.textColor}`}>
                            {quadrant.goals.length}
                        </span>
                    </div>
                    {quadrant.goals.length > 0 && (
                        <div className="space-y-1 max-h-24 overflow-y-auto">
                            {quadrant.goals.slice(0, 3).map((goal) => (
                                <div
                                    key={goal.id}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onGoalClick?.(goal);
                                    }}
                                    className="text-xs text-white/80 truncate px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
                                >
                                    {goal.title}
                                </div>
                            ))}
                            {quadrant.goals.length > 3 && (
                                <p className="text-xs text-white/50 px-2">
                                    +{quadrant.goals.length - 3} more
                                </p>
                            )}
                        </div>
                    )}
                </button>
            ))}
        </div>
    );
}

