'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { House, Send, Sparkles, RotateCcw, User, MessageSquare, Trash2, Menu, X } from 'lucide-react';
import AIChart from '@/components/ai/AIChart';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Session {
    id: string;
    title: string;
    updatedAt: string;
}

export default function AIAssistantPage() {
    const { user, userData, loading: authLoading } = useAuth();
    const router = useRouter();

    // UI State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auth Check
    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Load Sessions list
    useEffect(() => {
        if (user) {
            fetchSessions();
        }
    }, [user]);

    const fetchSessions = async () => {
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/ai-assistant/sessions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (e) {
            console.error('Failed to load sessions', e);
        }
    };

    // Load Session Details
    const loadSession = async (sessionId: string) => {
        setLoading(true);
        setCurrentSessionId(sessionId);
        try {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/ai-assistant/sessions/${sessionId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                // Map Firestore messages to UI
                // Data.messages might contain {role: 'user'|'assistant', content: string}
                setMessages(data.messages || []);
                // On mobile, close sidebar after selection
                if (window.innerWidth < 768) setIsSidebarOpen(false);
            }
        } catch (e) {
            console.error('Failed to load session details', e);
        } finally {
            setLoading(false);
        }
    };

    const createNewThread = () => {
        setCurrentSessionId(null);
        setMessages([]);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
    };

    const confirmDeleteSession = (e: React.MouseEvent, sessionId: string) => {
        e.stopPropagation();
        setSessionToDelete(sessionId);
    };

    const handleDelete = async () => {
        if (!sessionToDelete) return;

        try {
            const token = await user?.getIdToken();
            await fetch(`/api/ai-assistant/sessions/${sessionToDelete}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Remove from list
            setSessions(prev => prev.filter(s => s.id !== sessionToDelete));

            if (currentSessionId === sessionToDelete) {
                createNewThread();
            }
        } catch (err) {
            console.error('Delete failed', err);
        } finally {
            setSessionToDelete(null);
        }
    };

    const startNewThread = () => {
        createNewThread();
    };

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

            const token = await user?.getIdToken();
            const res = await fetch('/api/ai-assistant', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    sessionId: currentSessionId
                })
            });

            if (!res.ok) throw new Error('Failed to fetch response');

            const data = await res.json();
            const newAiMessage: Message = { role: 'assistant', content: data.response };

            setMessages(prev => [...prev, newAiMessage]);

            if (data.sessionId) {
                // Determine if this was a new session we just created
                if (!currentSessionId) {
                    setCurrentSessionId(data.sessionId);
                    // Add to sidebar list
                    setSessions(prev => [{
                        id: data.sessionId,
                        title: data.title || 'Nowy wątek',
                        updatedAt: new Date().toISOString()
                    }, ...prev]);
                }
            }
        } catch (error) {
            console.error(error);
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
        <div className="min-h-screen bg-gray-50 flex overflow-hidden">

            {/* Delete Confirmation Modal */}
            {sessionToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">Usunąć wątek?</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Tej operacji nie można cofnąć. Historia rozmowy zostanie trwale usunięta.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setSessionToDelete(null)}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={handleDelete}
                                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm shadow-red-600/20"
                            >
                                Usuń
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-20 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-30 w-[85vw] sm:w-80 md:w-72 lg:w-80 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out flex flex-col shadow-2xl md:shadow-none
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                md:relative md:translate-x-0
            `}>
                <div className="p-5 border-b flex items-center justify-between bg-gray-50/50">
                    <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-200 rounded-xl text-gray-500 hover:text-primary transition-colors">
                        <img src="/home-icon.jpg" alt="Home" className="w-[37px] h-[37px] object-contain" />
                    </button>
                    <h2 className="font-semibold text-gray-800 text-lg">Twoje rozmowy</h2>
                    <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-4">
                    <button
                        onClick={startNewThread}
                        className="w-full flex items-center gap-3 justify-center px-4 py-3.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-all transform active:scale-95 shadow-md font-medium text-base"
                    >
                        <RotateCcw size={18} /> Nowy wątek
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-1.5 pb-4">
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => loadSession(session.id)}
                            className={`
                                group flex items-center justify-between px-4 py-3.5 rounded-xl cursor-pointer transition-all border border-transparent
                                ${currentSessionId === session.id
                                    ? 'bg-primary-lighter/50 text-primary-dark font-semibold border-primary/10 shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }
                            `}
                        >
                            <div className="flex items-center gap-3 overflow-hidden min-w-0">
                                <MessageSquare size={18} className={`flex-shrink-0 ${currentSessionId === session.id ? 'text-primary' : 'text-gray-400'}`} />
                                <span className="truncate text-[15px]">{session.title}</span>
                            </div>
                            <button
                                onClick={(e) => confirmDeleteSession(e, session.id)}
                                className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-white rounded-lg"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                            <MessageSquare size={32} className="opacity-20" />
                            <span className="text-sm">Brak historii rozmów</span>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Chat Area */}
            <main className="flex-1 flex flex-col min-w-0 h-screen">
                {/* Header */}
                <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10 shrink-0 h-16">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="md:hidden p-2 -ml-2 text-gray-600"
                        >
                            <Menu size={20} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Sparkles className="text-primary" size={20} />
                            <div>
                                <h1 className="font-bold text-gray-900 leading-tight">Asystent AI</h1>
                                <p className="text-[10px] text-gray-500 leading-none">Ostatnia aktualizacja: Teraz</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
                            <div className="w-16 h-16 bg-primary-light rounded-full flex items-center justify-center mb-4">
                                <Sparkles className="text-primary" size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-gray-700 mb-2">Jak mogę Ci pomóc?</h3>
                            <p className="max-w-md text-sm mb-8">
                                Wybierz wątek z historii po lewej lub zacznij nową rozmowę poniżej.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm max-w-lg w-full">
                                <button onClick={() => { setInput("Napisz maila do piekarni..."); }} className="p-3 bg-white border rounded-lg hover:border-primary hover:text-primary-dark transition-all text-left truncate">
                                    "Napisz maila..."
                                </button>
                                <button onClick={() => { setInput("Wyjaśnij wzrosty RDN..."); }} className="p-3 bg-white border rounded-lg hover:border-primary hover:text-primary-dark transition-all text-left truncate">
                                    "Wyjaśnij RDN..."
                                </button>
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex max-w-[85%] sm:max-w-[75%] gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center overflow-hidden ${msg.role === 'user' ? 'bg-primary-light text-primary' : 'bg-transparent p-0.5'}`}>
                                        {msg.role === 'user' ? <User size={16} /> : <img src="/logo-e.png" alt="AI" className="w-full h-full object-contain" />}
                                    </div>
                                    <div className={`p-3 sm:p-4 rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm text-sm ${msg.role === 'user'
                                        ? 'bg-primary text-white rounded-tr-none'
                                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
                                        }`}>
                                        {(() => {
                                            const content = msg.content;
                                            // Check for JSON chart block
                                            const chartMatch = content.match(/```json\s*(\{[\s\S]*?"type":\s*"chart"[\s\S]*?\})\s*```/);

                                            if (chartMatch && msg.role === 'assistant') {
                                                try {
                                                    const chartData = JSON.parse(chartMatch[1]);
                                                    const textBefore = content.substring(0, chartMatch.index).trim();
                                                    const textAfter = content.substring((chartMatch.index || 0) + chartMatch[0].length).trim();

                                                    return (
                                                        <div className="w-full min-w-[300px] max-w-2xl">
                                                            {textBefore && <p className="mb-4">{textBefore}</p>}
                                                            <AIChart
                                                                type={chartData.chartType || 'line'}
                                                                title={chartData.title}
                                                                data={chartData.data}
                                                                xAxisLabel={chartData.xAxisLabel}
                                                                yAxisLabel={chartData.yAxisLabel}
                                                            />
                                                            {textAfter && <p className="mt-4 text-gray-600">{textAfter}</p>}
                                                        </div>
                                                    );
                                                } catch (e) {
                                                    console.error("Failed to parse chart JSON", e);
                                                    return content;
                                                }
                                            }
                                            return content;
                                        })()}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {loading && (
                        <div className="flex justify-start">
                            <div className="flex gap-3 max-w-[80%]">
                                <div className="w-8 h-8 rounded-full bg-transparent flex items-center justify-center overflow-hidden p-0.5">
                                    <img src="/logo-e.png" alt="AI" className="w-full h-full object-contain" />
                                </div>
                                <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-gray-100 shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-white border-t p-4 shrink-0">
                    <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-center gap-2">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Napisz wiadomość..."
                            className="w-full pl-4 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none max-h-32 min-h-[50px] shadow-sm"
                            rows={1}
                            style={{ height: 'auto', minHeight: '52px' }}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || loading}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                    <div className="text-center mt-2">
                        <p className="text-[10px] text-gray-400">Asystent AI może popełniać błędy • Weryfikuj informacje</p>
                    </div>
                </div>
            </main>
        </div>
    );
}
