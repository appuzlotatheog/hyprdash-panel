import { useState, useRef, useEffect } from 'react';
import { Send, User, Loader2, Trash2, Check, X, Terminal, Download, Settings, Play, AlertCircle, Clock, History, FileCode, Database, Cpu, Command } from 'lucide-react';
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
    create_file: FileCode,
    delete_file: Trash2,
    database_op: Database,
    optimize: Cpu
};

// Minimal status styles
const statusStyles: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.1)]',
    approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    executed: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]',
    rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
    failed: 'bg-red-500/10 text-red-500 border-red-500/20',
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
        <div className="flex h-[600px] gap-6 p-1">
            {/* LEFT COLUMN: Chat Interface */}
            <div className="flex-1 flex flex-col glass-panel rounded-2xl overflow-hidden shadow-2xl relative border border-white/5">
                {/* Decorative background blur */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] rounded-full pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 glass-header backdrop-blur-md z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 border border-white/10 shadow-inner">
                            <LogoIcon className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-bold text-white text-base tracking-tight">AI Agent <span className="text-blue-400">MCP</span></h3>
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <p className="text-xs text-gray-400 font-mono">Connected to {serverName}</p>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={clearChat}
                        className="p-2.5 rounded-xl hover:bg-white/5 text-gray-400 hover:text-red-400 transition-all duration-300 border border-transparent hover:border-white/5"
                        title="Clear Context"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 relative z-0">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12 animate-fade-in-up">
                            <div className="mb-8 p-6 rounded-3xl bg-gradient-to-b from-white/5 to-transparent border border-white/5 relative group">
                                <div className="absolute inset-0 bg-blue-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-full" />
                                <BotAvatar className="h-12 w-12 text-blue-400 relative z-10 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                            </div>
                            <h4 className="text-2xl font-bold text-white mb-3">HyprDash Intelligence</h4>
                            <p className="text-gray-400 max-w-md mb-10 text-sm leading-relaxed">
                                Ready to assist with server management. I can execute commands, manage files, and optimize configurations via MCP tools.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-xl">
                                {[
                                    { label: 'Install EssentialsX', icon: Download },
                                    { label: 'Run performance check', icon: Cpu },
                                    { label: 'Clear log files', icon: Trash2 },
                                    { label: 'Backup database', icon: Database },
                                ].map((suggestion) => (
                                    <button
                                        key={suggestion.label}
                                        onClick={() => {
                                            setInput(suggestion.label);
                                            inputRef.current?.focus();
                                        }}
                                        className="flex items-center gap-3 px-5 py-4 text-sm font-medium rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-gray-300 hover:text-white transition-all duration-300 group text-left hover:translate-x-1"
                                    >
                                        <div className="p-2 rounded-lg bg-black/20 text-gray-400 group-hover:text-blue-400 transition-colors">
                                            <suggestion.icon className="h-4 w-4" />
                                        </div>
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
                            <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border shadow-lg ${message.role === 'user'
                                ? 'bg-gradient-to-br from-indigo-600 to-purple-700 border-white/10'
                                : 'bg-gradient-to-br from-gray-800 to-gray-900 border-white/10'
                                }`}>
                                {message.role === 'user'
                                    ? <User className="h-5 w-5 text-white" />
                                    : <BotAvatar className="h-5 w-5 text-blue-400" />
                                }
                            </div>
                            <div className={`max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
                                <div className={`inline-block px-5 py-4 text-sm shadow-md backdrop-blur-sm ${message.role === 'user'
                                    ? 'bg-blue-600/90 text-white rounded-2xl rounded-tr-sm border border-blue-500/20'
                                    : 'bg-gray-900/80 text-gray-200 border border-white/10 rounded-2xl rounded-tl-sm'
                                    }`}>
                                    {message.role === 'assistant' ? (
                                        <div className="prose prose-invert prose-sm max-w-none leading-relaxed prose-code:bg-black/50 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-blue-300">
                                            <ReactMarkdown>{message.content}</ReactMarkdown>
                                        </div>
                                    ) : (
                                        <p className="leading-relaxed font-medium">{message.content}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {isLoading && (
                        <div className="flex gap-4 animate-fade-in-up px-2">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-800/50 border border-white/5 flex items-center justify-center">
                                <BotAvatar className="h-4 w-4 text-gray-400" />
                            </div>
                            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-900/50 border border-white/5 flex items-center gap-2">
                                <span className="text-xs text-gray-500 font-mono mr-2">THINKING</span>
                                <div className="flex gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.15s' }} />
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce" style={{ animationDelay: '0.3s' }} />
                                </div>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="flex justify-center animate-fade-in-up">
                            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium backdrop-blur-md shadow-lg">
                                <AlertCircle className="h-3 w-3" />
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/20 border-t border-white/5 backdrop-blur-md z-10">
                    <form onSubmit={handleSubmit} className="relative group">
                        <div className="relative flex items-center bg-black/40 rounded-xl border border-white/10 focus-within:border-blue-500/50 focus-within:ring-1 focus-within:ring-blue-500/20 transition-all duration-300">
                            <div className="pl-4 text-gray-500">
                                <Command className="w-4 h-4" />
                            </div>
                            <input
                                ref={inputRef}
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Type a command or ask a question..."
                                className="flex-1 bg-transparent px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none text-sm"
                                disabled={isLoading}
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || isLoading}
                                className="mr-2 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-600/20"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </form>
                    <div className="mt-2 text-center flex justify-center gap-4 text-[10px] text-gray-500 font-mono tracking-wider uppercase">
                        <span>Powered by LLaMA 3</span>
                        <span>•</span>
                        <span>Groq Accelerated</span>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN: Tools / Actions (MCP) */}
            <div className="w-96 flex flex-col gap-4">

                {/* 1. Pending Actions Panel */}
                <div className="flex-1 min-h-0 glass-panel rounded-2xl overflow-hidden flex flex-col border border-white/5 shadow-2xl relative">
                    <div className="absolute inset-0 bg-gradient-to-b from-amber-500/5 to-transparent pointer-events-none" />
                    <div className="px-5 py-4 border-b border-white/5 bg-black/20 flex items-center gap-2 backdrop-blur-sm z-10">
                        <Clock className="h-4 w-4 text-amber-500" />
                        <h3 className="font-bold text-white text-sm tracking-wide">Pending Approval</h3>
                        {pendingActions.length > 0 && (
                            <span className="ml-auto bg-amber-500/20 text-amber-500 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                                {pendingActions.length} REQ
                            </span>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 relative z-0">
                        {pendingActions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 opacity-50">
                                <div className="p-4 rounded-full bg-white/5">
                                    <Check className="h-6 w-6" />
                                </div>
                                <p className="text-xs font-mono">ALL SYSTEMS GO</p>
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
                <div className="flex-1 min-h-0 glass-panel rounded-2xl overflow-hidden flex flex-col border border-white/5 shadow-2xl">
                    <div className="px-5 py-4 border-b border-white/5 bg-black/20 flex items-center gap-2 backdrop-blur-sm">
                        <History className="h-4 w-4 text-gray-400" />
                        <h3 className="font-bold text-white text-sm tracking-wide">Tool Logs</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                        {historyActions.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-3 opacity-50">
                                <div className="p-4 rounded-full bg-white/5">
                                    <Terminal className="h-6 w-6" />
                                </div>
                                <p className="text-xs font-mono">NO OPERATIONS</p>
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
        <div className={`group relative overflow-hidden rounded-xl border transition-all duration-300 bg-black/40 backdrop-blur-md ${statusStyles[action.status]} ${readOnly ? 'opacity-100' : 'hover:scale-[1.02] hover:shadow-lg'}`}>
            <div className="relative p-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-4 min-w-0">
                        <div className={`p-2.5 rounded-lg shrink-0 shadow-inner ${action.status === 'pending' ? 'bg-amber-500/10 text-amber-500' :
                            action.status === 'executed' ? 'bg-emerald-500/10 text-emerald-500' :
                                action.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                    'bg-gray-500/10 text-gray-400'
                            }`}>
                            {isExecuting ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <Icon className="h-5 w-5" />
                            )}
                        </div>
                        <div className="min-w-0 flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono opacity-70 bg-white/5 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-wider">
                                    {action.type.replace(/_/g, ' ')}
                                </span>
                            </div>
                            <h4 className="font-semibold text-sm text-gray-200 leading-snug">{action.description}</h4>
                        </div>
                    </div>
                </div>

                {/* Actions Row */}
                {!readOnly && action.status === 'pending' && !isExecuting && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                        <button
                            onClick={handleApprove}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/20 hover:border-emerald-500/40 transition-all active:scale-95"
                        >
                            <Check className="h-4 w-4" />
                            <span className="text-xs font-bold">APPROVE</span>
                        </button>
                        <button
                            onClick={onReject}
                            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 hover:border-red-500/40 transition-all active:scale-95"
                        >
                            <X className="h-4 w-4" />
                            <span className="text-xs font-bold">DENY</span>
                        </button>
                    </div>
                )}

                {/* Status Badge (History) */}
                {(readOnly || action.status !== 'pending') && (
                    <div className="flex items-center gap-2 mt-2">
                        {action.status === 'executed' && <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> COMPLETED</span>}
                        {action.status === 'failed' && <span className="text-[10px] text-red-500 font-bold flex items-center gap-1"><X className="w-3 h-3" /> FAILED</span>}
                        {action.status === 'rejected' && <span className="text-[10px] text-red-400 font-bold flex items-center gap-1"><X className="w-3 h-3" /> DENIED</span>}
                    </div>
                )}

                {/* Execution Result */}
                {(action.status === 'executed' || action.status === 'failed') && action.result && (
                    <div className={`mt-3 p-3 rounded-lg text-xs font-mono border break-words shadow-inner ${action.status === 'executed'
                        ? 'bg-black/40 border-emerald-500/10 text-emerald-400'
                        : 'bg-black/40 border-red-500/10 text-red-400'
                        }`}>
                        <div className="flex items-center gap-2 mb-2 opacity-50 border-b border-white/5 pb-1">
                            <Terminal className="h-3 w-3" />
                            <span className="uppercase font-bold text-[10px]">Stdout</span>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed opacity-90">{action.result}</pre>
                    </div>
                )}
            </div>

            {/* Loading Bar */}
            {isExecuting && (
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gray-800 overflow-hidden">
                    <div className="h-full bg-blue-500 animate-progress-indeterminate shadow-[0_0_10px_#3b82f6]" />
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
            <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.1" />
            <path d="M9 9H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
    );
}


export default AIChat;
