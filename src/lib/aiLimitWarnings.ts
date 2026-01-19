/**
 * AI Limit Warning System
 * Shows warnings when user is approaching or has reached AI request limits
 */

import { toast } from 'sonner';

export interface AILimitInfo {
    used: number;
    limit: number;
    remaining: number;
    plan: 'free' | 'pro' | 'premium';
}

/**
 * Check if we should show a warning and show it
 */
export function checkAndShowAILimitWarning(limitInfo: AILimitInfo | null): void {
    if (!limitInfo) return;

    const { used, limit, remaining, plan } = limitInfo;

    // Показываем предупреждение о достижении лимита, если remaining = 0
    if (remaining === 0) {
        toast.warning('Daily AI limit reached!', {
            description: plan === 'free' 
                ? 'You\'ve used all free requests today. Upgrade to Pro for 20 requests per day!' 
                : 'You\'ve reached your daily limit. Please try again tomorrow.',
            duration: 6000,
            action: plan === 'free' ? {
                label: 'Upgrade',
                onClick: () => window.location.href = '/pricing',
            } : undefined,
        });
        return;
    }

    // Показываем предупреждение, если осталось 1-2 запроса
    if (remaining === 1) {
        toast.warning('Last AI request remaining!', {
            description: plan === 'free' 
                ? 'Upgrade to Pro for 20 requests per day!' 
                : 'You have 1 AI request left today.',
            duration: 5000,
            action: plan === 'free' ? {
                label: 'Upgrade',
                onClick: () => window.location.href = '/pricing',
            } : undefined,
        });
    } else if (remaining === 2 && used > 0) {
        // Показываем только если уже были использованы запросы
        toast.info('2 AI requests remaining', {
            description: plan === 'free' 
                ? 'Upgrade to Pro for more requests!' 
                : 'You have 2 AI requests left today.',
            duration: 4000,
        });
    }
}

/**
 * Show limit reached modal content
 */
export function showAILimitReachedModal(limitInfo: AILimitInfo, onClose?: () => void): void {
    const { limit, plan } = limitInfo;
    
    // Создаем кастомное уведомление с кнопкой апгрейда
    toast.error(`Daily AI limit reached (${limit} requests)`, {
        description: plan === 'free'
            ? 'Upgrade to Pro for 20 AI requests per day!'
            : 'You\'ve reached your daily limit. Please try again tomorrow.',
        duration: 8000,
        action: plan === 'free' ? {
            label: 'Upgrade to Pro',
            onClick: () => {
                window.location.href = '/pricing';
                if (onClose) onClose();
            },
        } : undefined,
    });
}

