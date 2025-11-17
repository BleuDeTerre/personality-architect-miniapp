import type { ReactNode } from "react";
import MiniAppTabBar from "./MiniAppTabBar";

interface MiniAppPageProps {
    children: ReactNode;
    className?: string;
    footerSlot?: ReactNode;
}

export default function MiniAppPage({ children, className, footerSlot }: MiniAppPageProps) {
    return (
        <div className="min-h-screen bg-[#0c0f1a] text-white pb-20">
            <div className={["w-full max-w-5xl mx-auto px-4 py-4 sm:px-6", className ?? ""].join(" ").trim()}>
                {children}
            </div>
            {footerSlot && (
                <div className="w-full max-w-3xl mx-auto px-4 pb-3 pt-5">
                    {footerSlot}
                </div>
            )}
            <div className="fixed bottom-0 left-0 right-0 w-full z-50">
                <div className="w-full max-w-3xl mx-auto px-4 pb-3 pt-5">
                    <MiniAppTabBar />
                </div>
            </div>
        </div>
    );
}


