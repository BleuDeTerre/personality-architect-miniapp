import type { ReactNode } from "react";
import MiniAppTabBar from "./MiniAppTabBar";

interface MiniAppPageProps {
    children: ReactNode;
    className?: string;
    footerSlot?: ReactNode;
}

export default function MiniAppPage({ children, className, footerSlot }: MiniAppPageProps) {
    return (
        <div className="min-h-screen bg-[#0c0f1a] text-white pb-16">
            <div className={["w-full max-w-5xl mx-auto px-3 py-1 sm:px-4", className ?? ""].join(" ").trim()}>
                {children}
            </div>
            {footerSlot && (
                <div className="w-full max-w-3xl mx-auto px-3 pb-2 pt-3">
                    {footerSlot}
                </div>
            )}
            <div className="fixed bottom-0 left-0 right-0 w-full z-50">
                <div className="w-full max-w-3xl mx-auto px-3 pb-2 pt-3">
                    <MiniAppTabBar />
                </div>
            </div>
        </div>
    );
}


