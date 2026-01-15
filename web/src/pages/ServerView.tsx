import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Play,
    Square,
    RotateCcw,
    Skull,
    Terminal,
    Settings,
    FileText,
    Archive,
    Clock,
    Cpu,
    MemoryStick,
    HardDrive,
    Activity,
    Users,
    Gamepad2,
    Package,
    Database,
    Sparkles,
    Server,
    Code
} from 'lucide-react'
import { toast } from 'sonner'
import { serversApi } from '../services/api'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/auth'
import FileManager from '../components/FileManager'
import BackupManager from '../components/BackupManager'
import ScheduleManager from '../components/ScheduleManager'
import ServerConsole from '../components/ServerConsole'
import SubuserManager from '../components/SubuserManager'
import { DatabaseManager } from '../components/server/DatabaseManager'
import { PluginManager } from '../components/server/PluginManager'
import { PlayerStats } from '../components/server/PlayerStats'
import { SFTPInfo } from '../components/server/SFTPInfo'
import { StartupEditor } from '../components/server/StartupEditor'
import AIChat from '../components/AIChat'

const tabs = [
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'files', label: 'Files', icon: FileText },
    { id: 'sftp', label: 'SFTP', icon: Server },
    { id: 'startup', label: 'Startup', icon: Code },
    { id: 'players', label: 'Players', icon: Gamepad2 },
    { id: 'plugins', label: 'Plugins', icon: Package },
    { id: 'databases', label: 'Databases', icon: Database },
    { id: 'backups', label: 'Backups', icon: Archive },
    { id: 'schedules', label: 'Schedules', icon: Clock },
    { id: 'users', label: 'Subusers', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
]


export default function ServerView() {
    const { id } = useParams<{ id: string }>()
    const [activeTab, setActiveTab] = useState('console')
    const [command, setCommand] = useState('')
    const [consoleLines, setConsoleLines] = useState<string[]>([])
    const [stats, setStats] = useState({ cpu: 0, memory: 0 })
    const [installProgress, setInstallProgress] = useState<{ progress: number; message: string } | null>(null)
    const [socketConnected, setSocketConnected] = useState(false)
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const user = useAuthStore((state) => state.user)

    const { data, isLoading } = useQuery({
        queryKey: ['server', id],
        queryFn: () => serversApi.get(id!),
        enabled: !!id,
    })

    const server = data?.server
    const isOwner = server?.ownerId === user?.id || user?.role === 'ADMIN'

    const powerMutation = useMutation({
        mutationFn: (action: 'start' | 'stop' | 'restart' | 'kill') =>
            serversApi.power(id!, action),
        onSuccess: (_, action) => {
            queryClient.invalidateQueries({ queryKey: ['server', id] })
            toast.success(`Server ${action} command sent`)
        },
        onError: (error: any) => {
            toast.error(error.message || 'Power action failed')
        },
    })

    const commandMutation = useMutation({
        mutationFn: (cmd: string) => serversApi.command(id!, cmd),
        onSuccess: () => {
            setCommand('')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to send command')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: () => serversApi.delete(id!),
        onSuccess: () => {
            toast.success('Server deleted')
            queryClient.invalidateQueries({ queryKey: ['servers'] })
            navigate('/servers')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to delete server')
        },
    })

    // Subscribe to server updates
    useEffect(() => {
        if (!id) return

        socketService.subscribeToServer(id)

        // Track connection state
        const unsubConnection = socketService.onConnectionChange((connected) => {
            setSocketConnected(connected)
            if (connected) {
                // Request fresh status when reconnected
                socketService.requestServerStatus(id)
            }
        })

        const unsubStatus = socketService.onServerStatus((data) => {
            if (data.serverId === id) {
                queryClient.setQueryData(['server', id], (old: any) => ({
                    ...old,
                    server: { ...old?.server, status: data.status },
                }))
            }
        })

        // Handle console history (array of lines sent on subscribe/reconnect)
        const handleConsoleHistory = (data: { serverId: string; lines: string[] }) => {
            if (data.serverId === id && data.lines?.length > 0) {
                setConsoleLines(data.lines.slice(-500))
            }
        }
        socketService.getSocket()?.on('server:console:history', handleConsoleHistory)

        const unsubConsole = socketService.onServerConsole((data) => {
            if (data.serverId === id) {
                setConsoleLines((prev) => [...prev.slice(-500), data.line])
            }
        })

        const unsubStats = socketService.onServerStats((data) => {
            if (data.serverId === id) {
                setStats({ cpu: data.cpu, memory: data.memory })
            }
        })

        const unsubInstallProgress = socketService.onInstallProgress((data) => {
            if (data.serverId === id) {
                setInstallProgress({ progress: data.progress, message: data.message })
                setConsoleLines((prev) => [...prev.slice(-500), `[INSTALL] ${data.message} `])
            }
        })

        const unsubInstallComplete = socketService.onInstallComplete((data) => {
            if (data.serverId === id) {
                setInstallProgress(null)
                setConsoleLines((prev) => [...prev.slice(-500), '[INSTALL] ✅ Installation complete!'])
                toast.success('Server installation complete!')
                queryClient.invalidateQueries({ queryKey: ['server', id] })
            }
        })

        const unsubInstallError = socketService.onInstallError((data) => {
            if (data.serverId === id) {
                setInstallProgress(null)
                setConsoleLines((prev) => [...prev.slice(-500), `[INSTALL] ❌ Error: ${data.error} `])
                toast.error(`Installation failed: ${data.error} `)
            }
        })

        return () => {
            socketService.unsubscribeFromServer(id)
            unsubConnection()
            unsubStatus()
            socketService.getSocket()?.off('server:console:history', handleConsoleHistory)
            unsubConsole()
            unsubStats()
            unsubInstallProgress()
            unsubInstallComplete()
            unsubInstallError()
        }
    }, [id, queryClient])

    const handleSendCommand = (e: React.FormEvent) => {
        e.preventDefault()
        if (command.trim()) {
            setConsoleLines((prev) => [...prev, `> ${command} `])
            commandMutation.mutate(command)
        }
    }

    if (isLoading || !server) {
        return (
            <div className="animate-pulse space-y-6">
                <div className="h-10 bg-dark-800 rounded-sm w-1/4" />
                <div className="h-96 bg-dark-800 rounded-sm" />
            </div>
        )
    }

    const statusConfig = {
        RUNNING: { color: 'bg-emerald-500', text: 'Running', textClass: 'text-emerald-500' },
        OFFLINE: { color: 'bg-dark-500', text: 'Offline', textClass: 'text-dark-400' },
        STARTING: { color: 'bg-amber-500', text: 'Starting...', textClass: 'text-amber-500' },
        STOPPING: { color: 'bg-orange-500', text: 'Stopping...', textClass: 'text-orange-500' },
    }

    const status = statusConfig[server.status as keyof typeof statusConfig] || statusConfig.OFFLINE
    const memoryPercent = server.memory > 0 ? (stats.memory / server.memory) * 100 : 0

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Header Area */}
            <div className="relative rounded-3xl overflow-hidden glass-panel p-6 lg:p-10 border border-white/10 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.5)] ring-1 ring-white/5 bg-gradient-to-b from-white/5 to-black/20 backdrop-blur-2xl group transition-all duration-500 hover:shadow-[0_0_50px_rgba(59,130,246,0.1)]">
                {/* Background decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/2" />

                <div className="relative z-10 flex flex-col lg:flex-row gap-8 justify-between items-start lg:items-center">
                    <div className="flex items-start gap-6">
                        <div className={`
                            w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg border border-white/10
                            ${status.color.replace('bg-', 'bg-')}/10
                        `}>
                            <div className={`w-3 h-3 rounded-full ${status.color} shadow-[0_0_15px_currentColor] animate-pulse`} />
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider border ${status.textClass} border-current bg-current/5`}>
                                    {status.text}
                                </span>
                                <span className="text-dark-400 text-xs font-mono px-2 py-0.5 rounded bg-black/30 border border-white/5">
                                    {server.node?.name}
                                </span>
                            </div>
                            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight drop-shadow-sm">{server.name}</h1>
                            <p className="text-dark-400 text-sm font-mono flex items-center gap-2 bg-black/20 w-fit px-3 py-1.5 rounded-lg border border-white/5">
                                <span className="w-2 h-2 rounded-full bg-blue-500/50" />
                                <span className="text-white/80">{server.allocation?.ip}</span>
                                <span className="text-dark-600">:</span>
                                <span className="text-blue-400">{server.allocation?.port}</span>
                            </p>
                        </div>
                    </div>

                    {/* Power Controls */}
                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded-xl border border-white/10 backdrop-blur-md shadow-lg">
                        <button
                            onClick={() => powerMutation.mutate('start')}
                            disabled={server.status !== 'OFFLINE' || powerMutation.isPending}
                            className={`
                                p-3 rounded-lg transition-all duration-300 group relative overflow-hidden
                                ${powerMutation.isPending && powerMutation.variables === 'start' ? 'bg-emerald-500/20' : 'hover:bg-emerald-500/10'}
                                ${server.status === 'OFFLINE' ? 'text-emerald-400 opacity-100' : 'text-dark-500 opacity-50'}
                            `}
                            title="Start"
                        >
                            <Play className="w-6 h-6 fill-current" />
                            {server.status === 'OFFLINE' && <div className="absolute inset-0 bg-emerald-400/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />}
                        </button>
                        <button
                            onClick={() => powerMutation.mutate('restart')}
                            disabled={server.status !== 'RUNNING' || powerMutation.isPending}
                            className={`
                                p-3 rounded-lg transition-all duration-300 group relative overflow-hidden
                                ${powerMutation.isPending && powerMutation.variables === 'restart' ? 'bg-amber-500/20' : 'hover:bg-amber-500/10'}
                                ${server.status === 'RUNNING' ? 'text-amber-400 opacity-100' : 'text-dark-500 opacity-50'}
                            `}
                            title="Restart"
                        >
                            <RotateCcw className="w-6 h-6" />
                        </button>
                        <button
                            onClick={() => powerMutation.mutate('stop')}
                            disabled={server.status !== 'RUNNING' || powerMutation.isPending}
                            className={`
                                p-3 rounded-lg transition-all duration-300 group relative overflow-hidden
                                ${powerMutation.isPending && powerMutation.variables === 'stop' ? 'bg-red-500/20' : 'hover:bg-red-500/10'}
                                ${server.status === 'RUNNING' ? 'text-red-400 opacity-100' : 'text-dark-500 opacity-50'}
                            `}
                            title="Stop"
                        >
                            <Square className="w-6 h-6 fill-current" />
                        </button>
                        <div className="w-px h-8 bg-white/10 mx-1" />
                        <button
                            onClick={() => {
                                if (confirm('Are you sure you want to force kill the server?')) {
                                    powerMutation.mutate('kill')
                                }
                            }}
                            disabled={server.status === 'OFFLINE' || powerMutation.isPending}
                            className="p-3 rounded-lg text-red-600 hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 disabled:opacity-30"
                            title="Kill"
                        >
                            <Skull className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Resource Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {[
                    { label: 'CPU Usage', value: `${stats.cpu}%`, icon: Cpu, color: 'text-blue-400', progress: stats.cpu, limit: server.cpu },
                    { label: 'Memory', value: `${stats.memory} MB`, icon: MemoryStick, color: 'text-purple-400', progress: memoryPercent, limit: 100 },
                    { label: 'Disk', value: `${server.disk} MB`, icon: HardDrive, color: 'text-emerald-400', progress: 0, limit: 0, static: true },
                    { label: 'Limit', value: `${server.cpu}%`, icon: Activity, color: 'text-amber-400', progress: 0, limit: 0, static: true }
                ].map((stat, i) => (
                    <div key={i} className="glass-panel p-5 rounded-2xl border border-white/5 relative overflow-hidden group hover:border-white/10 transition-colors">
                        <div className={`absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity ${stat.color}`}>
                            <stat.icon className="w-12 h-12" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-2">
                                <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                <span className="text-xs font-bold text-dark-400 uppercase tracking-widest">{stat.label}</span>
                            </div>
                            <p className="text-2xl font-mono font-bold text-white tracking-tight">{stat.value}</p>
                            {!stat.static && (
                                <div className="mt-3 h-1 bg-black/40 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ease-out ${stat.color.replace('text-', 'bg-')}`}
                                        style={{ width: `${Math.min(stat.progress, 100)}%` }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Navigation Tabs */}
            <div className="sticky top-24 z-20 backdrop-blur-xl bg-black/40 rounded-xl border border-white/5 p-1.5 shadow-xl">
                <div className="flex gap-1 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
                                ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'animate-pulse' : ''}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px] pt-4">
                {activeTab === 'console' && (
                    <ServerConsole
                        lines={consoleLines}
                        command={command}
                        onCommandChange={setCommand}
                        onSendCommand={handleSendCommand}
                        status={server.status}
                        installProgress={installProgress}
                        socketConnected={socketConnected}
                    />
                )}

                {activeTab === 'ai' && (
                    <div className="h-[600px]">
                        <AIChat serverId={id!} serverName={server.name} />
                    </div>
                )}

                {activeTab === 'files' && <FileManager serverId={id!} />}

                {activeTab === 'sftp' && (
                    <div className="max-w-3xl">
                        <SFTPInfo server={server} user={user || undefined} />
                    </div>
                )}

                {activeTab === 'startup' && (
                    <StartupEditor
                        serverId={id!}
                        startup={server.startup}
                        variables={server.variables || []}
                        isOwner={isOwner}
                    />
                )}

                {activeTab === 'players' && <PlayerStats />}
                {activeTab === 'plugins' && <PluginManager />}
                {activeTab === 'databases' && <DatabaseManager />}
                {activeTab === 'backups' && <BackupManager serverId={id!} />}
                {activeTab === 'schedules' && <ScheduleManager serverId={id!} />}
                {activeTab === 'users' && <SubuserManager serverId={id!} isOwner={isOwner} />}

                {activeTab === 'settings' && (
                    <div className="space-y-6 max-w-3xl">
                        <div className="bg-dark-900 border border-dark-700 rounded-sm p-6">
                            <h3 className="text-lg font-medium text-white mb-4">Configuration</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-dark-400 mb-2">Startup Command</label>
                                    <div className="bg-black border border-dark-700 rounded-sm p-3 font-mono text-sm text-dark-300">
                                        {server.startup}
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-2">Environment Variables</label>
                                    <div className="space-y-2">
                                        {server.variables?.map((v: any) => (
                                            <div key={v.id} className="flex gap-2 items-center">
                                                <code className="px-2 py-1 bg-dark-800 rounded-sm text-xs text-white border border-dark-700 font-mono">
                                                    {v.envVariable}
                                                </code>
                                                <span className="text-dark-500">=</span>
                                                <code className="px-2 py-1 bg-dark-800 rounded-sm text-xs text-dark-300 border border-dark-700 font-mono">
                                                    {v.value}
                                                </code>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-red-500/5 border border-red-500/10 rounded-sm p-6">
                            <h3 className="text-lg font-medium text-red-500 mb-2">Danger Zone</h3>
                            <p className="text-sm text-dark-400 mb-4">
                                Permanently delete this server and all associated data. This action cannot be undone.
                            </p>
                            <button
                                onClick={() => {
                                    if (confirm(`Are you sure you want to delete "${server.name}" ? `)) {
                                        deleteMutation.mutate()
                                    }
                                }}
                                disabled={deleteMutation.isPending || server.status === 'RUNNING'}
                                className="btn-danger text-sm px-4 py-2 rounded-sm"
                            >
                                {deleteMutation.isPending ? 'Deleting...' : 'Delete Server'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
