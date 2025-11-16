import type { ReactNode } from "react";
import MiniAppTabBar from "./MiniAppTabBar";

interface MiniAppPageProps {
    children: ReactNode;
    className?: string;
    footerSlot?: ReactNode;
}

export default function MiniAppPage({ children, className, footerSlot }: MiniAppPageProps) {
    return (
        <div className="min-h-screen bg-[#0c0f1a] text-white flex flex-col">
            <div className={["w-full max-w-5xl mx-auto px-4 py-6 sm:px-8 flex-1", className ?? ""].join(" ").trim()}>
                {children}
            </div>
            <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-6">
                {footerSlot}
                <MiniAppTabBar />
            </div>
        </div>
    );
}


