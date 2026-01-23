'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMiniApp } from '@neynar/react';
import { createClient } from '@supabase/supabase-js';
import MiniAppPage from '@/components/MiniAppPage';
import { fetchJson } from '@/lib/http';
import { checkAndShowAILimitWarning, showAILimitReachedModal, type AILimitInfo } from '@/lib/aiLimitWarnings';
import AILimitReachedModal from '@/components/AILimitReachedModal';
import { renderMarkdown } from '@/lib/markdown';
import { toast } from 'sonner';
import X402PaymentRequiredModal from '@/components/X402PaymentRequiredModal';
import { IconDisplay } from '@/lib/iconMapper';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Message = {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
};

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [_ctx, setCtx] = useState<any>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [userPlan, setUserPlan] = useState<string>('free');
    const [showLimitModal, setShowLimitModal] = useState(false);
    const lastWarningRef = useRef<{ remaining: number; timestamp: number } | null>(null);
    const [payModal, setPayModal] = useState<{ open: boolean; message?: string; sku?: string; priceUsd?: number; requestBody?: Record<string, unknown> }>({ open: false });

    // Handler для успешной оплаты в чате
    const handlePaymentSuccess = useCallback((result: unknown) => {
        const data = result as { message?: string; reply?: string };
        if (data && (data.message || data.reply)) {
            const assistantMsg: Message = {
                role: 'assistant',
                content: data.message || data.reply || '',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMsg]);
        }
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Загружаем историю сообщений из базы данных при монтировании
    useEffect(() => {
        (async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.access_token) return;

                const { data: messagesData, error } = await supabase
                    .from('chat_messages')
                    .select('role, content, created_at')
                    .order('created_at', { ascending: true })
                    .limit(50); // Загружаем последние 50 сообщений

                if (error) {
                    console.warn('[Chat] Failed to load message history:', error);
                    return;
                }

                if (messagesData && messagesData.length > 0) {
                    const loadedMessages: Message[] = messagesData.map(msg => ({
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content,
                        timestamp: new Date(msg.created_at),
                    }));
                    setMessages(loadedMessages);
                }
            } catch (e) {
                console.warn('[Chat] Error loading message history:', e);
            }
        })();
    }, []);

    const { isSDKLoaded, context: neynarContext } = useMiniApp();

    useEffect(() => {
        (async () => {
            if (!isSDKLoaded || !neynarContext) return;
            setCtx(neynarContext);
            const fid = neynarContext?.user?.fid ? Number(neynarContext.user.fid) : null;
            if (!fid) return;

            const { data } = await supabase.auth.getUser();
            if (!data.user) {
                const res = await fetch('/api/auth/farcaster-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fid }),
                });
                const { access_token } = await res.json();
                if (access_token) {
                    await supabase.auth.setSession({ access_token, refresh_token: '' });
                }
            }

            // Загружаем план пользователя
            if (data.user) {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const hdrs = {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session?.access_token ?? ''}`,
                    };

                    // Загружаем план
                    const planRes = await fetch('/api/plan', { headers: hdrs });
                    if (planRes.ok) {
                        const planData = await planRes.json();
                        const plan = planData.plan || 'free';
                        setUserPlan(plan);
                    }
                } catch (e) {
                    console.warn('Failed to load plan:', e);
                }
            }
        })();
    }, []);

    async function authHeaders() {
        const { data: { session } } = await supabase.auth.getSession();
        const tzOffset = typeof window !== 'undefined' ? new Date().getTimezoneOffset() : 0;
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
            'X-Timezone-Offset': String(tzOffset),
        };
    }

    async function handleQuickAction(type: 'weekly' | 'monthly') {
        if (loading) return;

        const endpoint = type === 'weekly' ? '/api/paid/insight/weekly' : '/api/paid/insight/monthly';
        const actionName = type === 'weekly' ? 'Weekly AI Summary' : 'Monthly AI Summary';

        const userMsg: Message = {
            role: 'user',
            content: `Get ${actionName}`,
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        try {
            const hdrs = await authHeaders();
            const data = await fetchJson<{
                summary: string;
                totals?: { completed: number; habits_total: number; rate_pct: number };
                week_start?: string;
                month_start?: string;
            }>(endpoint, {
                method: 'GET',
                headers: hdrs,
                timeoutMs: 60000,
            });

            if (!data.summary) {
                throw new Error('No summary received from server');
            }

            const assistantMsg: Message = {
                role: 'assistant',
                content: data.summary,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (e: any) {
            console.error(`Failed to get ${actionName}:`, e);
            let errorMessage = `Sorry, I couldn't get ${actionName}. Please try again.`;

            // Обработка 402 ошибки (payment required)
            if (e?.code === 402 || e?.message === 'payment_required') {
                const errorData = e?.detail || {};
                setPayModal({
                    open: true,
                    message: errorData.message || `Payment required for ${actionName}.`,
                    sku: errorData.sku || endpoint,
                    priceUsd: typeof errorData.priceUsd === 'number' ? errorData.priceUsd : 0.25,
                });
                errorMessage = errorData.message || `Payment required. Please pay $0.25 for ${actionName}.`;
            } else if (e?.message) {
                errorMessage = `Error: ${e.message}`;
            }

            const errorMsg: Message = {
                role: 'assistant',
                content: errorMessage,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    }

    async function sendMessage() {
        if (!input.trim() || loading) return;

        const userMsg: Message = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            const hdrs = await authHeaders();
            const data = await fetchJson<{
                response: string;
                plan?: string;
                aiLimit?: { used: number; limit: number; remaining: number };
                error?: string;
                message?: string;
                limit?: number;
                used?: number;
            }>('/api/chat/message', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({
                    message: userMsg.content,
                    history: messages.map(m => ({ role: m.role, content: m.content }))
                }),
                timeoutMs: 60000, // 60 секунд таймаут для AI запросов
            });

                // Обработка ошибок (fetchJson уже обработал HTTP статусы)
            if (data.error) {
                // Обработка 402 ошибки (payment required)
                if (data.error === 'payment_required' || data.error === 'payment_required') {
                    const errorData = (data as any).detail || {};
                    setPayModal({
                        open: true,
                        message: errorData.message || 'Daily AI limit reached.',
                        sku: errorData.sku || '/api/paid/chat/message',
                        priceUsd: typeof errorData.priceUsd === 'number' ? errorData.priceUsd : 0.25,
                        requestBody: { 
                            message: userMsg.content,
                            history: messages.map(m => ({ role: m.role, content: m.content }))
                        },
                    });
                    const errorMsg: Message = {
                        role: 'assistant',
                        content: errorData.message || 'Payment required. Please buy AI Credits or pay for this request.',
                        timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, errorMsg]);
                    setLoading(false);
                    return;
                }
                
                // Обработка лимита запросов (429)
                if (data.error === 'daily_limit_reached') {
                    const limitInfo: AILimitInfo = {
                        used: data.used || 0,
                        limit: data.limit || (userPlan === 'free' ? 5 : 20),
                        remaining: 0,
                        plan: userPlan as 'free' | 'pro' | 'premium',
                    };
                    showAILimitReachedModal(limitInfo);
                    setShowLimitModal(true);

                    const errorMsg: Message = {
                        role: 'assistant',
                        content: `${data.message || 'You have reached your daily AI request limit'}\n\n${userPlan === 'free' ? 'Upgrade to Pro for 20 AI requests per day!' : 'Please try again tomorrow.'}`,
                        timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, errorMsg]);
                    setLoading(false);
                    return;
                }

                // Обработка глобального лимита DeepSeek
                if (data.error === 'deepseek_limit_reached') {
                    toast.error('AI service temporarily unavailable', {
                        description: data.message || 'The AI service has reached its daily capacity. Please try again tomorrow.',
                        duration: 8000,
                    });

                    const errorMsg: Message = {
                        role: 'assistant',
                        content: data.message || 'The AI service is temporarily unavailable due to high demand. Please try again tomorrow.',
                        timestamp: new Date(),
                    };
                    setMessages(prev => [...prev, errorMsg]);
                    setLoading(false);
                    return;
                }

                throw new Error(data.error);
            }

            const { response, plan, aiLimit } = data;

            // Сохраняем информацию о плане
            if (plan) setUserPlan(plan);

            // Показываем предупреждения о лимите (только если значение изменилось)
            if (aiLimit) {
                const limitInfo: AILimitInfo = {
                    used: aiLimit.used,
                    limit: aiLimit.limit,
                    remaining: aiLimit.remaining,
                    plan: userPlan as 'free' | 'pro' | 'premium',
                };
                
                // Показываем предупреждение только если remaining изменилось или прошло больше 5 секунд
                const now = Date.now();
                const shouldShow = !lastWarningRef.current || 
                    lastWarningRef.current.remaining !== limitInfo.remaining ||
                    (now - lastWarningRef.current.timestamp) > 5000;
                
                if (shouldShow) {
                    checkAndShowAILimitWarning(limitInfo);
                    lastWarningRef.current = {
                        remaining: limitInfo.remaining,
                        timestamp: now,
                    };
                }
            }

            const assistantMsg: Message = {
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (e: any) {
            console.error('Failed to send message:', e);
            let errorMessage = 'Sorry, I encountered an error. Please try again.';

            // Обработка таймаута
            if (e?.name === 'AbortError' || e?.code === 'TIMEOUT') {
                errorMessage = 'Request timed out. The AI is taking too long to respond. Please try again.';
            } else if (e?.code === 402 || e?.message === 'payment_required') {
                const errorData = e?.detail || {};
                // Получаем последнее сообщение пользователя для повторной отправки
                const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                setPayModal({
                    open: true,
                    message: errorData.message || 'Daily AI limit reached.',
                    sku: errorData.sku || '/api/paid/chat/message',
                    priceUsd: typeof errorData.priceUsd === 'number' ? errorData.priceUsd : 0.25,
                    requestBody: lastUserMsg ? {
                        message: lastUserMsg.content,
                        history: messages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
                    } : undefined,
                });
                errorMessage = errorData.message || 'Payment required. Please buy AI Credits or pay for this request.';
            } else if (e?.code === 429) {
                errorMessage = 'You have reached your daily limit. Upgrade to Pro for unlimited access!';
            } else if (e?.message) {
                errorMessage = `Error: ${e.message}`;
            }

            const errorMsg: Message = {
                role: 'assistant',
                content: errorMessage,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <MiniAppPage>
            <div className="flex flex-col h-full space-y-1.5">
                {/* Header Card */}
                <section className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2">
                    <div className="flex items-start justify-between mb-0.5">
                        <div className="flex-1">
                            <h1 className="text-xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-0.5">AI Coach Chat</h1>
                            <p className="text-xs text-white/80">Ask about your habits, goals, or progress. Your coach is here 24/7.</p>
                        </div>
                        {messages.length > 0 && (
                            <button
                                onClick={() => {
                                    setMessages([]);
                                    setInput('');
                                }}
                                className="ml-2 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-medium transition-all active:scale-[0.98]"
                                title="Clear chat and return to menu"
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </section>

                {/* Chat Area */}
                <div className="flex-1 min-h-[260px] overflow-y-auto rounded-2xl border border-white/10 bg-[#1a1b2e] p-1.5 sm:p-2 space-y-1.5">
                    {messages.length === 0 ? (
                        <>
                            {/* Welcome Message from AI */}
                            <div className="flex justify-center">
                                <div className="max-w-[85%] rounded-2xl bg-[#1a1b2e] border border-purple-500/30 p-4 space-y-3 text-center">
                                    <div className="flex items-center justify-center gap-2 mb-2">
                                        <IconDisplay emoji="👋" size="text-lg" className="text-purple-400" />
                                        <span className="text-base font-semibold text-white">Hi! I&apos;m your AI Coach</span>
                                    </div>
                                    
                                    <div className="text-sm text-white/90 space-y-2.5 leading-relaxed text-center">
                                        <p>
                                            I can help you with <strong className="text-purple-300">habits, goals, progress analysis</strong>, and personalized advice based on your data.
                                        </p>
                                        
                                        <div className="bg-white/5 rounded-xl p-3 border border-white/10 text-left">
                                            <p className="text-xs font-semibold text-white/80 mb-2 text-center">💡 What you can ask:</p>
                                            <ul className="text-xs text-white/70 space-y-1.5 list-disc list-inside">
                                                <li>How can I improve my habit consistency?</li>
                                                <li>What&apos;s my progress on [goal name]?</li>
                                                <li>Analyze my weekly performance</li>
                                                <li>Give me tips for better productivity</li>
                                            </ul>
                                        </div>
                                        
                                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 text-left">
                                            <p className="text-xs font-semibold text-yellow-300 mb-1 text-center">⚡ Daily Limit</p>
                                            <p className="text-xs text-white/80">
                                                You get <strong className="text-yellow-300">1 free AI request per day</strong>. After that, use AI Credits (buy packs) or pay <strong className="text-yellow-300">$0.25 per request</strong> via x402.
                                            </p>
                                        </div>
                                        
                                        <p className="text-xs text-white/60 italic">
                                            💬 <strong>Tip:</strong> Be specific! Instead of &quot;hi&quot;, ask &quot;How can I improve my morning routine?&quot; to get actionable insights.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Quick Action Buttons */}
                            <div className="flex flex-col gap-2.5 w-full max-w-[280px] mx-auto">
                                <button
                                    onClick={() => handleQuickAction('weekly')}
                                    disabled={loading}
                                    className="w-full rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 hover:bg-purple-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <IconDisplay emoji="📊" size="text-2xl" className="text-purple-400" />
                                            <div className="text-left">
                                                <div className="text-sm font-semibold text-white group-hover:text-purple-300 transition">Weekly AI Summary</div>
                                                <div className="text-xs text-white/60">Get insights for this week</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-semibold text-purple-400">$0.25</div>
                                    </div>
                                </button>
                                
                                <button
                                    onClick={() => handleQuickAction('monthly')}
                                    disabled={loading}
                                    className="w-full rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 hover:bg-blue-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <IconDisplay emoji="📅" size="text-2xl" className="text-blue-400" />
                                            <div className="text-left">
                                                <div className="text-sm font-semibold text-white group-hover:text-blue-300 transition">Monthly AI Summary</div>
                                                <div className="text-xs text-white/60">Review your month trends</div>
                                            </div>
                                        </div>
                                        <div className="text-xs font-semibold text-blue-400">$0.25</div>
                                    </div>
                                </button>
                            </div>
                        </>
                    ) : (
                        messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user'
                                        ? 'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white'
                                        : 'bg-[#1a1b2e] border border-white/10'
                                        }`}
                                >
                                    <div 
                                        className="text-sm whitespace-pre-wrap text-white"
                                        dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                                    />
                                    {msg.timestamp && (
                                        <div className="text-xs opacity-70 mt-2 text-white/60">
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                    {loading && (
                        <div className="flex justify-start">
                            <div className="rounded-2xl border border-white/10 bg-[#1a1b2e] p-4">
                                <div className="flex gap-1">
                                    <span className="w-2 h-2 bg-[#8B5CF6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-[#8B5CF6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-[#8B5CF6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="flex gap-2.5">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        placeholder="Ask about habits, goals, or progress (e.g., 'How can I improve my morning routine?')"
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1a1b2e] text-white px-4 py-3 placeholder:text-white/40 focus:border-[#8B5CF6] focus:outline-none disabled:opacity-50"
                        disabled={loading}
                    />
                    <button
                        onClick={sendMessage}
                        disabled={loading || !input.trim()}
                        className="rounded-2xl bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white px-6 py-3 font-semibold transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#8B5CF6]/40"
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* Limit Reached Modal */}
            {showLimitModal && (
                <AILimitReachedModal
                    limit={userPlan === 'free' ? 5 : 20}
                    plan={userPlan as 'free' | 'pro' | 'premium'}
                    onClose={() => setShowLimitModal(false)}
                />
            )}
            
            {/* Payment Required Modal */}
            <X402PaymentRequiredModal
                open={payModal.open}
                onClose={() => setPayModal({ open: false })}
                message={payModal.message}
                sku={payModal.sku}
                priceUsd={payModal.priceUsd}
                requestBody={payModal.requestBody}
                onSuccess={async (result: unknown) => {
                    // Для quick actions - нужно сделать GET запрос после оплаты
                    if (payModal.sku?.includes('insight/weekly')) {
                        // Закрываем модалку
                        setPayModal({ open: false });
                        // Повторяем запрос (теперь с оплатой)
                        handleQuickAction('weekly');
                    } else if (payModal.sku?.includes('insight/monthly')) {
                        // Закрываем модалку
                        setPayModal({ open: false });
                        // Повторяем запрос (теперь с оплатой)
                        handleQuickAction('monthly');
                    } else {
                        // Для обычного Chat - используем стандартный handler
                        handlePaymentSuccess(result);
                    }
                }}
            />
        </MiniAppPage>
    );
}

