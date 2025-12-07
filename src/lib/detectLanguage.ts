/**
 * Language detection utility
 * Detects language from text (Russian vs English)
 */

export type DetectedLanguage = 'ru' | 'en';

/**
 * Detect language from text by checking for Cyrillic characters
 * @param text - Text to analyze
 * @returns 'ru' if Cyrillic found, 'en' otherwise
 */
export function detectLanguage(text: string): DetectedLanguage {
    if (!text || typeof text !== 'string') return 'en';
    
    // Check for Cyrillic characters (Russian)
    const hasCyrillic = /[а-яёА-ЯЁ]/.test(text);
    
    return hasCyrillic ? 'ru' : 'en';
}

/**
 * Get language instruction for AI prompt
 * @param lang - Detected language
 * @returns Instruction string for the AI model
 */
export function getLanguageInstruction(lang: DetectedLanguage): string {
    return lang === 'ru'
        ? 'CRITICAL: Respond ONLY in Russian. Use Russian language for all text. Do not use English.'
        : 'CRITICAL: Respond ONLY in English. Use English language for all text.';
}

/**
 * Detect language from multiple text sources (user message, system prompt, etc.)
 * Checks in order and returns first detected language, defaults to English
 * @param sources - Array of text sources to check
 * @returns Detected language
 */
export function detectLanguageFromSources(sources: (string | null | undefined)[]): DetectedLanguage {
    for (const source of sources) {
        if (!source) continue;
        const lang = detectLanguage(source);
        if (lang === 'ru') return 'ru'; // Russian takes priority
    }
    return 'en'; // Default to English
}

