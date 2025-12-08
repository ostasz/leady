'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Sparkles, Trash2, Bot, User } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function AdminAIAssistantPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const router = useRouter();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (authLoading) return;
        if (!user || userData?.role !== 'admin') {
            router.push('/');
        }
    }, [user, userData, authLoading, router]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || loading) return;

        const newUserMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, newUserMessage]);
        setInput('');
        setLoading(true);

        try {
            const apiMessages = [...messages, newUserMessage].map(m => ({
                role: m.role,
                content: m.content
            }));

            const res = await fetch('/api/admin/ai-assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await user?.getIdToken()}`
                },
                body: JSON.stringify({ messages: apiMessages })
            });

            if (!res.ok) throw new Error('Failed to fetch response');

            const data = await res.json();
            const newAiMessage: Message = { role: 'assistant', content: data.response };

            setMessages(prev => [...prev, newAiMessage]);
        } catch (error) {
            console.error(error);
            // Optionally add error message to chat
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    if (authLoading || !user) return <div className="min-h-screen flex items-center justify-center">Ładowanie...</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.push('/admin')}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Sparkles className="text-purple-600" size={20} />
                            Asystent AI
                        </h1>
                        <p className="text-xs text-gray-500">Ekspert Rynku Energii Ekovoltis (Admin Access)</p>
                    </div>
                </div>
                <button
                    onClick={() => setMessages([])}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    title="Wyczyść czat"
                >
                    <Trash2 size={20} />
                </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
                        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                            <Sparkles className="text-purple-600" size={32} />
                        </div>
                        <h3 className="text-lg font-medium text-gray-700 mb-2">Jak mogę Ci pomóc?</h3>
                        <p className="max-w-md text-sm">
                            Zapytaj mnie o wzór maila do klienta, analizę sytuacji rynkowej, lub argumenty negocjacyjne.
                        </p>
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm max-w-lg w-full">
                            <button onClick={() => { setInput("Napisz maila do piekarni z ofertą stałej ceny"); }} className="p-3 bg-white border rounded-lg hover:border-purple-400 hover:text-purple-700 transition-all text-left">
                                "Napisz maila do piekarni..."
                            </button>
                            <button onClick={() => { setInput("Jak wytłumaczyć klientowi wzrosty na RDN?"); }} className="p-3 bg-white border rounded-lg hover:border-purple-400 hover:text-purple-700 transition-all text-left">
                                "Wytłumacz wzrosty RDN..."
                            </button>
                        </div>
                    </div>
                )}

                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-[80%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${msg.role === 'user' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'
                                }`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            <div className={`p-4 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white rounded-tr-none'
                                    : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}

                {loading && (
                    <div className="flex justify-start">
                        <div className="flex gap-3 max-w-[80%]">
                            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                                <Bot size={16} className="text-purple-600" />
                            </div>
                            <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t p-4">
                <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Napisz wiadomość do asystenta..."
                        className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none max-h-32 min-h-[50px]"
                        rows={1}
                        style={{ height: 'auto', minHeight: '52px' }}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || loading}
                        className="absolute right-2 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </form>
                <div className="text-center mt-2">
                    <p className="text-xs text-gray-400">AI może popełniać błędy. Sprawdź ważne informacje.</p>
                </div>
            </div>
        </div>
    );
}
