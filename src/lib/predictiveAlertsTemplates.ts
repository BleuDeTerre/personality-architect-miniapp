/**
 * Templates for Predictive Alerts (replacing AI)
 */

export function getRandomVariant<T>(variants: T[]): T {
  if (variants.length === 0) return variants[0];
  return variants[Math.floor(Math.random() * variants.length)];
}

export function generatePredictiveAlert(
  habitTitle: string,
  dayName: string,
  hasPattern: boolean,
  todayCount: number,
  totalCompletions: number,
  riskScore: number
): { message: string; suggestion: string } {
  if (hasPattern && todayCount > 0) {
    // Есть паттерн - пользователь обычно выполняет в этот день недели
    const messages = [
      `Don't forget ${habitTitle} today! You usually complete it on ${dayName}s (${todayCount} times recently).`,
      `${habitTitle} is waiting for you! You've done it ${todayCount} times on ${dayName}s before - keep the momentum going!`,
      `Remember ${habitTitle}? You usually do it on ${dayName}s. Today is the perfect day to continue!`,
      `Your ${dayName} routine includes ${habitTitle}. Don't let today be an exception!`,
      `${habitTitle} calls! You've completed it ${todayCount} times on ${dayName}s - today should be no different!`,
      `It's ${dayName} - time for ${habitTitle}! You've been consistent on this day (${todayCount} times).`,
      `Your ${dayName} streak with ${habitTitle} is strong (${todayCount} times). Keep it going today!`,
      `${habitTitle} fits perfectly into your ${dayName} routine. Don't skip it today!`,
      `You've built a ${dayName} habit with ${habitTitle} (${todayCount} times). Continue the pattern!`,
      `Today is ${dayName} - your usual day for ${habitTitle}. Make it happen!`,
    ];
    
    const suggestions = [
      `Consider setting a reminder for ${dayName}s to maintain consistency.`,
      `Since you usually do this on ${dayName}s, try scheduling it at the same time today.`,
      `Keep your ${dayName} routine strong - this habit fits perfectly into it!`,
      `Your ${dayName} pattern is working - stick with it!`,
      `Schedule ${habitTitle} at your usual ${dayName} time to maintain the routine.`,
    ];
    
    return {
      message: getRandomVariant(messages),
      suggestion: getRandomVariant(suggestions),
    };
  } else if (totalCompletions > 0) {
    // Есть история выполнения, но нет четкого паттерна
    const messages = [
      `Don't forget to complete ${habitTitle} today!`,
      `${habitTitle} is waiting for you today. You've done it ${totalCompletions} times recently - keep it up!`,
      `Time to check off ${habitTitle}! You've been consistent with ${totalCompletions} completions.`,
      `Your habit ${habitTitle} needs attention today. Build on your ${totalCompletions} previous completions!`,
      `${habitTitle} is calling! You've already completed it ${totalCompletions} times - don't break the momentum!`,
      `You've made progress with ${habitTitle} (${totalCompletions} times). Keep building on that success today!`,
      `Your ${totalCompletions} completions of ${habitTitle} show you can do this. Make today count!`,
      `${habitTitle} needs your attention today. You've done it ${totalCompletions} times - you've got this!`,
      `Don't let ${habitTitle} slip today. You've been consistent (${totalCompletions} times) - keep it going!`,
      `Time for ${habitTitle}! Your ${totalCompletions} previous completions prove you can do this.`,
    ];
    
    const suggestions = [
      `Try to complete this habit to build consistency.`,
      `Every completion counts - you've already done it ${totalCompletions} times!`,
      `Set a reminder to help you remember this habit today.`,
      `Build on your ${totalCompletions} completions by adding one more today!`,
      `Your consistency (${totalCompletions} times) shows you're capable - keep it up!`,
    ];
    
    return {
      message: getRandomVariant(messages),
      suggestion: getRandomVariant(suggestions),
    };
  } else {
    // Новая привычка или мало данных
    const messages = [
      `Don't forget to complete ${habitTitle} today!`,
      `${habitTitle} is waiting for you. Start building your consistency today!`,
      `Time to check off ${habitTitle}! Every day counts.`,
      `Your habit ${habitTitle} needs attention today. Let's make it happen!`,
      `${habitTitle} is ready for you today. Start building your streak!`,
      `Today is a perfect day to begin with ${habitTitle}. Every journey starts with one step!`,
      `${habitTitle} awaits! Start your consistency journey today.`,
      `Don't wait - ${habitTitle} needs you today. Begin building your habit now!`,
      `Your first step with ${habitTitle} starts today. Make it count!`,
      `${habitTitle} is calling. Today is the day to start your habit journey!`,
    ];
    
    const suggestions = [
      `Try to complete this habit to build consistency.`,
      `Set a reminder to help you remember this habit.`,
      `Start building your streak with this habit today!`,
      `Every expert was once a beginner - start your journey today!`,
      `The best time to start was yesterday, the second best is today!`,
    ];
    
    return {
      message: getRandomVariant(messages),
      suggestion: getRandomVariant(suggestions),
    };
  }
}

