'use client';
import { useState, useEffect, useRef } from 'react';
import { sdk } from '@farcaster/miniapp-sdk';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

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

    useEffect(() => {
        sdk.actions.ready();
        (async () => {
            const context = await (sdk as any).context?.getFrameContext?.();
            setCtx(context);
            const fid = context?.user?.fid as number | undefined;
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
        <div className="min-h-screen bg-[#0D0F1A] text-[#E9ECF1] p-4 sm:p-6 max-w-4xl mx-auto flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#8B5CF6] to-[#A78BFA] bg-clip-text text-transparent">
                    AI Coach Chat
                </h1>
                <Link
                    href="/"
                    className="text-sm text-[#AAB1C2] hover:text-[#E9ECF1] transition"
                >
                    ← Back
                </Link>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 space-y-4 border border-[#2A2B3E] bg-[#121420] rounded-lg p-4">
                {messages.length === 0 ? (
                    <div className="text-center py-12 text-[#AAB1C2]">
                        <div className="text-lg mb-2">👋 Hi! I&apos;m your AI coach</div>
                        <div className="text-sm">Ask me about your habits, goals, or progress</div>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div
                            key={idx}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-lg p-3 ${msg.role === 'user'
                                    ? 'bg-[#8B5CF6] text-white'
                                    : 'bg-[#1A1B2E] border border-[#2A2B3E]'
                                    }`}
                            >
                                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                                <div className="text-xs opacity-70 mt-1">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-[#1A1B2E] border border-[#2A2B3E] rounded-lg p-3">
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

            <div className="flex gap-2">
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
                    className="flex-1 bg-[#121420] border border-[#2A2B3E] text-[#E9ECF1] p-3 rounded-lg focus:outline-none focus:border-[#8B5CF6] transition"
                    disabled={loading}
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="bg-[#8B5CF6] hover:bg-[#6D28D9] text-white px-6 py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    Send
                </button>
            </div>
        </div>
    );
}

