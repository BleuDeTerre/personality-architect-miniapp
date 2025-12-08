/**
 * Templates for Analytics Facts (replacing AI)
 */

export function generateAnalyticsFacts(
  topHabits: Array<{ habit: string; count: number }>,
  daysStats: Array<{ day: string; count: number }>,
  totalLogs: number
): string[] {
  const facts: string[] = [];
  
  // Факт 1: Общая статистика (несколько вариантов)
  if (totalLogs > 0) {
    const totalFacts = [
      `You've completed ${totalLogs} habit${totalLogs === 1 ? '' : 's'} in the last 90 days.`,
      `Over the past 90 days, you've logged ${totalLogs} habit completion${totalLogs === 1 ? '' : 's'}.`,
      `Your total habit completions in the last 90 days: ${totalLogs}.`,
      `In the last 3 months, you've completed ${totalLogs} habit${totalLogs === 1 ? '' : 's'}.`,
    ];
    facts.push(totalFacts[0]); // Используем первый вариант
  }
  
  // Факт 2: Топ привычка (несколько вариантов)
  if (topHabits.length > 0) {
    const topHabit = topHabits[0];
    const topFacts = [
      `Your most active habit is "${topHabit.habit}" with ${topHabit.count} completion${topHabit.count === 1 ? '' : 's'}.`,
      `"${topHabit.habit}" is your top habit with ${topHabit.count} completion${topHabit.count === 1 ? '' : 's'} in the last 90 days.`,
      `You've completed "${topHabit.habit}" ${topHabit.count} time${topHabit.count === 1 ? '' : 's'} - making it your most frequent habit.`,
      `"${topHabit.habit}" leads your habits with ${topHabit.count} completion${topHabit.count === 1 ? '' : 's'}.`,
    ];
    facts.push(topFacts[0]);
  }
  
  // Факт 3: Сравнение равных привычек
  if (topHabits.length >= 2) {
    const equalHabits = topHabits.filter(h => h.count === topHabits[0].count);
    if (equalHabits.length >= 2) {
      const habitNames = equalHabits.map(h => `"${h.habit}"`).join(' and ');
      facts.push(`${habitNames} are tied with ${equalHabits[0].count} completion${equalHabits[0].count === 1 ? '' : 's'} each.`);
    }
  }
  
  // Факт 4: Самый активный день недели (несколько вариантов)
  if (daysStats.length > 0) {
    const peakDay = daysStats[0];
    const dayName = peakDay.day === 'Sun' ? 'Sunday' : peakDay.day === 'Mon' ? 'Monday' : peakDay.day === 'Tue' ? 'Tuesday' : peakDay.day === 'Wed' ? 'Wednesday' : peakDay.day === 'Thu' ? 'Thursday' : peakDay.day === 'Fri' ? 'Friday' : 'Saturday';
    const peakFacts = [
      `You're most active on ${dayName}s with ${peakDay.count} habit completion${peakDay.count === 1 ? '' : 's'}.`,
      `${dayName}s are your peak activity days with ${peakDay.count} habit completion${peakDay.count === 1 ? '' : 's'}.`,
      `Your highest activity day is ${dayName} with ${peakDay.count} completion${peakDay.count === 1 ? '' : 's'}.`,
      `${dayName}s see the most habit activity from you (${peakDay.count} completion${peakDay.count === 1 ? '' : 's'}).`,
    ];
    facts.push(peakFacts[0]);
  }
  
  // Факт 5: Наименее активный день недели
  if (daysStats.length > 1) {
    const leastActiveDay = daysStats[daysStats.length - 1];
    if (leastActiveDay.count < daysStats[0].count) {
      const dayName = leastActiveDay.day === 'Sun' ? 'Sunday' : leastActiveDay.day === 'Mon' ? 'Monday' : leastActiveDay.day === 'Tue' ? 'Tuesday' : leastActiveDay.day === 'Wed' ? 'Wednesday' : leastActiveDay.day === 'Thu' ? 'Thursday' : leastActiveDay.day === 'Fri' ? 'Friday' : 'Saturday';
      const leastFacts = [
        `Your least active day is ${dayName} with ${leastActiveDay.count} completion${leastActiveDay.count === 1 ? '' : 's'}.`,
        `${dayName}s are your quietest days with only ${leastActiveDay.count} habit completion${leastActiveDay.count === 1 ? '' : 's'}.`,
        `You complete the fewest habits on ${dayName}s (${leastActiveDay.count} completion${leastActiveDay.count === 1 ? '' : 's'}).`,
      ];
      facts.push(leastFacts[0]);
    }
  }
  
  // Факт 6: Среднее количество привычек в день (несколько вариантов)
  if (totalLogs > 0) {
    const avgPerDay = (totalLogs / 90).toFixed(1);
    const avgFacts = [
      `On average, you complete ${avgPerDay} habit${parseFloat(avgPerDay) === 1 ? '' : 's'} per day.`,
      `Your daily average is ${avgPerDay} habit completion${parseFloat(avgPerDay) === 1 ? '' : 's'} per day.`,
      `You average ${avgPerDay} habit${parseFloat(avgPerDay) === 1 ? '' : 's'} completed each day.`,
      `Daily average: ${avgPerDay} habit${parseFloat(avgPerDay) === 1 ? '' : 's'} per day over the last 90 days.`,
    ];
    facts.push(avgFacts[0]);
  }
  
  // Факт 7: Вторая по популярности привычка
  if (topHabits.length >= 2) {
    const secondHabit = topHabits[1];
    facts.push(`Your second most active habit is "${secondHabit.habit}" with ${secondHabit.count} completion${secondHabit.count === 1 ? '' : 's'}.`);
  }
  
  // Факт 8: Третья по популярности привычка
  if (topHabits.length >= 3) {
    const thirdHabit = topHabits[2];
    facts.push(`"${thirdHabit.habit}" is your third most active habit with ${thirdHabit.count} completion${thirdHabit.count === 1 ? '' : 's'}.`);
  }
  
  // Факт 9: Разница между самым активным и наименее активным днем
  if (daysStats.length > 1) {
    const peakDay = daysStats[0];
    const leastActiveDay = daysStats[daysStats.length - 1];
    const difference = peakDay.count - leastActiveDay.count;
    if (difference > 0) {
      facts.push(`There's a ${difference} completion difference between your most active day (${peakDay.count}) and least active day (${leastActiveDay.count}).`);
    }
  }
  
  // Факт 10: Процент активности (если есть данные)
  if (topHabits.length > 0 && totalLogs > 0) {
    const topHabit = topHabits[0];
    const percentage = ((topHabit.count / totalLogs) * 100).toFixed(0);
    if (parseFloat(percentage) >= 20) {
      facts.push(`"${topHabit.habit}" accounts for ${percentage}% of all your habit completions.`);
    }
  }
  
  // Возвращаем максимум 5-7 фактов (раньше было 5, теперь можем вернуть больше)
  return facts.slice(0, 7);
}

