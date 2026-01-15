import { useEffect, useState, useCallback, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
    Command,
    Search,
    Server,
    Users,
    HardDrive,
    Settings,
    Home,
    X,
    ArrowRight
} from 'lucide-react'

interface Shortcut {
    key: string
    modifiers: ('ctrl' | 'alt' | 'shift' | 'meta')[]
    description: string
    action: () => void
    category: string
}

interface KeyboardShortcutsProps {
    children: ReactNode
}

export function KeyboardShortcuts({ children }: KeyboardShortcutsProps) {
    const navigate = useNavigate()
    const [showPalette, setShowPalette] = useState(false)
    const [showHelp, setShowHelp] = useState(false)
    const [search, setSearch] = useState('')

    const shortcuts: Shortcut[] = [
        // Navigation
        { key: 'h', modifiers: ['alt'], description: 'Go to Dashboard', action: () => navigate('/'), category: 'Navigation' },
        { key: 's', modifiers: ['alt'], description: 'Go to Servers', action: () => navigate('/servers'), category: 'Navigation' },
        { key: 'n', modifiers: ['alt'], description: 'Go to Nodes', action: () => navigate('/nodes'), category: 'Navigation' },
        { key: 'u', modifiers: ['alt'], description: 'Go to Users', action: () => navigate('/users'), category: 'Navigation' },

        // Actions
        { key: 'k', modifiers: ['ctrl'], description: 'Open Command Palette', action: () => setShowPalette(true), category: 'Actions' },
        { key: '/', modifiers: [], description: 'Focus Search', action: () => document.querySelector<HTMLInputElement>('[data-search-input]')?.focus(), category: 'Actions' },
        { key: '?', modifiers: ['shift'], description: 'Show Keyboard Shortcuts', action: () => setShowHelp(true), category: 'Actions' },
        { key: 'Escape', modifiers: [], description: 'Close Modal/Palette', action: () => { setShowPalette(false); setShowHelp(false) }, category: 'Actions' },
    ]

    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        // Don't trigger if typing in an input
        if (
            e.target instanceof HTMLInputElement ||
            e.target instanceof HTMLTextAreaElement ||
            e.target instanceof HTMLSelectElement
        ) {
            // Only allow Escape in inputs
            if (e.key !== 'Escape') return
        }

        for (const shortcut of shortcuts) {
            const ctrlMatch = shortcut.modifiers.includes('ctrl') === (e.ctrlKey || e.metaKey)
            const altMatch = shortcut.modifiers.includes('alt') === e.altKey
            const shiftMatch = shortcut.modifiers.includes('shift') === e.shiftKey

            if (
                e.key.toLowerCase() === shortcut.key.toLowerCase() &&
                ctrlMatch && altMatch && shiftMatch
            ) {
                e.preventDefault()
                shortcut.action()
                return
            }
        }
    }, [shortcuts])

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])

    const commands = [
        { id: 'home', label: 'Go to Dashboard', icon: Home, action: () => navigate('/') },
        { id: 'servers', label: 'Go to Servers', icon: Server, action: () => navigate('/servers') },
        { id: 'nodes', label: 'Go to Nodes', icon: HardDrive, action: () => navigate('/nodes') },
        { id: 'users', label: 'Go to Users', icon: Users, action: () => navigate('/users') },
        { id: 'settings', label: 'Go to Settings', icon: Settings, action: () => navigate('/admin/settings') },
        { id: 'create-server', label: 'Create New Server', icon: Server, action: () => navigate('/servers/create') },
    ]

    const filteredCommands = search
        ? commands.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))
        : commands

    const groupedShortcuts = shortcuts.reduce((acc, s) => {
        if (!acc[s.category]) acc[s.category] = []
        acc[s.category].push(s)
        return acc
    }, {} as Record<string, Shortcut[]>)

    const formatKey = (shortcut: Shortcut) => {
        const parts: string[] = []
        if (shortcut.modifiers.includes('ctrl')) parts.push('Ctrl')
        if (shortcut.modifiers.includes('alt')) parts.push('Alt')
        if (shortcut.modifiers.includes('shift')) parts.push('Shift')
        parts.push(shortcut.key.toUpperCase())
        return parts.join(' + ')
    }

    return (
        <>
            {children}

            {/* Command Palette */}
            {showPalette && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowPalette(false)}
                >
                    <div
                        className="w-full max-w-xl bg-dark-900 border border-dark-700 rounded-sm shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-700">
                            <Search className="w-5 h-5 text-dark-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Type a command or search..."
                                className="flex-1 bg-transparent text-white placeholder-dark-500 outline-none text-sm"
                                autoFocus
                            />
                            <kbd className="text-xs text-dark-500 bg-dark-800 px-1.5 py-0.5 rounded">ESC</kbd>
                        </div>
                        <div className="max-h-80 overflow-y-auto py-2">
                            {filteredCommands.length > 0 ? (
                                filteredCommands.map(cmd => (
                                    <button
                                        key={cmd.id}
                                        onClick={() => {
                                            cmd.action()
                                            setShowPalette(false)
                                            setSearch('')
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-dark-800 transition-colors"
                                    >
                                        <cmd.icon className="w-4 h-4 text-dark-400" />
                                        <span className="text-sm text-white">{cmd.label}</span>
                                        <ArrowRight className="w-3 h-3 text-dark-600 ml-auto" />
                                    </button>
                                ))
                            ) : (
                                <div className="px-4 py-8 text-center text-dark-500 text-sm">
                                    No commands found
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Keyboard Shortcuts Help */}
            {showHelp && createPortal(
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowHelp(false)}
                >
                    <div
                        className="w-full max-w-lg bg-dark-900 border border-dark-700 rounded-sm shadow-2xl overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
                            <div className="flex items-center gap-2">
                                <Command className="w-4 h-4 text-accent" />
                                <h2 className="text-sm font-medium text-white">Keyboard Shortcuts</h2>
                            </div>
                            <button
                                onClick={() => setShowHelp(false)}
                                className="text-dark-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
                            {Object.entries(groupedShortcuts).map(([category, shortcuts]) => (
                                <div key={category}>
                                    <h3 className="text-xs text-dark-500 uppercase tracking-wider mb-2">{category}</h3>
                                    <div className="space-y-1">
                                        {shortcuts.map((s, i) => (
                                            <div key={i} className="flex items-center justify-between py-1.5">
                                                <span className="text-sm text-dark-300">{s.description}</span>
                                                <kbd className="text-xs text-dark-400 bg-dark-800 px-2 py-1 rounded font-mono">
                                                    {formatKey(s)}
                                                </kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
