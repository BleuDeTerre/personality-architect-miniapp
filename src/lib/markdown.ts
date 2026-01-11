/**
 * Конвертирует простой markdown синтаксис в HTML
 * Поддерживает: **жирный текст**, *курсив*, `код`
 */
export function renderMarkdown(text: string): string {
    if (!text) return '';
    
    // Экранируем HTML для безопасности
    let html = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    
    // Конвертируем markdown в HTML
    // **жирный текст** -> <strong>жирный текст</strong>
    // Используем нежадное совпадение и проверяем, что это не часть более длинной последовательности звездочек
    html = html.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
    
    // *курсив* -> <em>курсив</em> (только если не окружен **)
    // Проверяем, что это не часть **
    html = html.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, '<em>$1</em>');
    
    // `код` -> <code>код</code>
    html = html.replace(/`([^`]+?)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-xs">$1</code>');
    
    return html;
}
