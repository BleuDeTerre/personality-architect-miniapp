'use client';

import { useEffect, useRef, useState } from 'react';

interface DatePickerProps {
    value: string;
    onChange: (date: string) => void;
    placeholder?: string;
    className?: string;
}

export default function DatePicker({ value, onChange, placeholder = 'MM/DD/YYYY', className = '' }: DatePickerProps) {
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

    // Устанавливаем текущий месяц на основе выбранной даты
    useEffect(() => {
        if (value) {
            const date = new Date(value);
            if (!isNaN(date.getTime())) {
                setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
            }
        }
    }, [value]);

    const selectedDate = value ? new Date(value) : null;
    const displayValue = value && selectedDate && !isNaN(selectedDate.getTime())
        ? selectedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
        : '';

    const handleDateSelect = (day: number) => {
        const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        onChange(newDate.toISOString().split('T')[0]);
        setIsOpen(false);
    };

    const handlePrevMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    };

    const handleToday = () => {
        const today = new Date();
        onChange(today.toISOString().split('T')[0]);
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
    const isSelected = (day: number | null) => {
        if (day === null || !selectedDate) return false;
        const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
        return date.toDateString() === selectedDate.toDateString();
    };

    return (
        <div ref={containerRef} className="relative w-full">
            <input
                type="text"
                placeholder={placeholder}
                value={displayValue}
                readOnly
                onClick={() => setIsOpen(!isOpen)}
                className={`${className} cursor-pointer`}
            />
            {isOpen && (
                <div className="absolute z-50 mt-2 w-56 rounded-2xl border border-white/10 bg-[#1a1b2e] p-2.5 shadow-xl backdrop-blur right-0">
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
                                    ${isSelected(day) ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white font-semibold' : ''}
                                    ${day !== null && !isToday(day) && !isSelected(day) ? 'hover:bg-white/10' : ''}
                                `}
                            >
                                {day}
                            </button>
                        ))}
                    </div>

                    {/* Кнопка "Today" */}
                    <button
                        type="button"
                        onClick={handleToday}
                        className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[11px] font-medium text-white/80 hover:bg-white/10 transition"
                    >
                        Today
                    </button>
                </div>
            )}
        </div>
    );
}

