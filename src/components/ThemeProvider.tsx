"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";

type ThemeContextValue = {
    surface: string;
    border: string;
    text: string;
    muted: string;
};

const ThemeContext = createContext<ThemeContextValue>({
    surface: "var(--surface-1)",
    border: "var(--border-1)",
    text: "var(--text-1)",
    muted: "var(--muted-1)",
});

interface ThemeProviderProps {
    children: ReactNode;
}

export function useThemeTokens() {
    return useContext(ThemeContext);
}

export default function ThemeProvider({ children }: ThemeProviderProps) {
    const value = useMemo<ThemeContextValue>(
        () => ({
            surface: "#121325",
            border: "#2A2B3E",
            text: "#E9ECF1",
            muted: "#AAB1C2",
        }),
        []
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}


