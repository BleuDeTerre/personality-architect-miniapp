export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireUserFromReq } from '@/lib/auth';
import { createUserServerClient } from '@/lib/supabase';

// GET /api/analytics/wellness - Get wellness analytics and correlations
export async function GET(req: NextRequest) {
    try {
        const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
        if (!token) {
            return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
        }

        const { id: userId } = await requireUserFromReq(req);
        const supa = createUserServerClient(token);

        const { searchParams } = new URL(req.url);
        const days = parseInt(searchParams.get('days') || '30', 10);

        // Get date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        // Fetch wellness metrics
        const { data: wellnessData, error: wellnessError } = await supa
            .from('daily_wellness_metrics')
            .select('*')
            .eq('user_id', userId)
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .order('date', { ascending: true });

        if (wellnessError) {
            console.error('[Wellness Analytics] Error fetching wellness:', wellnessError);
            return NextResponse.json({ error: 'Failed to fetch wellness data' }, { status: 500 });
        }

        if (!wellnessData || wellnessData.length === 0) {
            return NextResponse.json({
                trends: [],
                averages: null,
                correlations: [],
                insights: [],
            });
        }

        // Calculate averages
        const validData = wellnessData.filter(d => 
            d.stress_level !== null || 
            d.productivity_level !== null || 
            d.sleep_hours !== null || 
            d.work_hours !== null
        );

        if (validData.length === 0) {
            return NextResponse.json({
                trends: [],
                averages: null,
                correlations: [],
                insights: [],
            });
        }

        const averages = {
            stress_level: validData.reduce((sum, d) => sum + (d.stress_level || 0), 0) / validData.filter(d => d.stress_level !== null).length || 0,
            productivity_level: validData.reduce((sum, d) => sum + (d.productivity_level || 0), 0) / validData.filter(d => d.productivity_level !== null).length || 0,
            sleep_hours: validData.reduce((sum, d) => sum + (d.sleep_hours || 0), 0) / validData.filter(d => d.sleep_hours !== null).length || 0,
            work_hours: validData.reduce((sum, d) => sum + (d.work_hours || 0), 0) / validData.filter(d => d.work_hours !== null).length || 0,
        };

        // Calculate trends (today vs yesterday)
        const sortedData = [...wellnessData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const todayData = sortedData[sortedData.length - 1] || null;
        const yesterdayData = sortedData.length >= 2 ? sortedData[sortedData.length - 2] : null;

        // Define optimal ranges for each metric
        const optimalRanges: Record<string, { min: number; max: number; lowerIsBetter?: boolean }> = {
            stress_level: { min: 3, max: 5, lowerIsBetter: true },
            productivity_level: { min: 6, max: 8, lowerIsBetter: false },
            sleep_hours: { min: 7, max: 8, lowerIsBetter: false },
            work_hours: { min: 6, max: 8, lowerIsBetter: false },
        };

        const trends = [
            {
                metric: 'stress_level',
                current: todayData?.stress_level ?? null,
                previous: yesterdayData?.stress_level ?? null,
            },
            {
                metric: 'productivity_level',
                current: todayData?.productivity_level ?? null,
                previous: yesterdayData?.productivity_level ?? null,
            },
            {
                metric: 'sleep_hours',
                current: todayData?.sleep_hours ?? null,
                previous: yesterdayData?.sleep_hours ?? null,
            },
            {
                metric: 'work_hours',
                current: todayData?.work_hours ?? null,
                previous: yesterdayData?.work_hours ?? null,
            },
        ].map(t => {
            const change = t.current !== null && t.previous !== null ? t.current - t.previous : null;
            const changePercent = t.current !== null && t.previous !== null && t.previous !== 0
                ? ((t.current - t.previous) / t.previous) * 100
                : null;
            
            // Determine trend (improving, declining, or stable if no change)
            let trend: 'improving' | 'declining' | 'stable' | null = null;
            if (change !== null) {
                // If change is very small (less than 0.1), consider it stable
                if (Math.abs(change) < 0.1) {
                    trend = 'stable';
                } else {
                    const range = optimalRanges[t.metric];
                    if (range) {
                        if (range.lowerIsBetter) {
                            // For stress: lower is better
                            trend = change < 0 ? 'improving' : 'declining';
                        } else {
                            // For productivity/sleep/work: higher is better
                            trend = change > 0 ? 'improving' : 'declining';
                        }
                    }
                }
            }
            // If no previous data, use average from last 7 days for current
            let currentValue = t.current;
            if (currentValue === null && sortedData.length > 0) {
                const last7Days = sortedData.slice(-7);
                const avgValue = last7Days
                    .filter(d => d[t.metric as keyof typeof d] !== null)
                    .reduce((sum, d) => sum + (Number(d[t.metric as keyof typeof d]) || 0), 0) / 
                    last7Days.filter(d => d[t.metric as keyof typeof d] !== null).length;
                if (!isNaN(avgValue) && avgValue > 0) {
                    currentValue = avgValue;
                }
            }

            // Determine status (Optimal/Below optimal/Above optimal)
            let status: 'optimal' | 'below' | 'above' | null = null;
            if (t.current !== null) {
                const range = optimalRanges[t.metric];
                if (range) {
                    if (t.current >= range.min && t.current <= range.max) {
                        status = 'optimal';
                    } else if (t.current < range.min) {
                        status = 'below';
                    } else {
                        status = 'above';
                    }
                }
            }

            return {
                ...t,
                current: currentValue,
                change,
                changePercent,
                trend,
                status,
                optimalRange: optimalRanges[t.metric] || null,
            };
        });

        // Calculate correlations between wellness metrics
        const correlations: Array<{ metric_a: string; metric_b: string; correlation: number }> = [];
        const metrics = ['stress_level', 'productivity_level', 'sleep_hours', 'work_hours'];

        for (let i = 0; i < metrics.length; i++) {
            for (let j = i + 1; j < metrics.length; j++) {
                const metricA = metrics[i];
                const metricB = metrics[j];
                const pairs = validData
                    .filter(d => d[metricA as keyof typeof d] !== null && d[metricB as keyof typeof d] !== null)
                    .map(d => ({
                        a: Number(d[metricA as keyof typeof d]) || 0,
                        b: Number(d[metricB as keyof typeof d]) || 0,
                    }));

                if (pairs.length >= 5) {
                    const avgA = pairs.reduce((sum, p) => sum + p.a, 0) / pairs.length;
                    const avgB = pairs.reduce((sum, p) => sum + p.b, 0) / pairs.length;

                    const numerator = pairs.reduce((sum, p) => sum + (p.a - avgA) * (p.b - avgB), 0);
                    const denomA = Math.sqrt(pairs.reduce((sum, p) => sum + Math.pow(p.a - avgA, 2), 0));
                    const denomB = Math.sqrt(pairs.reduce((sum, p) => sum + Math.pow(p.b - avgB, 2), 0));

                    const correlation = denomA > 0 && denomB > 0 ? numerator / (denomA * denomB) : 0;

                    if (Math.abs(correlation) > 0.3) {
                        correlations.push({
                            metric_a: metricA,
                            metric_b: metricB,
                            correlation: Number(correlation.toFixed(3)),
                        });
                    }
                }
            }
        }

        // Get habit logs for correlation with wellness
        const { data: habitLogs } = await supa
            .from('habit_logs')
            .select('habit_id, date, value')
            .eq('user_id', userId)
            .eq('value', true)
            .gte('date', startDateStr)
            .lte('date', endDateStr);

        // Get habits
        const { data: habits } = await supa
            .from('habits')
            .select('id, title')
            .eq('user_id', userId)
            .eq('is_active', true);

        const habitMap = new Map(habits?.map(h => [h.id, h.title]) || []);

        // Calculate habit-wellness correlations
        const habitCorrelations: Array<{ habit: string; metric: string; correlation: number }> = [];

        if (habitLogs && habitLogs.length > 0) {
            // Group logs by date
            const logsByDate = new Map<string, number>();
            habitLogs.forEach(log => {
                const count = logsByDate.get(log.date) || 0;
                logsByDate.set(log.date, count + 1);
            });

            // Calculate correlation between habit completion count and each wellness metric
            metrics.forEach(metric => {
                const pairs = validData
                    .filter(d => d[metric as keyof typeof d] !== null)
                    .map(d => ({
                        wellness: Number(d[metric as keyof typeof d]) || 0,
                        habits: logsByDate.get(d.date) || 0,
                    }))
                    .filter(p => p.habits > 0);

                if (pairs.length >= 5) {
                    const avgWellness = pairs.reduce((sum, p) => sum + p.wellness, 0) / pairs.length;
                    const avgHabits = pairs.reduce((sum, p) => sum + p.habits, 0) / pairs.length;

                    const numerator = pairs.reduce((sum, p) => sum + (p.wellness - avgWellness) * (p.habits - avgHabits), 0);
                    const denomWellness = Math.sqrt(pairs.reduce((sum, p) => sum + Math.pow(p.wellness - avgWellness, 2), 0));
                    const denomHabits = Math.sqrt(pairs.reduce((sum, p) => sum + Math.pow(p.habits - avgHabits, 2), 0));

                    const correlation = denomWellness > 0 && denomHabits > 0 ? numerator / (denomWellness * denomHabits) : 0;

                    if (Math.abs(correlation) > 0.3) {
                        habitCorrelations.push({
                            habit: 'Total habits completed',
                            metric,
                            correlation: Number(correlation.toFixed(3)),
                        });
                    }
                }
            });
        }

        // Generate insights
        const insights: string[] = [];
        
        if (trends[2].current !== null && trends[2].current < 7) {
            insights.push(`Your average sleep is ${trends[2].current.toFixed(1)} hours. Consider aiming for 7-8 hours for better productivity.`);
        }
        
        if (trends[0].current !== null && trends[0].current > 7) {
            insights.push(`Your stress level is high (${trends[0].current.toFixed(1)}/10). Consider stress-reduction habits like meditation or exercise.`);
        }
        
        if (trends[1].current !== null && trends[2].current !== null && trends[1].current > 6 && trends[2].current < 6) {
            insights.push(`You're productive but getting insufficient sleep. More sleep could boost your productivity even further.`);
        }

        const strongCorrelation = correlations.find(c => Math.abs(c.correlation) > 0.6);
        if (strongCorrelation) {
            const direction = strongCorrelation.correlation > 0 ? 'increases' : 'decreases';
            insights.push(`${strongCorrelation.metric_a.replace('_', ' ')} strongly ${direction} when ${strongCorrelation.metric_b.replace('_', ' ')} is higher.`);
        }

        return NextResponse.json({
            trends,
            averages,
            correlations: [...correlations, ...habitCorrelations],
            insights,
            dataPoints: validData.length,
        });
    } catch (error: any) {
        console.error('[Wellness Analytics] Unexpected error:', error);
        return NextResponse.json({ error: 'Failed to analyze wellness data', message: error?.message || 'Unknown error' }, { status: 500 });
    }
}

