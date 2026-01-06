/**
 * Маппинг эмодзи на Material Symbols Icons
 * Используется для системных элементов и статусов
 */
export const EMOJI_TO_MATERIAL_ICON: Record<string, string> = {
  // Статусы и действия
  '✅': 'check_circle',
  '🔥': 'local_fire_department',
  '⭐': 'star',
  '🎯': 'track_changes',
  '💡': 'lightbulb',
  '📊': 'bar_chart',
  '🏆': 'emoji_events',
  '⚡': 'bolt',
  '💎': 'diamond',
  '👑': 'workspace_premium',
  '🏅': 'military_tech',
  
  // Направления и тренды
  '📈': 'trending_up',
  '📉': 'trending_down',
  
  // Общие иконки
  '📱': 'smartphone',
  '💻': 'computer',
  '📚': 'menu_book',
  '📝': 'edit_note',
  '🎧': 'headphones',
  '⏱️': 'timer',
  '💳': 'credit_card',
  '🏦': 'account_balance',
  '💬': 'chat_bubble',
  '📞': 'phone',
  '🤝': 'handshake',
  '☀️': 'wb_sunny',
  '🌙': 'dark_mode',
  '💸': 'savings',
  '🧾': 'receipt',
  '📫': 'mail',
  '✉️': 'email',
  '🎨': 'palette',
  '🎬': 'movie',
  '📵': 'phone_disabled',
  '🚫': 'block',
  '🛑': 'stop_circle',
  // Навигация
  '🏠': 'home',
  '🎡': 'attractions',
  '🤖': 'smart_toy',
  '👤': 'person',
};

/**
 * Конвертирует эмодзи в Material Symbol icon name
 */
export function emojiToMaterialIcon(emoji: string): string | null {
  return EMOJI_TO_MATERIAL_ICON[emoji] || null;
}

/**
 * Компонент для отображения иконки (эмодзи или Material Symbol)
 * Используется для системных элементов
 */
export function IconDisplay({ 
  emoji, 
  className = '',
  size = 'text-lg',
  color = ''
}: { 
  emoji: string; 
  className?: string;
  size?: string;
  color?: string;
}) {
  const materialIcon = emojiToMaterialIcon(emoji);
  
  if (materialIcon) {
    return (
      <span className={`material-symbols-rounded ${size} ${color} ${className}`}>
        {materialIcon}
      </span>
    );
  }
  
  // Если нет маппинга, возвращаем эмодзи
  return <span className={className}>{emoji}</span>;
}

