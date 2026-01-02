import { useState, useRef, useEffect } from 'react';
import { Send, User, Loader2, Trash2, Check, X, Terminal, Download, Settings, Play, ChevronRight, AlertCircle, Clock, History } from 'lucide-react';
import { useAIChat } from '../hooks/useAIChat';
import { AIAction } from '../services/ai';
import ReactMarkdown from 'react-markdown';

interface AIChatProps {
    serverId: string;
    serverName: string;
}

// Action type icons
const actionIcons: Record<string, any> = {
    download_plugin: Download,
    modify_config: Settings,
    execute_command: Terminal,
    server_control: Play,
    create_file: Settings,
    delete_file: Trash2,
};

// Minimal status styles
const statusStyles: Record<string, string> = {
    pending: 'bg-yellow-500/5 text-yellow-500 border-yellow-500/20',
    approved: 'bg-blue-500/5 text-blue-500 border-blue-500/20',
    executed: 'bg-green-500/5 text-green-500 border-green-500/20',
    rejected: 'bg-red-500/5 text-red-500 border-red-500/20',
    failed: 'bg-red-500/5 text-red-500 border-red-500/20',
};

export function AIChat({ serverId, serverName }: AIChatProps) {
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const {
        messages,
        actions,
        isLoading,
        error,
        sendMessage,
        approveAction,
        rejectAction,
        clearChat,
    } = useAIChat({ serverId });

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (input.trim() && !isLoading) {
            sendMessage(input);
            setInput('');
        }
    };

    const pendingActions = actions.filter(a => a.status === 'pending');
    const historyActions = actions.filter(a => a.status !== 'pending').reverse(); // Newest first for history

    return (
        <div className="flex h-full gap-4 bg-transparent p-1">
            {/* LEFT COLUMN: Chat Interface */}
            <div className="flex-1 flex flex-col bg-[#09090b] rounded-xl border border-[#27272a] overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a] bg-[#09090b]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-md bg-white/5 border border-white/5">
                            <LogoIcon className="h-4 w-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-medium text-white text-sm">AI Commander</h3>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                <p className="text-xs text-zinc-500 font-medium">{serverName}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={clearChat}
                        className="p-2 rounded-md hover:bg-white/5 text-zinc-500 hover:text-red-400 transition-colors"
                        title="Clear chat history"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12 animate-fade-in-up">
                            <div className="mb-6 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                                <BotAvatar className="h-8 w-8 text-zinc-400" />
                            </div>
                            <h4 className="text-xl font-medium text-white mb-2">How can I help you?</h4>
                            <p className="text-zinc-500 max-w-md mb-8 text-sm">
                                I'm your advanced server assistant. I can manage plugins, configure settings, and optimize performance.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                                {[
                                    { label: 'Install EssentialsX', icon: Download },
                                    { label: 'Optimize performance', icon: Settings },
                                    { label: 'Fix server lag', icon: ActivityIcon },
                                    { label: 'Setup permissions', icon: UsersIcon },
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion.label}
                                        onClick={() => {
                                            setInput(suggestion.label);
                                            inputRef.current?.focus();
                                        }}
                                        className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg bg-zinc-900/50 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white transition-all duration-200 group text-left"
                                    >
                                        <suggestion.icon className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
                                        {suggestion.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((message, index) => (
                        <div
                            key={index}
                            className={`flex gap-4 animate-fade-in-up ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                        >
                            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border ${message.role === 'user'
                                ? 'bg-zinc-900 border-zinc-800'
                                : 'bg-zinc-900 border-zinc-800'
                                }`}>
                                {message.role === 'user'
                                    ? <User className="h-4 w-4 text-zinc-400" />
                                    : <BotAvatar className="h-4 w-4 text-zinc-400" />
                                }
                            </div>
                            <div className={`max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`inline-block px-4 py-3 text-sm ${message.role === 'user'
                                    ? 'bg-white text-black rounded-2xl rounded-tr-sm font-medium'
                                    : 'bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-2xl rounded-tl-sm'
                                    }`}>
                                    {message.role === 'assistant' ? (
                                        <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="leading-relaxed">{message.content}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-4 animate-fade-in-up">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                                <BotAvatar className="h-4 w-4 text-zinc-400" />
                            </div>
                            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-zinc-900 border border-zinc-800 flex items-center gap-2">
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex justify-center animate-fade-in-up">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
                                <AlertCircle className="h-3 w-3" />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-[#09090b] border-t border-[#27272a]">
                    <form onSubmit={handleSubmit} className="relative">
                        <div className="relative flex items-center bg-zinc-900 rounded-lg border border-zinc-800 focus-within:border-zinc-700 transition-colors">
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type a command or ask a question..."
                                className="flex-1 bg-transparent px-4 py-3 text-white placeholder-zinc-600 focus:outline-none text-sm font-medium"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="mr-2 p-2 rounded-md bg-white text-black hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </form>
                    <div className="mt-2 text-center">
                        <p className="text-[10px] text-zinc-600 font-medium">
                            Powered by Groq AI
                        </p>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Sidebar (Bento Grid) */}
            <div className="w-96 flex flex-col gap-4">

                {/* 1. Pending Actions Panel */}
                <div className="flex-1 min-h-0 bg-[#09090b] rounded-xl border border-[#27272a] overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-[#27272a] bg-[#09090b] flex items-center gap-2">
                        <Clock className="h-4 w-4 text-yellow-500" />
                        <h3 className="font-medium text-white text-sm">Pending Approval</h3>
                        {pendingActions.length > 0 && (
                            <span className="ml-auto bg-yellow-500/10 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {pendingActions.length}
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                        {pendingActions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                                <Check className="h-8 w-8 opacity-20" />
                                <p className="text-xs">No pending actions</p>
                            </div>
                        ) : (
                            pendingActions.map((action) => (
                                <ActionCard
                                    key={action.id}
                                    action={action}
                                    onApprove={() => approveAction(action.id)}
                                    onReject={() => rejectAction(action.id)}
                                />
                            ))
                        )}
                    </div>
                </div>

                {/* 2. Results/History Panel */}
                <div className="flex-1 min-h-0 bg-[#09090b] rounded-xl border border-[#27272a] overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-[#27272a] bg-[#09090b] flex items-center gap-2">
                        <History className="h-4 w-4 text-zinc-400" />
                        <h3 className="font-medium text-white text-sm">Activity Log</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-zinc-800">
                        {historyActions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-2">
                                <Terminal className="h-8 w-8 opacity-20" />
                                <p className="text-xs">No recent activity</p>
                            </div>
                        ) : (
                            historyActions.map((action) => (
                                <ActionCard
                                    key={action.id}
                                    action={action}
                                    onApprove={() => { }}
                                    onReject={() => { }}
                                    readOnly
                                />
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}

// Action card component with loading state and results
function ActionCard({
    action,
    onApprove,
    onReject,
    readOnly = false
}: {
    action: AIAction;
    onApprove: () => void;
    onReject: () => void;
    readOnly?: boolean;
}) {
    const [isExecuting, setIsExecuting] = useState(false);
    const Icon = actionIcons[action.type] || Settings;

    const handleApprove = async () => {
        setIsExecuting(true);
        try {
            await onApprove();
        } finally {
            setIsExecuting(false);
        }
    };

    return (
        <div className={`group relative overflow-hidden rounded-lg border transition-all duration-200 ${statusStyles[action.status]} ${readOnly ? 'opacity-100' : 'hover:border-opacity-40'}`}>
            <div className="relative p-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className={`p-2 rounded-md shrink-0 ${action.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                action.status === 'executed' ? 'bg-green-500/10 text-green-500' :
                                    action.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                        'bg-zinc-500/10 text-zinc-500'
                            }`}>
                            {isExecuting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Icon className="h-4 w-4" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h4 className="font-medium text-sm mb-0.5 text-zinc-200 truncate">{action.description}</h4>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono opacity-60 uppercase tracking-wide truncate">
                                    {action.type.replace(/_/g, ' ')}
                                </span>
                                {action.status === 'executed' && (
                                    <span className="flex items-center gap-1 text-[10px] text-green-500 font-medium shrink-0">
                                        <Check className="h-3 w-3" /> Done
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {!readOnly && action.status === 'pending' && !isExecuting && (
                        <div className="flex items-center gap-1 shrink-0">
                            <button
                                onClick={handleApprove}
                                className="p-1.5 rounded-md bg-green-500/10 hover:bg-green-500/20 text-green-500 transition-colors"
                                title="Approve"
                            >
                                <Check className="h-4 w-4" />
                            </button>
                            <button
                                onClick={onReject}
                                className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-500 transition-colors"
                                title="Reject"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Execution Result */}
                {(action.status === 'executed' || action.status === 'failed') && action.result && (
                    <div className={`mt-3 p-2.5 rounded-md text-xs font-mono border break-words ${action.status === 'executed'
                            ? 'bg-green-950/10 border-green-500/10 text-green-400'
                            : 'bg-red-950/10 border-red-500/10 text-red-400'
                        }`}>
                        <div className="flex items-center gap-2 mb-1 opacity-50">
                            <Terminal className="h-3 w-3" />
                            <span className="uppercase font-bold text-[10px]">Output</span>
                        </div>
                        {action.result}
                    </div>
                )}
            </div>

            {/* Loading Bar */}
            {isExecuting && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-white animate-progress-indeterminate" />
                </div>
            )}
        </div>
    );
}

// Custom geometric logo icon
function LogoIcon({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// Custom bot avatar
function BotAvatar({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
            <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M9 9H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
    );
}

// Helper icons
function ActivityIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
    )
}

function UsersIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}

export default AIChat;
