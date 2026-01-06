'use client';

import { type ReactNode, useState } from 'react';

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

type CollapsibleCardProps = {
    title: string | ReactNode;
    subtitle?: string;
    children: ReactNode;
    defaultOpen?: boolean;
    className?: string;
    actionSlot?: ReactNode;
};

export default function CollapsibleCard({
    title,
    subtitle,
    children,
    defaultOpen = false,
    className,
    actionSlot,
}: CollapsibleCardProps) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section
            className={cn(
                'rounded-2xl border border-white/10 bg-[#1a1b2e]',
                open ? 'p-1.5 sm:p-2' : 'p-1.5 sm:p-2',
                className
            )}
        >
            <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="flex w-full items-center justify-between gap-2 text-left"
                aria-expanded={open}
            >
                <div className="flex flex-col">
                    <div className="text-sm font-semibold text-white">{title}</div>
                    {subtitle && <span className="text-xs text-white/60">{subtitle}</span>}
                </div>
                <div className="flex items-center gap-2">
                    {actionSlot}
                    <span
                        className={cn(
                            'inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm text-white/80 transition-all',
                            open ? 'rotate-180 shadow-[0_0_12px_rgba(139,92,246,0.35)] border-white/25' : 'rotate-0'
                        )}
                        aria-hidden="true"
                    >
                        <svg
                            viewBox="0 0 20 20"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5 stroke-current"
                        >
                            <path d="M5 8l5 4 5-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                </div>
            </button>
            <div className={cn('transition-all', open ? 'mt-2 space-y-1.5' : 'h-0 overflow-hidden')}>
                {open && children}
            </div>
        </section>
    );
}


