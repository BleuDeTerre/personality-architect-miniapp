"use client";

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/**
 * Переключатель темы (light/dark mode)
 * Соответствует требованиям Base: "App supports light and dark modes consistently"
 */
export default function ThemeToggle() {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        
        // Загружаем сохраненную тему из localStorage
        const savedTheme = typeof window !== 'undefined' 
            ? (localStorage.getItem('theme') as 'light' | 'dark' | null) || 'dark'
            : 'dark';
        
        setTheme(savedTheme);
        applyTheme(savedTheme);
    }, []);

    const applyTheme = (newTheme: 'light' | 'dark') => {
        if (typeof document === 'undefined') return;
        
        const root = document.documentElement;
        if (newTheme === 'light') {
            root.setAttribute('data-theme', 'light');
        } else {
            root.removeAttribute('data-theme');
        }
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        applyTheme(newTheme);
        
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', newTheme);
        }
    };

    if (!mounted) {
        // Показываем placeholder, чтобы избежать hydration mismatch
        return (
            <button
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/60 transition"
                aria-label="Toggle theme"
            >
                <Sun className="h-5 w-5" />
            </button>
        );
    }

    return (
        <button
            onClick={toggleTheme}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 flex items-center justify-center text-white transition-all"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            {theme === 'dark' ? (
                <Sun className="h-5 w-5 text-white" />
            ) : (
                <Moon className="h-5 w-5 text-white" />
            )}
        </button>
    );
}
