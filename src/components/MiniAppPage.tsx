import type { ReactNode } from "react";
import MiniAppTabBar from "./MiniAppTabBar";

interface MiniAppPageProps {
    children: ReactNode;
    className?: string;
    footerSlot?: ReactNode;
}

export default function MiniAppPage({ children, className, footerSlot }: MiniAppPageProps) {
    return (
        <div className="min-h-screen bg-[#05060d] text-white flex flex-col">
            <div className={["flex-1 w-full max-w-5xl mx-auto px-4 py-6 sm:px-8", className ?? ""].join(" ").trim()}>
                {children}
            </div>
            <div className="w-full max-w-3xl mx-auto px-4 pb-4 space-y-3">
                {footerSlot}
                <MiniAppTabBar />
            </div>
        </div>
    );
}


