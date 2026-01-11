export const runtime = 'nodejs';
// src/app/api/export/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limit';
import { getUserUnlocks } from '@/lib/featureLimits';

export async function GET(req: NextRequest) {
    // Rate limiting для экспорта данных (строгий лимит)
    const rateLimit = checkRateLimit(req, RATE_LIMIT_PRESETS.EXPORT);
    if (!rateLimit.allowed) {
        return NextResponse.json(
            {
                error: 'rate_limit_exceeded',
                message: 'Too many export requests. Please try again later.',
                retry_after: rateLimit.retryAfter,
            },
            {
                status: 429,
                headers: {
                    'Retry-After': String(rateLimit.retryAfter || 60),
                    'X-RateLimit-Limit': String(rateLimit.limit || 0),
                    'X-RateLimit-Remaining': String(rateLimit.remaining || 0),
                },
            }
        );
    }

    try {
        const { id: userId, token } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        // Проверяем, есть ли у пользователя unlock (habits или goals)
        const unlocks = await getUserUnlocks(supa, userId);
        if (!unlocks.habits && !unlocks.goals) {
            return NextResponse.json(
                { 
                    error: 'unlock_required',
                    message: 'Data export is available only for users with unlocked features. Purchase Unlimited Habits or Unlimited Goals to access data export.',
                },
                { status: 403 }
            );
        }

        const format = new URL(req.url).searchParams.get('format') || 'json';

        // Загружаем все данные пользователя
        const [
            habitsData,
            logsData,
            goalsData,
            subtasksData,
            wheelData,
            wellnessData,
            chatData,
            userData,
            planData,
            profileData
        ] = await Promise.all([
            supa.from('habits').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supa.from('habit_logs').select('*').eq('user_id', userId).order('date', { ascending: false }),
            supa.from('goals').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supa.from('subtasks').select('*').eq('user_id', userId).order('order_index', { ascending: true }),
            supa.from('wheel_scores').select('*').eq('user_id', userId).order('week', { ascending: false }),
            supa.from('daily_wellness_metrics').select('*').eq('user_id', userId).order('date', { ascending: false }),
            supa.from('chat_messages').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
            supa.from('users').select('fid, username, display_name, pfp_url, created_at').eq('id', userId).single(),
            supa.from('user_plans').select('plan, plan_until, created_at').eq('user_id', userId).maybeSingle(),
            supa.from('user_profile_settings').select('main_focus').eq('user_id', userId).maybeSingle(),
        ]);

        const data = {
            profile: {
                user: userData.data || null,
                plan: planData.data || null,
                main_focus: profileData.data?.main_focus || null,
            },
            habits: habitsData.data || [],
            habit_logs: logsData.data || [],
            goals: goalsData.data || [],
            subtasks: subtasksData.data || [],
            wheel_of_life: wheelData.data || [],
            wellness_metrics: wellnessData.data || [],
            chat_history: chatData.data || [],
            exported_at: new Date().toISOString(),
            exported_at_readable: new Date().toLocaleString('ru-RU', { timeZone: 'UTC' }),
        };

        // Группируем подзадачи по целям для удобства
        if (data.subtasks.length > 0) {
            data.goals = data.goals.map((goal: any) => ({
                ...goal,
                subtasks: data.subtasks.filter((st: any) => st.goal_id === goal.id),
            }));
            delete (data as any).subtasks;
        }

        // Группируем логи по привычкам
        if (data.habit_logs.length > 0) {
            data.habits = data.habits.map((habit: any) => ({
                ...habit,
                logs: data.habit_logs.filter((log: any) => log.habit_id === habit.id),
            }));
        }

        // Сохраняем оригинальные данные для CSV (нужны отдельно)
        const originalHabitLogs = [...(data.habit_logs || [])];
        const originalSubtasks = [...(data.subtasks || [])];
        
        // Для CSV нужны все данные отдельно
        const dataForCSV = {
            ...data,
            habit_logs: originalHabitLogs,
            subtasks: originalSubtasks,
        };
        
        switch (format) {
            case 'csv':
                return generateCSVResponse(dataForCSV);
            case 'markdown':
            case 'notion': // Обратная совместимость
            case 'obsidian': // Обратная совместимость
                return generateMarkdownResponse(dataForCSV);
            case 'json':
            default:
                // Используем функцию очистки данных (без ID)
                const cleanedData = cleanDataForExport(dataForCSV);
                return NextResponse.json(cleanedData, {
                headers: {
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename=personality-architect-export-${new Date().toISOString().slice(0, 10)}.json`,
                },
            });
        }
    } catch (error: any) {
        console.error('[Export Data] Error:', error);
        return NextResponse.json({ error: 'Failed to export data', details: error.message }, { status: 500 });
    }
}

// Функция для очистки данных от технических полей (ID, etc.) - только пользовательские данные
function cleanDataForExport(data: any): any {
    // Профиль - только пользовательские данные
    const cleanProfile = data.profile ? {
        username: data.profile.user?.username || null,
        display_name: data.profile.user?.display_name || null,
        main_focus: data.profile.main_focus || null,
        plan: data.profile.plan?.plan || null,
        plan_until: data.profile.plan?.plan_until ? new Date(data.profile.plan.plan_until).toLocaleDateString('ru-RU') : null,
        registration_date: data.profile.user?.created_at ? new Date(data.profile.user.created_at).toLocaleDateString('ru-RU') : null,
    } : null;

    // Привычки - без ID
    // Используем логи из привычки, если они есть (сгруппированные), 
    // иначе ищем в отдельном массиве habit_logs
    const allHabitLogs = data.habit_logs || [];
    const cleanHabits = (data.habits || []).map((habit: any) => {
        // Если логи уже сгруппированы в привычке, используем их
        // Иначе ищем логи по habit_id в отдельном массиве
        const habitLogs = habit.logs || allHabitLogs.filter((log: any) => log.habit_id === habit.id);
        
        return {
            title: habit.title,
            category: habit.category || null,
            target_days_per_week: habit.target_days_per_week,
            is_active: habit.is_active,
            created_date: new Date(habit.created_at).toLocaleDateString('ru-RU'),
            logs: habitLogs.map((log: any) => ({
                date: new Date(log.date).toLocaleDateString('ru-RU'),
                completed: log.is_completed,
            })),
        };
    });

    // Цели - без ID
    // Используем подзадачи из цели, если они есть (сгруппированные),
    // иначе ищем в отдельном массиве subtasks
    const allSubtasks = data.subtasks || [];
    const cleanGoals = (data.goals || []).map((goal: any) => {
        // Если подзадачи уже сгруппированы в цели, используем их
        // Иначе ищем подзадачи по goal_id в отдельном массиве
        const goalSubtasks = goal.subtasks || allSubtasks.filter((st: any) => st.goal_id === goal.id);
        
        return {
            title: goal.title,
            metric: goal.metric || null,
            target: goal.target || null,
            unit: goal.unit || null,
            progress: goal.progress || 0,
            status: goal.status || 'active',
            important: goal.important || false,
            urgent: goal.urgent || false,
            due_date: goal.due_date ? new Date(goal.due_date).toLocaleDateString('ru-RU') : null,
            created_date: goal.created_at ? new Date(goal.created_at).toLocaleDateString('ru-RU') : null,
            subtasks: goalSubtasks.map((st: any) => ({
                title: st.title,
                completed: st.is_completed,
                due_date: st.due_date ? new Date(st.due_date).toLocaleDateString('ru-RU') : null,
            })),
        };
    });

    // Колесо жизни - без ID
    const cleanWheel = (data.wheel_of_life || []).map((w: any) => ({
        week: w.week,
        area: w.area,
        score: w.score,
        date: w.updated_at ? new Date(w.updated_at).toLocaleDateString('ru-RU') : null,
    }));

    // Метрики благополучия - без ID
    const cleanWellness = (data.wellness_metrics || []).map((m: any) => ({
        date: new Date(m.date).toLocaleDateString('ru-RU'),
        stress_level: m.stress_level || null,
        productivity_level: m.productivity_level || null,
        sleep_hours: m.sleep_hours || null,
        work_hours: m.work_hours || null,
    }));

    // История чата - без ID
    const cleanChat = (data.chat_history || []).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
        date: new Date(msg.created_at).toLocaleString('ru-RU'),
    }));

    return {
        profile: cleanProfile,
        habits: cleanHabits,
        goals: cleanGoals,
        wheel_of_life: cleanWheel,
        wellness_metrics: cleanWellness,
        chat_history: cleanChat,
        exported_at: data.exported_at_readable,
    };
}

// CSV формат - все данные (используем функцию из download/route.ts логику)
function generateCSVResponse(data: any): NextResponse {
    const dateStr = new Date().toISOString().slice(0, 10);
    
    // Сохраняем оригинальные данные для CSV
    const originalHabitLogs = [...(data.habit_logs || [])];
    const originalSubtasks = [...(data.subtasks || [])];
    
    const dataForCSV = {
        ...data,
        habit_logs: originalHabitLogs,
        subtasks: originalSubtasks,
    };
    
    const csv = generateFullCSV(dataForCSV);
    
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename=personality-architect-export-${dateStr}.csv`,
        },
    });
}

// Генерация CSV для всех данных
function generateFullCSV(data: any): string {
    const sections: string[] = [];
    
    // Секция 0: PROFILE (Профиль пользователя)
    if (data.profile && data.profile.user) {
        sections.push('=== PROFILE ===');
        const profileHeaders = ['username', 'display_name', 'main_focus', 'plan', 'plan_until', 'registration_date'];
        const profileRows = [[
            data.profile.user.username || '',
            data.profile.user.display_name || '',
            data.profile.main_focus || '',
            data.profile.plan?.plan || 'free',
            data.profile.plan?.plan_until ? new Date(data.profile.plan.plan_until).toLocaleDateString('ru-RU') : '',
            data.profile.user.created_at ? new Date(data.profile.user.created_at).toLocaleDateString('ru-RU') : '',
        ]];
        sections.push([
            profileHeaders.join(','),
            ...profileRows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n'));
        sections.push('\n');
    }
    
    // Секция 1: Habits
    sections.push('=== HABITS ===');
    sections.push(generateHabitsCSV(data.habits || []));
    sections.push('\n');
    
    // Секция 2: Habit Logs
    if (data.habit_logs && data.habit_logs.length > 0) {
        sections.push('=== HABIT LOGS ===');
        const logHeaders = ['habit_title', 'date', 'completed'];
        
        // Создаем маппинг habit_id -> title
        const habitMap = new Map();
        (data.habits || []).forEach((h: any) => {
            habitMap.set(h.id, h.title);
        });
        
        const logRows = data.habit_logs.map((log: any) => [
            habitMap.get(log.habit_id) || 'Unknown',
            new Date(log.date).toLocaleDateString('ru-RU'),
            log.is_completed ? 'Да' : 'Нет',
        ]);
        sections.push([
            logHeaders.join(','),
            ...logRows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n'));
        sections.push('\n');
    }
    
    // Секция 3: Goals
    if (data.goals && data.goals.length > 0) {
        sections.push('=== GOALS ===');
        const goalHeaders = ['title', 'metric', 'target', 'unit', 'progress', 'status', 'important', 'urgent', 'due_date', 'created_date'];
        const goalRows = data.goals.map((goal: any) => [
            goal.title || '',
            goal.metric || '',
            goal.target || '',
            goal.unit || '',
            goal.progress || 0,
            goal.status || 'active',
            goal.important ? 'Да' : 'Нет',
            goal.urgent ? 'Да' : 'Нет',
            goal.due_date ? new Date(goal.due_date).toLocaleDateString('ru-RU') : '',
            goal.created_at ? new Date(goal.created_at).toLocaleDateString('ru-RU') : '',
        ]);
        sections.push([
            goalHeaders.join(','),
            ...goalRows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n'));
        sections.push('\n');
    }
    
    // Секция 3.1: Subtasks - используем отдельный массив subtasks напрямую
    if (data.subtasks && data.subtasks.length > 0) {
        sections.push('=== GOAL SUBTASKS ===');
        const subtaskHeaders = ['goal_title', 'subtask_title', 'completed', 'due_date'];
        
        // Создаем маппинг goal_id -> title
        const goalMap = new Map();
        (data.goals || []).forEach((goal: any) => {
            goalMap.set(goal.id, goal.title);
        });
        
        const subtaskRows = data.subtasks.map((st: any) => [
            goalMap.get(st.goal_id) || 'Unknown',
            st.title || '',
            st.is_completed ? 'Да' : 'Нет',
            st.due_date ? new Date(st.due_date).toLocaleDateString('ru-RU') : '',
        ]);
        sections.push([
            subtaskHeaders.join(','),
            ...subtaskRows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n'));
        sections.push('\n');
    }
    
    // Секция 4: Wheel of Life
    if (data.wheel_of_life && data.wheel_of_life.length > 0) {
        sections.push('=== WHEEL OF LIFE ===');
        const wheelHeaders = ['week', 'area', 'score', 'date'];
        const wheelRows = data.wheel_of_life.map((w: any) => [
            w.week,
            w.area,
            w.score,
            w.updated_at ? new Date(w.updated_at).toLocaleDateString('ru-RU') : '',
        ]);
        sections.push([
            wheelHeaders.join(','),
            ...wheelRows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n'));
        sections.push('\n');
    }
    
    // Секция 5: Wellness Metrics
    if (data.wellness_metrics && data.wellness_metrics.length > 0) {
        sections.push('=== WELLNESS METRICS ===');
        const wellnessHeaders = ['date', 'stress_level', 'productivity_level', 'sleep_hours', 'work_hours'];
        const wellnessRows = data.wellness_metrics.map((m: any) => [
            new Date(m.date).toLocaleDateString('ru-RU'),
            m.stress_level || '',
            m.productivity_level || '',
            m.sleep_hours || '',
            m.work_hours || '',
        ]);
        sections.push([
            wellnessHeaders.join(','),
            ...wellnessRows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n'));
        sections.push('\n');
    }
    
    // Секция 6: Chat History
    if (data.chat_history && data.chat_history.length > 0) {
        sections.push('=== CHAT HISTORY ===');
        const chatHeaders = ['date', 'role', 'content'];
        const chatRows = data.chat_history.map((msg: any) => [
            new Date(msg.created_at).toLocaleString('ru-RU'),
            msg.role === 'user' ? 'Пользователь' : 'AI Коуч',
            msg.content.replace(/"/g, '""').replace(/\n/g, ' ').substring(0, 500),
        ]);
        sections.push([
            chatHeaders.join(','),
            ...chatRows.map((r: any[]) => r.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
        ].join('\n'));
    }
    
    return sections.join('\n');
}

function generateHabitsCSV(habits: any[]): string {
    const headers = ['title', 'category', 'target_days_per_week', 'is_active', 'created_date', 'total_logs'];
    const rows = habits.map(h => [
        h.title || '',
        h.category || '',
        h.target_days_per_week || 0,
        h.is_active ? 'Активна' : 'Неактивна',
        new Date(h.created_at).toLocaleDateString('ru-RU'),
        h.logs?.length || 0,
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
}

// Универсальный Markdown формат - работает для Notion, Obsidian и других редакторов
function generateMarkdownResponse(data: any): NextResponse {
    const markdown = generateMarkdown(data);
    const dateStr = new Date().toISOString().slice(0, 10);
    
    return new NextResponse(markdown, {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename=personality-architect-export-${dateStr}.md`,
        },
    });
}

// Универсальный Markdown формат - работает для Notion, Obsidian и других редакторов
function generateMarkdown(data: any): string {
    const lines: string[] = [];
    
    // Frontmatter для Obsidian (Notion его проигнорирует)
    lines.push('---');
    lines.push('tags: [personality-architect, export]');
    lines.push(`exported_at: ${data.exported_at}`);
    lines.push('---');
    lines.push('\n');
    
    lines.push('# Personality Architect - Экспорт данных\n');
    lines.push(`**Дата экспорта:** ${data.exported_at_readable}\n`);
    
    // Профиль - БЕЗ FID и ID
    if (data.profile && data.profile.user) {
        lines.push('## 👤 Профиль\n');
        lines.push(`- **Username:** ${data.profile.user.username || 'N/A'}`);
        lines.push(`- **Display Name:** ${data.profile.user.display_name || 'N/A'}`);
        lines.push(`- **Main Focus:** ${data.profile.main_focus || 'Не указано'}`);
        if (data.profile.main_focus) {
            const focusTag = data.profile.main_focus.replace(/\s+/g, '-').toLowerCase();
            lines.push(`- **Main Focus Tag:** #${focusTag}`);
        }
        lines.push(`- **Plan:** ${data.profile.plan?.plan || 'free'}`);
        if (data.profile.plan?.plan_until) {
            lines.push(`- **Plan Until:** ${new Date(data.profile.plan.plan_until).toLocaleDateString('ru-RU')}`);
        }
        lines.push(`- **Регистрация:** ${new Date(data.profile.user.created_at).toLocaleDateString('ru-RU')}\n`);
    }
    
    // Привычки - БЕЗ ID, ВСЕ логи
    if (data.habits && data.habits.length > 0) {
        lines.push(`## ✅ Привычки (${data.habits.length})\n`);
        data.habits.forEach((habit: any) => {
            const tags = [];
            if (habit.category) tags.push(`#${habit.category.toLowerCase()}`);
            tags.push(habit.is_active ? '#активная' : '#неактивная');
            lines.push(`### ${habit.title}${habit.category ? ` (${habit.category})` : ''} ${tags.join(' ')}`);
            lines.push(`- **Цель:** ${habit.target_days_per_week} дней/неделю`);
            lines.push(`- **Статус:** ${habit.is_active ? 'Активна' : 'Неактивна'}`);
            lines.push(`- **Создана:** ${new Date(habit.created_at).toLocaleDateString('ru-RU')}`);
            if (habit.logs && habit.logs.length > 0) {
                lines.push(`- **Выполнений:** ${habit.logs.length}`);
                lines.push(`- **Логи выполнения:**`);
                habit.logs.forEach((log: any) => {
                    lines.push(`  - ${new Date(log.date).toLocaleDateString('ru-RU')}: ${log.is_completed ? '✅' : '❌'}`);
                });
            }
            lines.push('');
        });
    }
    
    // Цели - БЕЗ ID, ВСЕ данные
    if (data.goals && data.goals.length > 0) {
        lines.push(`## 🎯 Цели (${data.goals.length})\n`);
        data.goals.forEach((goal: any) => {
            lines.push(`### ${goal.title} #${goal.status || 'active'}`);
            lines.push(`- **Метрика:** ${goal.metric || 'N/A'}`);
            lines.push(`- **Целевое значение:** ${goal.target || ''} ${goal.unit || ''}`);
            lines.push(`- **Прогресс:** ${goal.progress || 0}%`);
            lines.push(`- **Статус:** ${goal.status || 'active'}`);
            if (goal.important !== null && goal.important !== undefined) lines.push(`- **Важное:** ${goal.important ? 'Да' : 'Нет'}`);
            if (goal.urgent !== null && goal.urgent !== undefined) lines.push(`- **Срочное:** ${goal.urgent ? 'Да' : 'Нет'}`);
            if (goal.due_date) {
                lines.push(`- **Дедлайн:** ${new Date(goal.due_date).toLocaleDateString('ru-RU')}`);
            }
            if (goal.created_at) {
                lines.push(`- **Создана:** ${new Date(goal.created_at).toLocaleDateString('ru-RU')}`);
            }
            if (goal.subtasks && goal.subtasks.length > 0) {
                lines.push(`- **Подзадачи (${goal.subtasks.length}):**`);
                goal.subtasks.forEach((st: any) => {
                    const check = st.is_completed ? '✅' : '⏳';
                    lines.push(`  ${check} ${st.title}${st.due_date ? ` (до ${new Date(st.due_date).toLocaleDateString('ru-RU')})` : ''}`);
                });
            }
            lines.push('');
        });
    }
    
    // Колесо жизни - ВСЕ недели
    if (data.wheel_of_life && data.wheel_of_life.length > 0) {
        lines.push(`## 🎡 Колесо жизни (${data.wheel_of_life.length} записей)\n`);
        const weeks = [...new Set(data.wheel_of_life.map((w: any) => w.week))] as string[];
        weeks.forEach((week: string) => {
            lines.push(`### Неделя ${week}`);
            const weekData = data.wheel_of_life.filter((w: any) => w.week === week);
            weekData.forEach((item: any) => {
                lines.push(`- **${item.area}:** ${item.score}/10`);
            });
            lines.push('');
        });
    }
    
    // Метрики благополучия - ВСЕ записи
    if (data.wellness_metrics && data.wellness_metrics.length > 0) {
        lines.push(`## 📊 Метрики благополучия (${data.wellness_metrics.length} записей)\n`);
        lines.push('| Дата | Стресс | Продуктивность | Сон (ч) | Работа (ч) |');
        lines.push('|------|--------|----------------|---------|------------|');
        data.wellness_metrics.forEach((m: any) => {
            lines.push(`| ${new Date(m.date).toLocaleDateString('ru-RU')} | ${m.stress_level || '-'} | ${m.productivity_level || '-'} | ${m.sleep_hours || '-'} | ${m.work_hours || '-'} |`);
        });
        lines.push('');
    }
    
    // История чата - ВСЕ сообщения
    if (data.chat_history && data.chat_history.length > 0) {
        lines.push(`## 💬 История чата с AI коучем (${data.chat_history.length} сообщений)\n`);
        data.chat_history.forEach((msg: any, idx: number) => {
            const role = msg.role === 'user' ? '👤 Вы' : '🤖 AI Коуч';
            lines.push(`### ${role} #${idx + 1} - ${new Date(msg.created_at).toLocaleString('ru-RU')}`);
            lines.push(msg.content);
            lines.push('');
        });
    }
    
    return lines.join('\n');
}


