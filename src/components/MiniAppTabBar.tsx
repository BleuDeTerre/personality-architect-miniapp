"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo, useRef, useEffect } from "react";

type NavItem = {
    href: string;
    label: string;
    icon: string;
};

const NAV_ITEMS: NavItem[] = [
    { href: "/", label: "Home", icon: "🏠" },
    { href: "/habits", label: "Habits", icon: "✅" },
    { href: "/wheel", label: "Wheel", icon: "🎡" },
    { href: "/goals", label: "Goals", icon: "🎯" },
    { href: "/streaks", label: "Streaks", icon: "🔥" },
    { href: "/analytics", label: "Analytics", icon: "📊" },
    { href: "/leaderboard", label: "Leaders", icon: "🏅" },
    { href: "/chat", label: "AI Coach", icon: "🤖" },
    { href: "/profile", label: "Profile", icon: "👤" },
];

interface MiniAppTabBarProps {
    className?: string;
}

const MiniAppTabBar = memo(function MiniAppTabBar({ className }: MiniAppTabBarProps) {
    const pathname = usePathname();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeLinkRef = useRef<HTMLAnchorElement>(null);

    const activeIndex = useMemo(() => {
        if (!pathname) return -1;
        return NAV_ITEMS.findIndex(item => {
            if (item.href === "/") {
                return pathname === "/";
            }
            return pathname.startsWith(item.href);
        });
    }, [pathname]);

    // Scroll to center when active item changes
    useEffect(() => {
        if (activeLinkRef.current && scrollContainerRef.current) {
            const { offsetLeft, offsetWidth } = activeLinkRef.current;
            const { clientWidth } = scrollContainerRef.current;
            scrollContainerRef.current.scrollTo({
                left: offsetLeft - clientWidth / 2 + offsetWidth / 2,
                behavior: 'smooth',
            });
        }
    }, [activeIndex]);

    // Handle click to scroll to center
    const handleLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
        const link = event.currentTarget;
        const container = scrollContainerRef.current;

        if (container) {
            const { offsetLeft, offsetWidth } = link;
            const { clientWidth } = container;
            container.scrollTo({
                left: offsetLeft - clientWidth / 2 + offsetWidth / 2,
                behavior: 'smooth',
            });
        }
    };

    return (
        <div
            ref={scrollContainerRef}
            className={[
                "w-full max-w-sm mx-auto rounded-t-3xl bg-[#0c0f1a]/80 border-t border-x border-white/10 shadow-2xl shadow-black/50 backdrop-blur",
                "overflow-x-auto no-scrollbar",
                className ?? "",
            ]
                .join(" ")
                .trim()}
        >
            <nav className="flex items-center gap-1.5 px-2 py-2.5 min-w-max">
                {NAV_ITEMS.map((item, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            ref={isActive ? activeLinkRef : null}
                            onClick={handleLinkClick}
                            className={[
                                "flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all whitespace-nowrap",
                                "flex-shrink-0",
                                isActive
                                    ? "bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-lg shadow-[#8B5CF6]/40"
                                    : "text-white/70 hover:text-white hover:bg-white/5",
                            ].join(" ")}
                        >
                            <span className="text-sm leading-none">{item.icon}</span>
                            <span className="font-medium">{item.label}</span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
});

export default MiniAppTabBar;

