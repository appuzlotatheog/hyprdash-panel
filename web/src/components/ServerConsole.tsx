import { useRef, useEffect } from 'react'
import { Terminal, Activity } from 'lucide-react'

interface ServerConsoleProps {
    lines: string[]
    command: string
    onCommandChange: (cmd: string) => void
    onSendCommand: (e: React.FormEvent) => void
    status: string
    installProgress: { progress: number; message: string } | null
}

export default function ServerConsole({
    lines,
    command,
    onCommandChange,
    onSendCommand,
    status,
    installProgress
}: ServerConsoleProps) {
    const consoleRef = useRef<HTMLDivElement>(null)

    // Auto-scroll
    useEffect(() => {
        if (consoleRef.current) {
            consoleRef.current.scrollTop = consoleRef.current.scrollHeight
        }
    }, [lines, installProgress])

    return (
        <div className="flex flex-col h-[600px] bg-black border border-dark-700 rounded-sm overflow-hidden font-mono text-sm shadow-none relative group">
            {/* Technical Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-dark-900 border-b border-dark-700">
                <div className="flex items-center gap-3">
                    <Terminal className="w-4 h-4 text-accent" />
                    <span className="text-white text-xs font-medium tracking-wider">TERMINAL_OUTPUT</span>
                    <span className="text-dark-500 text-xs">::</span>
                    <span className="text-dark-400 text-xs">bash — 80x24</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-black rounded-sm border border-dark-800">
                        <div className={`w-1.5 h-1.5 rounded-full ${status === 'RUNNING' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[10px] text-dark-300 uppercase">{status}</span>
                    </div>
                </div>
            </div>

            {/* Installation Progress Overlay */}
            {installProgress && (
                <div className="absolute inset-0 z-10 bg-black/90 backdrop-blur-sm flex items-center justify-center">
                    <div className="w-full max-w-md p-6 space-y-4 border border-dark-700 bg-dark-900 rounded-sm">
                        <div className="flex justify-between text-white text-sm font-medium font-mono">
                            <span>INSTALLING_PACKAGES...</span>
                            <span>{installProgress.progress}%</span>
                        </div>
                        <div className="h-0.5 bg-dark-800 w-full">
                            <div
                                className="h-full bg-accent transition-all duration-300 ease-out"
                                style={{ width: `${installProgress.progress}%` }}
                            />
                        </div>
                        <p className="text-dark-400 text-xs text-center font-mono uppercase tracking-tight">{installProgress.message}</p>
                    </div>
                </div>
            )}

            {/* Console Output */}
            <div
                ref={consoleRef}
                className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent bg-black"
            >
                {lines.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-dark-600 space-y-2 opacity-50">
                        <Activity className="w-8 h-8" />
                        <p className="text-xs uppercase tracking-widest">Awaiting Input Stream...</p>
                    </div>
                ) : (
                    lines.map((line, i) => {
                        const lowerLine = line.toLowerCase()
                        let colorClass = 'text-dark-300' // Default grey

                        if (line.startsWith('>')) colorClass = 'text-white font-bold'
                        else if (lowerLine.includes('error') || lowerLine.includes('fatal') || lowerLine.includes('exception')) colorClass = 'text-red-500'
                        else if (lowerLine.includes('warn')) colorClass = 'text-amber-500'
                        else if (lowerLine.includes('info')) colorClass = 'text-blue-400'
                        else if (lowerLine.includes('success') || lowerLine.includes('done')) colorClass = 'text-emerald-500'

                        return (
                            <div key={i} className={`${colorClass} break-all whitespace-pre-wrap leading-relaxed font-mono text-[13px]`}>
                                <span className="opacity-20 mr-3 select-none text-[10px] text-dark-500">
                                    {new Date().toLocaleTimeString([], { hour12: false })}
                                </span>
                                {line}
                            </div>
                        )
                    })
                )}

                {/* Active Line Indicator */}
                {status === 'RUNNING' && (
                    <div className="flex items-center gap-2 text-white animate-pulse mt-2">
                        <span className="text-accent">➜</span>
                        <span className="w-2 h-4 bg-accent/50" />
                    </div>
                )}
            </div>

            {/* Command Input */}
            <form onSubmit={onSendCommand} className="bg-dark-900 p-0 border-t border-dark-700 flex relative">
                <div className="flex-1 relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent font-bold text-sm">➜</span>
                    <input
                        type="text"
                        value={command}
                        onChange={(e) => onCommandChange(e.target.value)}
                        placeholder={status === 'RUNNING' ? "Execute command..." : "Server offline"}
                        disabled={status !== 'RUNNING'}
                        className="w-full bg-transparent border-none px-10 py-3 text-white placeholder-dark-600 focus:outline-none focus:ring-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm h-12"
                        spellCheck={false}
                    />
                </div>
                <button
                    type="submit"
                    disabled={status !== 'RUNNING' || !command.trim()}
                    className="px-6 bg-dark-800 text-white font-medium text-xs hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border-l border-dark-700 uppercase tracking-wider"
                >
                    Send
                </button>
            </form>
        </div>
    )
}
