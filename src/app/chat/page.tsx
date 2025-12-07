'use client';
import { useState, useEffect, useRef } from 'react';
import { useMiniApp } from '@neynar/react';
import { createClient } from '@supabase/supabase-js';
import MiniAppPage from '@/components/MiniAppPage';
import { fetchJson } from '@/lib/http';
import { checkAndShowAILimitWarning, showAILimitReachedModal, type AILimitInfo } from '@/lib/aiLimitWarnings';
import AILimitReachedModal from '@/components/AILimitReachedModal';
import { toast } from 'sonner';

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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
            
            // Показываем предупреждения о лимите
            if (aiLimit) {
                const limitInfo: AILimitInfo = {
                    used: aiLimit.used,
                    limit: aiLimit.limit,
                    remaining: aiLimit.remaining,
                    plan: userPlan as 'free' | 'pro' | 'premium',
                };
                checkAndShowAILimitWarning(limitInfo);
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
            } else if (e?.code === 402) {
                errorMessage = 'Payment required. Please upgrade to Pro for AI Chat access.';
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
            <div className="flex flex-col h-full space-y-4">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-5">
                    <div className="flex items-start justify-between mb-1.5">
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-1.5">AI Coach Chat</h1>
                            <p className="text-sm text-white/80">Ask about your habits, goals, or progress. Your coach is here 24/7.</p>
                        </div>
                    </div>
                </section>

                {/* Chat Area */}
                <div className="flex-1 min-h-[260px] overflow-y-auto rounded-3xl border border-white/10 bg-[#1a1b2e] p-4 sm:p-5 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex items-start justify-center h-full pt-4">
                            <div className="text-center space-y-1.5">
                                <div className="text-lg text-white/90 leading-tight">👋 Hi! I&apos;m your AI coach</div>
                                <div className="text-xs text-white/70 leading-tight max-w-[220px] mx-auto">
                                    Ask me about your habits, goals, or progress
                                </div>
                            </div>
                        </div>
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
                                    <div className="text-sm whitespace-pre-wrap text-white">{msg.content}</div>
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
                        placeholder="Ask me anything about your habits..."
                        className="flex-1 rounded-2xl border border-white/10 bg-[#1a1b2e] text-white px-4 py-3 placeholder:text-white/40 focus:border-white/40 focus:outline-none disabled:opacity-50"
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
        </MiniAppPage>
    );
}

