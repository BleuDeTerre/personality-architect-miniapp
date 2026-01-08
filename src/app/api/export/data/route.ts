export const runtime = 'nodejs';
// src/app/api/export/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

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

        switch (format) {
            case 'csv':
                return generateCSVResponse(data);
            case 'notion':
                return generateNotionMarkdownResponse(data);
            case 'obsidian':
                return generateObsidianMarkdownResponse(data);
            case 'json':
            default:
                return NextResponse.json(data, {
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

// CSV формат - основные данные
function generateCSVResponse(data: any): NextResponse {
    const dateStr = new Date().toISOString().slice(0, 10);
    const csv = generateHabitsCSV(data.habits);
    
    return new NextResponse(csv, {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename=habits-export-${dateStr}.csv`,
        },
    });
}

function generateHabitsCSV(habits: any[]): string {
    const headers = ['id', 'title', 'category', 'target_days_per_week', 'is_active', 'created_at', 'total_logs'];
    const rows = habits.map(h => [
        h.id,
        h.title || '',
        h.category || '',
        h.target_days_per_week || 0,
        h.is_active ? 'true' : 'false',
        h.created_at || '',
        h.logs?.length || 0,
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
}

// Markdown для Notion - структурированный формат
function generateNotionMarkdownResponse(data: any): NextResponse {
    const markdown = generateNotionMarkdown(data);
    const dateStr = new Date().toISOString().slice(0, 10);
    
    return new NextResponse(markdown, {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename=notion-export-${dateStr}.md`,
        },
    });
}

function generateNotionMarkdown(data: any): string {
    const lines: string[] = [];
    
    lines.push('# Personality Architect - Экспорт данных\n');
    lines.push(`**Дата экспорта:** ${data.exported_at_readable}\n`);
    
    // Профиль
    if (data.profile.user) {
        lines.push('## 👤 Профиль\n');
        lines.push(`- **Username:** ${data.profile.user.username || 'N/A'}`);
        lines.push(`- **Display Name:** ${data.profile.user.display_name || 'N/A'}`);
        lines.push(`- **Main Focus:** ${data.profile.main_focus || 'Не указано'}`);
        lines.push(`- **Plan:** ${data.profile.plan?.plan || 'free'}`);
        lines.push(`- **Регистрация:** ${new Date(data.profile.user.created_at).toLocaleDateString('ru-RU')}\n`);
    }
    
    // Привычки
    if (data.habits.length > 0) {
        lines.push('## ✅ Привычки\n');
        data.habits.forEach((habit: any) => {
            lines.push(`### ${habit.title}${habit.category ? ` (${habit.category})` : ''}`);
            lines.push(`- **Цель:** ${habit.target_days_per_week} дней/неделю`);
            lines.push(`- **Статус:** ${habit.is_active ? 'Активна' : 'Неактивна'}`);
            lines.push(`- **Создана:** ${new Date(habit.created_at).toLocaleDateString('ru-RU')}`);
            if (habit.logs && habit.logs.length > 0) {
                lines.push(`- **Выполнений:** ${habit.logs.length}`);
                const recentLogs = habit.logs.slice(0, 10);
                lines.push(`- **Последние выполнения:**`);
                recentLogs.forEach((log: any) => {
                    lines.push(`  - ${new Date(log.date).toLocaleDateString('ru-RU')}`);
                });
            }
            lines.push('');
        });
    }
    
    // Цели
    if (data.goals.length > 0) {
        lines.push('## 🎯 Цели\n');
        data.goals.forEach((goal: any) => {
            lines.push(`### ${goal.title}`);
            lines.push(`- **Метрика:** ${goal.metric || 'N/A'}`);
            lines.push(`- **Целевое значение:** ${goal.target} ${goal.unit || ''}`);
            lines.push(`- **Прогресс:** ${goal.progress || 0}%`);
            lines.push(`- **Статус:** ${goal.status || 'active'}`);
            if (goal.due_date) {
                lines.push(`- **Дедлайн:** ${new Date(goal.due_date).toLocaleDateString('ru-RU')}`);
            }
            if (goal.subtasks && goal.subtasks.length > 0) {
                lines.push(`- **Подзадачи:**`);
                goal.subtasks.forEach((st: any) => {
                    const check = st.is_completed ? '✅' : '⏳';
                    lines.push(`  ${check} ${st.title}`);
                });
            }
            lines.push('');
        });
    }
    
    // Колесо жизни
    if (data.wheel_of_life.length > 0) {
        lines.push('## 🎡 Колесо жизни\n');
        const weeks = [...new Set(data.wheel_of_life.map((w: any) => w.week))];
        weeks.slice(0, 12).forEach((week: string) => {
            lines.push(`### Неделя ${week}`);
            const weekData = data.wheel_of_life.filter((w: any) => w.week === week);
            weekData.forEach((item: any) => {
                lines.push(`- **${item.area}:** ${item.score}/10`);
            });
            lines.push('');
        });
    }
    
    // Метрики благополучия
    if (data.wellness_metrics.length > 0) {
        lines.push('## 📊 Метрики благополучия\n');
        lines.push('| Дата | Стресс | Продуктивность | Сон (ч) | Работа (ч) |');
        lines.push('|------|--------|----------------|---------|------------|');
        data.wellness_metrics.slice(0, 30).forEach((m: any) => {
            lines.push(`| ${new Date(m.date).toLocaleDateString('ru-RU')} | ${m.stress_level || '-'} | ${m.productivity_level || '-'} | ${m.sleep_hours || '-'} | ${m.work_hours || '-'} |`);
        });
        lines.push('');
    }
    
    // История чата (первые 20 сообщений)
    if (data.chat_history.length > 0) {
        lines.push('## 💬 История чата с AI коучем\n');
        data.chat_history.slice(0, 20).forEach((msg: any) => {
            const role = msg.role === 'user' ? '👤 Вы' : '🤖 AI Коуч';
            lines.push(`### ${role} - ${new Date(msg.created_at).toLocaleString('ru-RU')}`);
            lines.push(msg.content);
            lines.push('');
        });
        if (data.chat_history.length > 20) {
            lines.push(`\n*... и еще ${data.chat_history.length - 20} сообщений*\n`);
        }
    }
    
    return lines.join('\n');
}

// Markdown для Obsidian - с wikilinks и тегами
function generateObsidianMarkdownResponse(data: any): NextResponse {
    const markdown = generateObsidianMarkdown(data);
    const dateStr = new Date().toISOString().slice(0, 10);
    
    return new NextResponse(markdown, {
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename=obsidian-export-${dateStr}.md`,
        },
    });
}

function generateObsidianMarkdown(data: any): string {
    const lines: string[] = [];
    
    // Главная страница
    lines.push('---');
    lines.push('tags: [personality-architect, export]');
    lines.push(`exported_at: ${data.exported_at}`);
    lines.push('---');
    lines.push('\n# Personality Architect - Экспорт данных\n');
    lines.push(`**Дата экспорта:** ${data.exported_at_readable}\n`);
    
    // Навигация
    lines.push('## Навигация\n');
    if (data.profile.user) lines.push('- [[Personality Architect - Профиль|Профиль]]');
    if (data.habits.length > 0) lines.push('- [[Personality Architect - Привычки|Привычки]]');
    if (data.goals.length > 0) lines.push('- [[Personality Architect - Цели|Цели]]');
    if (data.wheel_of_life.length > 0) lines.push('- [[Personality Architect - Колесо жизни|Колесо жизни]]');
    if (data.wellness_metrics.length > 0) lines.push('- [[Personality Architect - Метрики благополучия|Метрики]]');
    if (data.chat_history.length > 0) lines.push('- [[Personality Architect - Чат|История чата]]');
    lines.push('');
    
    // Профиль
    if (data.profile.user) {
        lines.push('## Профиль\n');
        lines.push(`**Username:** ${data.profile.user.username || 'N/A'}`);
        lines.push(`**Display Name:** ${data.profile.user.display_name || 'N/A'}`);
        if (data.profile.main_focus) {
            const focusTag = data.profile.main_focus.replace(/\s+/g, '-').toLowerCase();
            lines.push(`**Main Focus:** #${focusTag}`);
        }
        lines.push(`**Plan:** #plan-${data.profile.plan?.plan || 'free'}`);
        lines.push(`**Регистрация:** ${new Date(data.profile.user.created_at).toLocaleDateString('ru-RU')}\n`);
    }
    
    // Привычки с wikilinks
    if (data.habits.length > 0) {
        lines.push('## Привычки\n');
        data.habits.forEach((habit: any) => {
            const habitTitle = habit.title.replace(/[^\w\s-]/g, '');
            const tags = [];
            if (habit.category) tags.push(`#${habit.category.toLowerCase()}`);
            tags.push(habit.is_active ? '#активная' : '#неактивная');
            lines.push(`- [[Привычка - ${habitTitle}|${habit.title}]] ${tags.join(' ')}`);
        });
        lines.push('');
    }
    
    // Цели с wikilinks
    if (data.goals.length > 0) {
        lines.push('## Цели\n');
        data.goals.forEach((goal: any) => {
            const goalTitle = goal.title.replace(/[^\w\s-]/g, '');
            const tags = [];
            tags.push(`#${goal.status || 'active'}`);
            if (goal.progress) tags.push(`прогресс:${goal.progress}%`);
            lines.push(`- [[Цель - ${goalTitle}|${goal.title}]] ${tags.join(' ')}`);
        });
        lines.push('');
    }
    
    // Колесо жизни
    if (data.wheel_of_life.length > 0) {
        lines.push('## Колесо жизни\n');
        lines.push('```mermaid');
        lines.push('pie title Последняя неделя');
        const lastWeek = data.wheel_of_life[0]?.week;
        const lastWeekData = data.wheel_of_life.filter((w: any) => w.week === lastWeek);
        lastWeekData.forEach((item: any) => {
            lines.push(`  "${item.area}" : ${item.score}`);
        });
        lines.push('```\n');
    }
    
    // Метрики
    if (data.wellness_metrics.length > 0) {
        lines.push('## Метрики благополучия\n');
        lines.push('| Дата | Стресс | Продуктивность | Сон | Работа |');
        lines.push('|------|--------|----------------|-----|--------|');
        data.wellness_metrics.slice(0, 30).forEach((m: any) => {
            const dateStr = new Date(m.date).toLocaleDateString('ru-RU');
            lines.push(`| [[${dateStr}]] | ${m.stress_level || '-'} | ${m.productivity_level || '-'} | ${m.sleep_hours || '-'} | ${m.work_hours || '-'} |`);
        });
        lines.push('');
    }
    
    // История чата
    if (data.chat_history.length > 0) {
        lines.push('## История чата\n');
        lines.push(`Всего сообщений: ${data.chat_history.length}\n`);
        data.chat_history.slice(0, 10).forEach((msg: any) => {
            lines.push(`> **${msg.role === 'user' ? 'Вы' : 'AI'}** (${new Date(msg.created_at).toLocaleString('ru-RU')})`);
            lines.push(`> ${msg.content.replace(/\n/g, '\n> ')}`);
            lines.push('');
        });
    }
    
    return lines.join('\n');
}

