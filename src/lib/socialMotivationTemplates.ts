/**
 * Templates for Social Motivation (Cast Text) - replacing AI
 */

export function getRandomVariant<T>(variants: T[]): T {
  if (variants.length === 0) return variants[0];
  return variants[Math.floor(Math.random() * variants.length)];
}

export function generateSocialMotivationText(
  milestone: string,
  currentStreak: number,
  bestStreak: number,
  context?: {
    habits?: string;
    goals?: string;
    completedHabits?: number;
    totalHabits?: number;
  }
): string {
  const messages: string[] = [];
  
  // Определяем тип milestone
  const isStreakMilestone = milestone.toLowerCase().includes('streak') || milestone.toLowerCase().includes('day');
  const isLevelMilestone = milestone.toLowerCase().includes('level');
  const isGoalMilestone = milestone.toLowerCase().includes('goal') || milestone.toLowerCase().includes('achieved');
  
  // Шаблоны для streak milestones
  if (isStreakMilestone) {
    messages.push(
      `🎯 ${milestone}! Building better habits one day at a time. Consistency is key! #habits #progress`,
      `🔥 ${milestone}! Every day counts. Small steps lead to big changes! #habits #consistency`,
      `💪 ${milestone}! Showing up every day is the secret. Keep going! #habits #streak`,
      `✨ ${milestone}! Progress over perfection. One day at a time! #habits #growth`,
      `🚀 ${milestone}! Building the life I want, one habit at a time! #habits #journey`,
      `🌟 ${milestone}! Consistency beats intensity. Keep showing up! #habits #progress`,
      `💜 ${milestone}! Every day is a new chance to be better. Let's go! #habits #motivation`,
      `🎯 ${milestone}! Small daily improvements lead to remarkable results! #habits #consistency`,
      `🔥 ${milestone}! The best time to start was yesterday. The second best is now! #habits #progress`,
      `💪 ${milestone}! Building habits that stick. One day at a time! #habits #streak`,
      `✨ ${milestone}! Progress, not perfection. Every day counts! #habits #growth`,
      `🚀 ${milestone}! Showing up is 80% of success. Keep going! #habits #journey`,
    );
    
    if (currentStreak >= 7) {
      messages.push(
        `🔥 ${milestone}! A week of consistency - that's how habits are built! #habits #streak`,
        `💪 ${milestone}! One week strong! The momentum is real! #habits #progress`,
      );
    }
    
    if (currentStreak >= 30) {
      messages.push(
        `🌟 ${milestone}! A month of consistency - this is who I am now! #habits #streak`,
        `🎯 ${milestone}! 30 days strong! Habits are becoming automatic! #habits #progress`,
      );
    }
  }
  
  // Шаблоны для level milestones
  else if (isLevelMilestone) {
    messages.push(
      `⚡️ ${milestone}! Leveling up my life, one habit at a time! #habits #growth`,
      `🎯 ${milestone}! Progress unlocked! Every level brings new possibilities! #habits #levelup`,
      `🔥 ${milestone}! Leveling up isn't just about numbers - it's about becoming better! #habits #progress`,
      `💪 ${milestone}! New level, new me! The journey continues! #habits #growth`,
      `✨ ${milestone}! Leveling up through consistent action. Keep going! #habits #progress`,
      `🚀 ${milestone}! Every level is a milestone. Celebrating the progress! #habits #journey`,
      `🌟 ${milestone}! Leveling up by showing up. Consistency wins! #habits #growth`,
      `💜 ${milestone}! New level unlocked! The grind continues! #habits #progress`,
    );
  }
  
  // Шаблоны для goal milestones
  else if (isGoalMilestone) {
    messages.push(
      `✅ ${milestone}! Goals are achieved one step at a time! #goals #progress`,
      `🎯 ${milestone}! Setting goals is easy. Achieving them takes consistency! #goals #habits`,
      `🔥 ${milestone}! Goals without action are just wishes. Taking action! #goals #progress`,
      `💪 ${milestone}! Every goal achieved is a step toward the life I want! #goals #growth`,
      `✨ ${milestone}! Goals are the roadmap. Habits are the vehicle! #goals #habits`,
      `🚀 ${milestone}! Achieving goals through daily habits. Let's go! #goals #progress`,
      `🌟 ${milestone}! Goals achieved = habits executed consistently! #goals #habits`,
      `💜 ${milestone}! One goal down, many more to go! The journey continues! #goals #progress`,
    );
  }
  
  // Общие шаблоны с контекстом привычек
  if (context?.completedHabits !== undefined && context?.totalHabits !== undefined) {
    const { completedHabits, totalHabits } = context;
    if (completedHabits === totalHabits && totalHabits > 0) {
      messages.push(
        `✅ Perfect day! Completed all ${totalHabits} habit${totalHabits === 1 ? '' : 's'} today. Consistency is building! #habits #perfectday`,
        `💯 ${completedHabits}/${totalHabits} habits done! Perfect score today! #habits #progress`,
        `🎯 All ${totalHabits} habit${totalHabits === 1 ? '' : 's'} checked off! That's how you build momentum! #habits #consistency`,
        `🔥 ${completedHabits}/${totalHabits} - 100% completion! Every habit counts! #habits #perfectday`,
      );
    } else if (completedHabits > 0) {
      messages.push(
        `✅ ${completedHabits}/${totalHabits} habit${completedHabits === 1 ? '' : 's'} done today! Progress, not perfection! #habits #progress`,
        `💪 ${completedHabits}/${totalHabits} habits completed! Building consistency one day at a time! #habits #growth`,
        `🎯 ${completedHabits}/${totalHabits} habits checked off! Every completion counts! #habits #progress`,
        `✨ ${completedHabits}/${totalHabits} habits done! Small steps, big changes! #habits #consistency`,
      );
    }
  }
  
  // Общие шаблоны с информацией о streak
  if (currentStreak > 0) {
    messages.push(
      `🔥 Day ${currentStreak} of my streak! Building habits that stick! #habits #streak`,
      `💪 ${currentStreak} day${currentStreak === 1 ? '' : 's'} strong! Consistency is the key! #habits #streak`,
      `🎯 ${currentStreak} day${currentStreak === 1 ? '' : 's'} in a row! The momentum is real! #habits #streak`,
      `✨ ${currentStreak} day${currentStreak === 1 ? '' : 's'} streak! Progress over perfection! #habits #streak`,
    );
    
    if (bestStreak > currentStreak) {
      messages.push(
        `🚀 Day ${currentStreak} of my streak! My best was ${bestStreak} days - let's beat it! #habits #streak`,
        `🌟 ${currentStreak} day${currentStreak === 1 ? '' : 's'} strong! Aiming to beat my ${bestStreak}-day record! #habits #streak`,
      );
    }
  }
  
  // Общие мотивационные шаблоны
  messages.push(
    `🎯 Building better habits, one day at a time! Consistency is key! #habits #progress`,
    `🔥 Small daily improvements lead to remarkable results! #habits #growth`,
    `💪 Showing up is 80% of success. Keep going! #habits #consistency`,
    `✨ Progress, not perfection. Every day counts! #habits #progress`,
    `🚀 Building the life I want, one habit at a time! #habits #journey`,
    `🌟 Consistency beats intensity. Keep showing up! #habits #progress`,
    `💜 Every day is a new chance to be better! #habits #motivation`,
    `🎯 The best time to start was yesterday. The second best is now! #habits #progress`,
    `🔥 Building habits that stick. One day at a time! #habits #consistency`,
    `💪 Progress over perfection. Every day counts! #habits #growth`,
  );
  
  // Ограничиваем длину до 280 символов (Farcaster limit)
  const selectedMessage = getRandomVariant(messages);
  return selectedMessage.length > 280 ? selectedMessage.slice(0, 277) + '...' : selectedMessage;
}

