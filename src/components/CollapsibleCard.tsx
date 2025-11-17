'use client';

import { type ReactNode, useState } from 'react';

function cn(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(' ');
}

type CollapsibleCardProps = {
    title: string;
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
                'rounded-3xl border border-white/10 bg-[#1a1b2e]',
                open ? 'p-3 sm:p-4' : 'p-2 sm:p-3',
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
                    <span className="text-sm font-semibold text-white">{title}</span>
                    {subtitle && <span className="text-xs text-white/60">{subtitle}</span>}
                </div>
                <div className="flex items-center gap-2">
                    {actionSlot}
                    <span
                        className={cn(
                            'inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-xs text-white/70 transition-transform',
                            open ? 'rotate-180' : 'rotate-0'
                        )}
                    >
                        ⌄
                    </span>
                </div>
            </button>
            <div className={cn('transition-all', open ? 'mt-3 space-y-3' : 'h-0 overflow-hidden')}>
                {open && children}
            </div>
        </section>
    );
}


