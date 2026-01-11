/**
 * Cast text variants
 * Living texts in first person, conversational style
 */

export function getRandomVariant<T>(variants: T[]): T {
  if (variants.length === 0) return variants[0];
  return variants[Math.floor(Math.random() * variants.length)];
}

// Analytics
export const weeklySummaryTexts = (trend: string, thisWeek: number, message: string) => {
  const emoji = trend === 'up' ? '📈' : trend === 'down' ? '📉' : '📊';
  return [
    `${emoji} I did ${thisWeek} habits this week. ${message}.`,
    `${emoji} Got ${thisWeek} habits done this week! ${message}.`,
    `${emoji} Week wrapped up: ${thisWeek} habits completed. ${message}.`,
    `${emoji} Logged ${thisWeek} habits this week. ${message}.`,
  ];
};

export const topHabitTexts = (habitName: string, count: number) => [
  `🔥 My top habit is ${habitName}. Did it ${count} times!`,
  `🔥 ${habitName} is what I do most. Already ${count} times!`,
  `🔥 I did ${habitName} the most — ${count} times total. On track!`,
  `🔥 ${habitName} is leading for me — ${count} times this period. Nice!`,
];

// Streaks
export const habitStreakTexts = (current: number, best: number, nextBadgeDays: number | null) => {
  if (nextBadgeDays !== null) {
    return [
      `💜 My streak is ${current} days, best was ${best}. ${nextBadgeDays} more day${nextBadgeDays === 1 ? '' : 's'} until the next badge!`,
      `💜 Already ${current} days in a row! My record is ${best} days. ${nextBadgeDays} more day${nextBadgeDays === 1 ? '' : 's'} to the next badge.`,
      `💜 ${current} day streak! Best result ${best} days. ${nextBadgeDays} more day${nextBadgeDays === 1 ? '' : 's'} until the new badge.`,
      `💜 I'm holding a ${current} day streak, my max is ${best}. ${nextBadgeDays} more day${nextBadgeDays === 1 ? '' : 's'} to the badge!`,
    ];
  }
  return [
    `💜 My streak is ${current} days, best was ${best}. Badge unlocked! 🎉`,
    `💜 Already ${current} days in a row! My record is ${best} days. Badge earned!`,
    `💜 ${current} day streak, my max is ${best}. Badge unlocked — I'm crushing it!`,
    `💜 I'm holding a ${current} day streak, best result ${best}. Badge is mine! 🏆`,
  ];
};

export const nextBadgeTexts = (days: number) => [
  `🎯 ${days} more day${days === 1 ? '' : 's'} until the next badge! Hold me accountable!`,
  `🎯 Just ${days} more day${days === 1 ? '' : 's'} and I'll get a new badge. Almost there!`,
  `🎯 ${days} day${days === 1 ? '' : 's'} to the next badge. Let's do this!`,
  `🎯 I've got ${days} more day${days === 1 ? '' : 's'} until the new badge. Let's go!`,
];

// Wheel
export const wheelSnapshotTexts = (avg: number, topArea: string, weakArea: string) => [
  `🧭 My life balance is ${avg.toFixed(1)}/10. ${topArea} is going great, ${weakArea} needs work.`,
  `🧭 I'm at ${avg.toFixed(1)}/10 average. ${topArea} is strong, ${weakArea} needs attention.`,
  `🧭 My average score is ${avg.toFixed(1)}/10. ${topArea} is leading, ${weakArea} needs help.`,
  `🧭 Life wheel at ${avg.toFixed(1)}/10. ${topArea} is solid, ${weakArea} needs improvement.`,
];

export const focusAreaTexts = (areaName: string, score: number) => [
  `🎯 Focusing on ${areaName} (${score}/10) this week.`,
  `🎯 Working on ${areaName} right now — I'm at ${score}/10. Time to level up!`,
  `🎯 ${areaName} is at ${score}/10 for me. Making it a priority this week.`,
  `🎯 Putting ${areaName} in focus (${score}/10). Time to boost this area!`,
];

export const wheelShiftTexts = (areaName: string, delta: number) => [
  `🎯 ${areaName} improved by +${delta.toFixed(1)} points for me! Progress feels good!`,
  `🎯 Whoa, ${areaName} jumped +${delta.toFixed(1)}! The work is paying off!`,
  `🎯 ${areaName} went up +${delta.toFixed(1)} points. Moving forward!`,
  `🎯 ${areaName} got better by +${delta.toFixed(1)}. Everything's on track!`,
];

export const wheelSpotlightTexts = (avg: number, topArea: string, weakArea: string) => [
  `🎡 My average is ${avg.toFixed(1)}/10. ${topArea} is leading, ${weakArea} needs fuel.`,
  `🎡 I'm at ${avg.toFixed(1)}/10 average. ${topArea} is my strength, ${weakArea} needs energy.`,
  `🎡 Life wheel: ${avg.toFixed(1)}/10. ${topArea} is strong, ${weakArea} needs attention.`,
  `🎡 Average score ${avg.toFixed(1)}/10. ${topArea} is thriving, ${weakArea} needs help.`,
];

// Habits
export const topStreakHabitTexts = (habitName: string, streak: number) => [
  `🔥 My ${habitName} habit is at ${streak} day${streak === 1 ? '' : 's'} in a row! Tracking with Personality Architect.`,
  `🔥 ${streak} day${streak === 1 ? '' : 's'} straight of ${habitName}! Consistency is key. Personality Architect.`,
  `🔥 ${habitName} is going strong — ${streak} day${streak === 1 ? '' : 's'} in a row! Tracking with Personality Architect.`,
  `🔥 I've got a ${streak} day streak on ${habitName}! Everything's on track. Personality Architect.`,
];

export const habitsSummaryTexts = (total: number, completed: number) => {
  if (completed > 0) {
    return [
      `✅ Tracking ${total} habit${total === 1 ? '' : 's'} in Personality Architect. ${completed} done today!`,
      `✅ I've got ${total} habit${total === 1 ? '' : 's'} in rotation, ${completed} checked off today!`,
      `✅ Tracking ${total} habit${total === 1 ? '' : 's'}, ${completed} done today. Making progress!`,
      `✅ ${total} habit${total === 1 ? '' : 's'} in the system, ${completed} closed today. Moving forward!`,
    ];
  }
  return [
    `✅ Tracking ${total} habit${total === 1 ? '' : 's'} in Personality Architect. Building consistency day by day.`,
    `✅ I've got ${total} habit${total === 1 ? '' : 's'} in tracking. Every day is a chance to get better.`,
    `✅ ${total} habit${total === 1 ? '' : 's'} in the system. Building momentum little by little each day.`,
    `✅ Tracking ${total} habit${total === 1 ? '' : 's'}. Slowly but surely!`,
  ];
};

// Goals
export const goalProgressTexts = (active: number, completed: number) => [
  `🎯 I've got ${active} active goal${active === 1 ? '' : 's'} in progress, ${completed} already done!`,
  `🎯 ${active} goal${active === 1 ? '' : 's'} in the works, ${completed} completed. Moving forward!`,
  `🎯 Working on ${active} goal${active === 1 ? '' : 's'}, ${completed} already in the bag. Momentum building!`,
  `🎯 I've got ${active} active goal${active === 1 ? '' : 's'}, ${completed} win${completed === 1 ? '' : 's'} already. Everything's on track!`,
];

export const goalCompletedTexts = (goalTitle: string) => [
  `✅ Just finished "${goalTitle}"! Tracking with Personality Architect.`,
  `✅ "${goalTitle}" — done! Celebrating this win. Personality Architect.`,
  `✅ Another one in the books: "${goalTitle}" completed! Tracking progress with Personality Architect.`,
  `✅ Whoa, I closed "${goalTitle}"! That was awesome. Personality Architect.`,
];

export const upcomingGoalTexts = (goalTitle: string, dueDate: string) => [
  `🚀 "${goalTitle}" is coming up (${dueDate}). Keeping the momentum!`,
  `🚀 "${goalTitle}" deadline is ${dueDate}. Time to push forward!`,
  `🚀 Next goal: "${goalTitle}" (${dueDate}). Let's make it happen!`,
  `🚀 "${goalTitle}" is approaching (${dueDate}). Time to act!`,
];

// Achievements
export const achievementUnlockedTexts = (title: string, xpReward: number, rarity: string) => {
  const rarityEmoji = rarity === 'legendary' ? '👑' : rarity === 'epic' ? '💎' : rarity === 'rare' ? '⭐' : '✨';
  return [
    `🎉 Just unlocked: ${title}! +${xpReward} XP ${rarityEmoji} #PersonalityArchitect`,
    `🎉 Achievement unlocked: ${title}! Earned ${xpReward} XP. ${rarityEmoji} #PersonalityArchitect`,
    `🏆 ${title} achievement unlocked! +${xpReward} XP ${rarityEmoji} #PersonalityArchitect`,
    `✨ New achievement: ${title}! Got ${xpReward} XP for this. ${rarityEmoji} #PersonalityArchitect`,
  ];
};

// Badges
export const badgeEarnedTexts = (title: string, description: string) => [
  `🏆 Earned badge: ${title}! ${description} #PersonalityArchitect`,
  `🏆 Just got the ${title} badge! ${description} #PersonalityArchitect`,
  `🎖️ ${title} badge is mine! ${description} #PersonalityArchitect`,
  `✨ New badge unlocked: ${title}! ${description} #PersonalityArchitect`,
];

export const eisenhowerMatrixTexts = (
  importantUrgent: number,
  importantNotUrgent: number,
  notImportantUrgent: number,
  notImportantNotUrgent: number
) => {
  const total = importantUrgent + importantNotUrgent + notImportantUrgent + notImportantNotUrgent;
  return [
    `🎯 My Eisenhower Matrix: ${total} goal${total === 1 ? '' : 's'} organized by priority. ${importantUrgent} urgent & important, ${importantNotUrgent} important to schedule.`,
    `🎯 Organizing ${total} goal${total === 1 ? '' : 's'} with the Eisenhower Matrix. ${importantUrgent} need immediate attention, ${importantNotUrgent} are important for later.`,
    `🎯 Prioritizing ${total} goal${total === 1 ? '' : 's'} using the Eisenhower Matrix. ${importantUrgent} are urgent & important, ${importantNotUrgent} I'll schedule.`,
    `🎯 ${total} goal${total === 1 ? '' : 's'} sorted by the Eisenhower Matrix. ${importantUrgent} do first, ${importantNotUrgent} schedule for later.`,
  ];
};

// Analytics - Weekly Capsule
export const weeklyCapsuleTexts = (startStr: string, endStr: string, completedDays: number, totalDays: number, longestRun: number) => [
  `📦 Week ${startStr}–${endStr}: ${completedDays}/${totalDays} days done, longest run ${longestRun}d.`,
  `📦 ${startStr}–${endStr} wrapped up: ${completedDays}/${totalDays} days completed. Best streak ${longestRun} days!`,
  `📦 Week ${startStr}–${endStr} summary: ${completedDays}/${totalDays} days done. Longest run was ${longestRun} days.`,
  `📦 ${startStr}–${endStr} in the books: ${completedDays}/${totalDays} days done, ${longestRun} day streak was my best!`,
];

// Profile - Level Up
export const levelUpTexts = (levelName: string, level: number, xp: number) => [
  `⚡️ Reached ${levelName} (Level ${level}) with ${xp.toLocaleString()} XP in Personality Architect!`,
  `⚡️ Just hit ${levelName} — Level ${level} with ${xp.toLocaleString()} XP! Tracking in Personality Architect.`,
  `⚡️ Level ${level} ${levelName} unlocked! I've got ${xp.toLocaleString()} XP now.`,
  `⚡️ Made it to ${levelName} (Level ${level})! ${xp.toLocaleString()} XP and counting.`,
];

