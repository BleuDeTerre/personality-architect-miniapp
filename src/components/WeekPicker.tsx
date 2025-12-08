'use client';

import { useEffect, useRef, useState } from 'react';

interface WeekPickerProps {
    value: string; // ISO week format: "2024-W47"
    onChange: (week: string) => void;
    placeholder?: string;
    className?: string;
}

// Конвертирует ISO неделю в дату начала недели (воскресенье)
function weekToDate(weekStr: string): Date | null {
    const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    // Находим 4 января (всегда в первой неделе года)
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7; // 1 = Monday, 7 = Sunday
    const mondayOfWeek1 = new Date(Date.UTC(year, 0, 4 - jan4Day + 1));

    // Добавляем недели
    const targetMonday = new Date(mondayOfWeek1);
    targetMonday.setUTCDate(mondayOfWeek1.getUTCDate() + (week - 1) * 7);

    // Возвращаем воскресенье, предшествующее ISO-понедельнику
    const targetSunday = new Date(targetMonday);
    targetSunday.setUTCDate(targetMonday.getUTCDate() - 1);
    const sundayLocal = new Date(targetSunday.getFullYear(), targetSunday.getMonth(), targetSunday.getDate());
    sundayLocal.setHours(0, 0, 0, 0);
    return sundayLocal;
}

// Конвертирует дату в неделю (формат YYYY-Www, неделя начинается с воскресенья)
function dateToWeek(date: Date): string {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Move to Sunday of current week
    d.setUTCDate(d.getUTCDate() - day);
    
    // Find January 1st of the year
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const jan1Day = jan1.getUTCDay(); // Day of week for Jan 1
    
    // Find the first Sunday of the year (or Jan 1 if it's Sunday)
    const firstSunday = new Date(jan1);
    if (jan1Day !== 0) {
        firstSunday.setUTCDate(1 + (7 - jan1Day));
    }
    
    // Calculate week number: how many weeks from first Sunday to current Sunday
    const diffMs = d.getTime() - firstSunday.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const weekNo = Math.floor(diffDays / 7) + 1;
    
    // Handle edge case: if current date is before first Sunday, it's week 1 of previous year
    if (weekNo < 1) {
        const prevYear = d.getUTCFullYear() - 1;
        const prevJan1 = new Date(Date.UTC(prevYear, 0, 1));
        const prevJan1Day = prevJan1.getUTCDay();
        const prevFirstSunday = new Date(prevJan1);
        if (prevJan1Day !== 0) {
            prevFirstSunday.setUTCDate(1 + (7 - prevJan1Day));
        }
        const prevDiffMs = d.getTime() - prevFirstSunday.getTime();
        const prevDiffDays = Math.floor(prevDiffMs / 86400000);
        const prevWeekNo = Math.floor(prevDiffDays / 7) + 1;
        return `${prevYear}-W${String(prevWeekNo).padStart(2, '0')}`;
    }
    
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Форматирует неделю для отображения
function formatWeek(weekStr: string): string {
    const sunday = weekToDate(weekStr);
    if (!sunday) return '';
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);

    const formatter: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    return `${sunday.toLocaleDateString('en-US', formatter)} – ${saturday.toLocaleDateString('en-US', formatter)}`;
}

export default function WeekPicker({ value, onChange, placeholder = 'Select week', className = '' }: WeekPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const containerRef = useRef<HTMLDivElement>(null);

    // Закрываем календарь при клике вне его
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isOpen]);

    // Устанавливаем текущий месяц на основе выбранной недели
    useEffect(() => {
        if (value) {
            const weekDate = weekToDate(value);
            if (weekDate) {
                setCurrentMonth(new Date(weekDate.getFullYear(), weekDate.getMonth(), 1));
            }
        }
    }, [value]);

    const selectedWeekDate = value ? weekToDate(value) : null;
    const displayValue = value ? formatWeek(value) : '';

    const handleDateSelect = (day: number) => {
        const selectedDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const week = dateToWeek(selectedDate);
        onChange(week);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleThisWeek = () => {
        const week = dateToWeek(new Date());
        onChange(week);
        setIsOpen(false);
    };

    // Получаем дни месяца
    const getDaysInMonth = () => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const days: (number | null)[] = [];

        // Пустые ячейки для дней предыдущего месяца
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // Дни текущего месяца
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day);
        }

        return days;
    };

    const days = getDaysInMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();

    const isToday = (day: number | null) => {
        if (day === null) return false;
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        return date.toDateString() === today.toDateString();
    };

    const isInSelectedWeek = (day: number | null) => {
        if (day === null || !selectedWeekDate) return false;
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - date.getDay());
        sunday.setHours(0, 0, 0, 0);
        return sunday.getTime() === selectedWeekDate.getTime();
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input
                type="text"
                placeholder={placeholder}
                value={displayValue}
                readOnly
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full ${className} cursor-pointer`}
            />
            {isOpen && (
                <div className="absolute z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-[#1a1b2e] p-2.5 shadow-xl backdrop-blur left-0 sm:left-auto sm:right-0">
                    {/* Header с месяцем и навигацией */}
                    <div className="mb-2 flex items-center justify-between">
                        <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white transition"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="text-xs font-semibold text-white">
                            {monthNames[currentMonth.getMonth()].slice(0, 3)} {currentMonth.getFullYear()}
                        </div>
                        <button
                            type="button"
                            onClick={handleNextMonth}
                            className="rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white transition"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>

                    {/* Дни недели */}
                    <div className="mb-1.5 grid grid-cols-7 gap-0.5">
                        {dayNames.map((day) => (
                            <div key={day} className="text-center text-[10px] font-medium text-white/50 py-0.5">
                                {day.slice(0, 1)}
                            </div>
                        ))}
                    </div>

                    {/* Календарная сетка */}
                    <div className="grid grid-cols-7 gap-0.5">
                        {days.map((day, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => day !== null && handleDateSelect(day)}
                                disabled={day === null}
                                className={`
                                    h-7 w-7 rounded-lg text-[11px] font-medium transition
                                    ${day === null ? 'cursor-default' : 'cursor-pointer hover:bg-white/10'}
                                    ${isToday(day) ? 'bg-[#8B5CF6]/20 text-[#A78BFA] font-semibold' : 'text-white/90'}
                                    ${isInSelectedWeek(day) ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white font-semibold' : ''}
                                    ${day !== null && !isToday(day) && !isInSelectedWeek(day) ? 'hover:bg-white/10' : ''}
                                `}
                            >
                                {day}
                            </button>
                        ))}
                    </div>

                    {/* Кнопка "This Week" */}
                    <button
                        type="button"
                        onClick={handleThisWeek}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10 transition"
                    >
                        This Week
                    </button>
                </div>
            )}
        </div>
    );
}

