'use client';
import { useState, useEffect, useRef } from 'react';
import { useMiniApp } from '@neynar/react';
import { createClient } from '@supabase/supabase-js';
import MiniAppPage from '@/components/MiniAppPage';

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
        })();
    }, []);

    async function authHeaders() {
        const { data: { session } } = await supabase.auth.getSession();
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token ?? ''}`,
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
            const res = await fetch('/api/chat/message', {
                method: 'POST',
                headers: hdrs,
                body: JSON.stringify({ message: userMsg.content }),
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const { response } = await res.json();
            const assistantMsg: Message = {
                role: 'assistant',
                content: response,
                timestamp: new Date(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (e) {
            console.error('Failed to send message:', e);
            const errorMsg: Message = {
                role: 'assistant',
                content: 'Sorry, I encountered an error. Please try again.',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setLoading(false);
        }
    }

    return (
        <MiniAppPage>
            <div className="flex flex-col h-full space-y-6">
                {/* Header Card */}
                <section className="rounded-3xl border border-white/10 bg-[#1a1b2e] p-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[#8a5df5] to-[#a183f9] bg-clip-text text-transparent mb-2">AI Coach Chat</h1>
                    <p className="text-sm text-white/80">Ask about your habits, goals, or progress. Your coach is here 24/7.</p>
                </section>

                {/* Chat Area */}
                <div className="flex-1 min-h-[400px] overflow-y-auto rounded-3xl border border-white/10 bg-[#1a1b2e] p-5 sm:p-6 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="text-base text-white/90 mb-1">👋 Hi! I&apos;m your AI coach</div>
                                <div className="text-sm text-white/90">Ask me about your habits, goals, or progress</div>
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
                <div className="flex gap-3">
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
        </MiniAppPage>
    );
}

