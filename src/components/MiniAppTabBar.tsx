"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useMemo, useRef, useEffect } from "react";
import { emojiToMaterialIcon } from "@/lib/iconMapper";

type NavItem = {
    href: string;
    label: string;
    icon: string;
    color: string; // Цвет категории для подсветки
};

const NAV_ITEMS: NavItem[] = [
    { href: "/", label: "Home", icon: "🏠", color: "#8b5cf6" }, // Фиолетовый по умолчанию
    { href: "/habits", label: "Habits", icon: "✅", color: "#f472b6" }, // Розовый/Коралловый
    { href: "/wheel", label: "Wheel", icon: "🎡", color: "#8b5cf6" }, // Фиолетовый
    { href: "/goals", label: "Goals", icon: "🎯", color: "#10b981" }, // Зеленый
    { href: "/streaks", label: "Streaks", icon: "🔥", color: "#f87171" }, // Красный
    { href: "/analytics", label: "Analytics", icon: "📊", color: "#3b82f6" }, // Синий
    { href: "/chat", label: "AI Coach", icon: "🤖", color: "#8b5cf6" }, // Фиолетовый
    { href: "/leaderboard", label: "Leaders", icon: "🏅", color: "#8b5cf6" }, // Фиолетовый
    { href: "/profile", label: "Profile", icon: "👤", color: "#8b5cf6" }, // Фиолетовый
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
                "w-full max-w-md mx-auto rounded-xl bg-[#0c0f1a]/80 border border-white/10 shadow-2xl shadow-black/50 backdrop-blur",
                "overflow-x-auto no-scrollbar",
                className ?? "",
            ]
                .join(" ")
                .trim()}
        >
            <nav className="flex items-center gap-1.5 px-3 py-1 min-w-max">
                {NAV_ITEMS.map((item, index) => {
                    const isActive = index === activeIndex;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            ref={isActive ? activeLinkRef : null}
                            onClick={handleLinkClick}
                            className={[
                                "flex flex-col items-center gap-1 rounded-lg px-3 py-1 text-xs transition-all whitespace-nowrap",
                                "flex-shrink-0 w-20",
                                isActive
                                    ? "text-white"
                                    : "text-white/70 hover:text-white hover:bg-white/5",
                            ].join(" ")}
                            style={isActive ? {
                                backgroundColor: `${item.color}20`, // 20% прозрачности для фона
                            } : undefined}
                        >
                            {(() => {
                                const materialIcon = emojiToMaterialIcon(item.icon);
                                if (materialIcon) {
                                    return (
                                        <span
                                            className={`material-symbols-rounded text-lg leading-none ${isActive ? '' : 'opacity-70'}`}
                                            style={isActive ? {
                                                filter: `drop-shadow(0 0 8px ${item.color}60)`, // Свечение вокруг иконки
                                                color: item.color,
                                            } : undefined}
                                        >
                                            {materialIcon}
                                        </span>
                                    );
                                }
                                return (
                                    <span
                                        className="text-lg leading-none"
                                        style={isActive ? {
                                            filter: `drop-shadow(0 0 8px ${item.color}60)`, // Свечение вокруг иконки
                                        } : undefined}
                                    >
                                        {item.icon}
                                    </span>
                                );
                            })()}
                            <span
                                className="font-medium"
                                style={isActive ? {
                                    color: item.color, // Цвет текста активной категории
                                } : undefined}
                            >
                                {item.label}
                            </span>
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
});

export default MiniAppTabBar;

