/**
 * Templates for Streak Recovery (replacing AI)
 */

export function getRandomVariant<T>(variants: T[]): T {
  if (variants.length === 0) return variants[0];
  return variants[Math.floor(Math.random() * variants.length)];
}

export function generateStreakRecoveryMessage(
  bestStreak: number,
  currentStreak: number,
  leastActiveDay: string | null
): string {
  const messages: string[] = [];
  
  // Сообщения для высокого streak (>= 7 дней)
  if (bestStreak >= 7) {
    messages.push(
      `Don't let one missed day define your progress! Your ${bestStreak}-day streak shows incredible consistency. Every day is a new chance to start again! 💪`,
      `Your ${bestStreak}-day streak was amazing! One day doesn't erase all that progress. Let's start a new streak today! 🔥`,
      `You had an incredible ${bestStreak}-day streak! That's proof you can do this. Today is a fresh start - let's build it back up! ✨`,
      `A ${bestStreak}-day streak is impressive! One missed day is just a small bump. Get back on track today and show yourself what you're capable of! 🚀`,
      `Your ${bestStreak}-day streak shows you have what it takes! Don't let one day stop you. Start fresh today and keep the momentum going! 💜`,
      `That ${bestStreak}-day streak wasn't a fluke - it was you! One day off doesn't change who you are. Get back to it today! 🌟`,
      `Your ${bestStreak}-day streak proves consistency is in you. One missed day is just a pause button, not stop. Press play today! 🎯`,
      `You've done ${bestStreak} days before - you can absolutely do it again! Today is day 1 of your next amazing streak! 💪`,
      `A ${bestStreak}-day streak is no accident. You built that with dedication. One day won't break that - start again today! 🔥`,
      `Your ${bestStreak}-day streak shows your potential. Don't let one day make you forget that. Today is a new beginning! ✨`,
    );
  }
  
  // Сообщения для среднего streak (3-6 дней)
  else if (bestStreak >= 3) {
    messages.push(
      `Your ${bestStreak}-day streak was a great start! One missed day doesn't mean failure. Every day is a new opportunity to build consistency! 💪`,
      `You had a solid ${bestStreak}-day streak going! Don't let one day derail your progress. Start fresh today and keep building! 🔥`,
      `A ${bestStreak}-day streak shows you're on the right track! One day off is normal. Get back to it today and continue your journey! ✨`,
      `Your ${bestStreak}-day streak proves you can do this! One missed day is just a pause. Resume today and keep moving forward! 🚀`,
      `You were building momentum with that ${bestStreak}-day streak! One day doesn't break your progress. Start again today! 💜`,
      `Your ${bestStreak}-day streak shows you're capable! One day off is just a rest day. Get back on track today! 🌟`,
      `You've proven you can do ${bestStreak} days in a row. One missed day is just a comma in your story. Continue today! 🎯`,
      `That ${bestStreak}-day streak was real progress! Don't let one day undo it. Start fresh and build even longer this time! 💪`,
      `Your ${bestStreak}-day streak is proof you're building the habit. One day won't stop you. Resume today! 🔥`,
      `You've done ${bestStreak} days before - you can do it again! Today is your chance to start a new streak! ✨`,
    );
  }
  
  // Сообщения для короткого streak (1-2 дня)
  else {
    messages.push(
      `Streaks are about progress, not perfection! Every day is a new chance to start again. You've got this! 💪`,
      `Don't worry about one missed day! Consistency is built one day at a time. Start fresh today and keep going! 🔥`,
      `One day doesn't define your journey! Every day is a new opportunity. Get back on track today! ✨`,
      `Streaks come and go, but your commitment matters most! Today is a fresh start - let's make it count! 🚀`,
      `Progress isn't always linear! One missed day is just a small pause. Resume today and keep building! 💜`,
      `Every expert was once a beginner. Your streak might have paused, but your journey continues! Start again today! 🌟`,
      `One day off doesn't mean you've failed. It means you're human. Get back on track today! 🎯`,
      `The best time to start was yesterday. The second best time is now. Let's get back on track today! 💪`,
      `Your future self will thank you for starting again today. Don't let one day stop you from reaching your goals! 🔥`,
      `Consistency isn't about never missing - it's about always coming back. Today is your comeback day! ✨`,
      `One missed day is just a comma, not a period. Your story continues today - make it count! 🚀`,
      `You're building a habit, not a perfect record. One day won't stop you. Start again today! 💜`,
    );
  }
  
  // Добавляем сообщения с учетом наименее активного дня
  if (leastActiveDay) {
    messages.push(
      `You've struggled with consistency on ${leastActiveDay}s before. Today is a chance to break that pattern! Start fresh and build a new streak! 💪`,
      `Historically, ${leastActiveDay}s have been challenging for you. But today can be different! Get back on track and prove to yourself you can do it! 🔥`,
      `Your pattern shows ${leastActiveDay}s are tough. But patterns can be broken! Start today and show yourself what you're capable of! ✨`,
      `You've had trouble on ${leastActiveDay}s before, but that was then. Today is now - make it different! 🚀`,
      `Break the ${leastActiveDay} pattern! Today is your chance to start fresh and build consistency. You've got this! 💜`,
    );
  }
  
  // Общие мотивационные сообщения
  messages.push(
    `Remember: every expert was once a beginner. Your streak might have paused, but your journey continues! Start again today! ✨`,
    `Consistency isn't about never missing a day - it's about always coming back. Today is your comeback day! 🚀`,
    `One missed day is just a comma, not a period. Your story continues today - make it count! 💜`,
    `The best time to start was yesterday. The second best time is now. Let's get back on track today! 💪`,
    `Your future self will thank you for starting again today. Don't let one day stop you from reaching your goals! 🔥`,
    `Progress isn't a straight line - it's full of ups and downs. Today is your chance to go up again! 🌟`,
    `One day doesn't define your entire journey. What matters is that you keep going. Start again today! 🎯`,
    `You're not starting from zero - you're starting from experience. Use what you've learned and try again! 💪`,
    `Every comeback starts with one step. That step is today. Let's do this! 🔥`,
    `Your commitment matters more than one missed day. Show yourself you're serious - start again today! ✨`,
  );
  
  return getRandomVariant(messages);
}

