'use client';

import { useEffect, useRef, useState } from 'react';

interface WeekPickerProps {
    value: string; // ISO week format: "2024-W47"
    onChange: (week: string) => void;
    placeholder?: string;
    className?: string;
}

// Конвертирует неделю в дату начала недели (воскресенье)
// Формат: YYYY-Www где неделя начинается с воскресенья
function weekToDate(weekStr: string): Date | null {
    const match = weekStr.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);

    // Находим 1 января
    const jan1 = new Date(year, 0, 1);
    const jan1Day = jan1.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Находим первое воскресенье года (или 1 января, если оно воскресенье)
    const firstSunday = new Date(jan1);
    if (jan1Day !== 0) {
        firstSunday.setDate(1 + (7 - jan1Day));
    }
    
    // Добавляем недели (неделя 1 начинается с первого воскресенья)
    const targetSunday = new Date(firstSunday);
    targetSunday.setDate(firstSunday.getDate() + (week - 1) * 7);
    targetSunday.setHours(0, 0, 0, 0);
    
    return targetSunday;
}

// Конвертирует дату в неделю (формат YYYY-Www, неделя начинается с воскресенья)
function dateToWeek(date: Date): string {
    // Используем локальную дату, а не UTC, чтобы избежать проблем с часовыми поясами
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Move to Sunday of current week
    d.setDate(d.getDate() - day);
    
    // Find January 1st of the year
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const jan1Day = jan1.getDay(); // Day of week for Jan 1
    
    // Find the first Sunday of the year (or Jan 1 if it's Sunday)
    const firstSunday = new Date(jan1);
    if (jan1Day !== 0) {
        firstSunday.setDate(1 + (7 - jan1Day));
    }
    
    // Calculate week number: how many weeks from first Sunday to current Sunday
    const diffMs = d.getTime() - firstSunday.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    const weekNo = Math.floor(diffDays / 7) + 1;
    
    // Handle edge case: if current date is before first Sunday, it's week 1 of previous year
    if (weekNo < 1) {
        const prevYear = d.getFullYear() - 1;
        const prevJan1 = new Date(prevYear, 0, 1);
        const prevJan1Day = prevJan1.getDay();
        const prevFirstSunday = new Date(prevJan1);
        if (prevJan1Day !== 0) {
            prevFirstSunday.setDate(1 + (7 - prevJan1Day));
        }
        const prevDiffMs = d.getTime() - prevFirstSunday.getTime();
        const prevDiffDays = Math.floor(prevDiffMs / 86400000);
        const prevWeekNo = Math.floor(prevDiffDays / 7) + 1;
        return `${prevYear}-W${String(prevWeekNo).padStart(2, '0')}`;
    }
    
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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
                const newMonth = new Date(weekDate.getFullYear(), weekDate.getMonth(), 1);
                // Обновляем только если месяц действительно изменился
                if (newMonth.getTime() !== currentMonth.getTime()) {
                    setCurrentMonth(newMonth);
                }
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
        // Всегда вызываем onChange, даже если неделя та же
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

        // Заполняем до конца недели днями следующего месяца (чтобы сетка была полной)
        const totalCells = days.length;
        const remainingCells = 42 - totalCells; // 6 недель * 7 дней = 42
        if (remainingCells > 0 && remainingCells < 7) {
            // Добавляем дни следующего месяца только для завершения последней недели
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            for (let day = 1; day <= remainingCells; day++) {
                days.push(day);
            }
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

    const isInSelectedWeek = (day: number | null, isNextMonth: boolean = false) => {
        if (day === null || !selectedWeekDate) return false;
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        let date: Date;
        if (isNextMonth) {
            const nextMonth = month === 11 ? 0 : month + 1;
            const nextYear = month === 11 ? year + 1 : year;
            date = new Date(nextYear, nextMonth, day);
        } else {
            date = new Date(year, month, day);
        }
        const sunday = new Date(date);
        sunday.setDate(date.getDate() - date.getDay());
        sunday.setHours(0, 0, 0, 0);
        
        const selectedSunday = new Date(selectedWeekDate);
        selectedSunday.setHours(0, 0, 0, 0);
        
        return sunday.getTime() === selectedSunday.getTime();
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
                        {days.map((day, idx) => {
                            const year = currentMonth.getFullYear();
                            const month = currentMonth.getMonth();
                            const firstDay = new Date(year, month, 1).getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            
                            // Определяем, является ли день частью текущего месяца
                            const isCurrentMonth = day !== null && idx >= firstDay && idx < firstDay + daysInMonth;
                            const isNextMonth = day !== null && !isCurrentMonth;
                            
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        if (day !== null) {
                                            if (isNextMonth) {
                                                // Если день из следующего месяца, создаем дату следующего месяца
                                                const nextMonth = month === 11 ? 0 : month + 1;
                                                const nextYear = month === 11 ? year + 1 : year;
                                                const selectedDate = new Date(nextYear, nextMonth, day);
                                                const week = dateToWeek(selectedDate);
                                                onChange(week);
                                                setIsOpen(false);
                                            } else {
                                                handleDateSelect(day);
                                            }
                                        }
                                    }}
                                    disabled={day === null}
                                    className={`
                                        h-7 w-7 rounded-lg text-[11px] font-medium transition
                                        ${day === null ? 'cursor-default' : 'cursor-pointer hover:bg-white/10'}
                                        ${isNextMonth ? 'text-white/40' : ''}
                                        ${isToday(day) && isCurrentMonth ? 'bg-[#8B5CF6]/20 text-[#A78BFA] font-semibold' : ''}
                                        ${isInSelectedWeek(day, isNextMonth) ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white font-semibold' : ''}
                                        ${day !== null && !isToday(day) && !isInSelectedWeek(day) && isCurrentMonth ? 'text-white/90 hover:bg-white/10' : ''}
                                    `}
                                >
                                    {day}
                                </button>
                            );
                        })}
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

