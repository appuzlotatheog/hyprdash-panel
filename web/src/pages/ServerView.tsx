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
    Sparkles
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
import AIChat from '../components/AIChat'

const tabs = [
    { id: 'console', label: 'Console', icon: Terminal },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'files', label: 'Files', icon: FileText },
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

        const unsubStatus = socketService.onServerStatus((data) => {
            if (data.serverId === id) {
                queryClient.setQueryData(['server', id], (old: any) => ({
                    ...old,
                    server: { ...old?.server, status: data.status },
                }))
            }
        })

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
            unsubStatus()
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
            <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-end border-b border-dark-800 pb-6">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-2 h-2 rounded-full ${status.color} shadow-[0_0_10px_rgba(0,0,0,0.5)]`} />
                        <span className={`text-xs font-mono font-medium uppercase tracking-wider ${status.textClass}`}>{status.text}</span>
                    </div>
                    <h1 className="text-3xl font-semibold text-white mb-1 tracking-tight">{server.name}</h1>
                    <p className="text-dark-400 text-sm font-mono flex items-center gap-2">
                        <span className="text-accent">{server.node?.name}</span>
                        <span className="text-dark-700">/</span>
                        {server.allocation?.ip}:{server.allocation?.port}
                    </p>
                </div>

                {/* Power Controls */}
                <div className="flex items-center gap-1 bg-dark-900 p-1 rounded-sm border border-dark-700">
                    <button
                        onClick={() => powerMutation.mutate('start')}
                        disabled={server.status !== 'OFFLINE' || powerMutation.isPending}
                        className={`
                            p-2.5 rounded-sm hover:bg-dark-800 text-emerald-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-200 border border-transparent hover:border-dark-700
                            ${powerMutation.isPending && powerMutation.variables === 'start' ? 'animate-pulse bg-dark-800' : ''}
                        `}
                        title="Start"
                    >
                        <Play className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => powerMutation.mutate('restart')}
                        disabled={server.status !== 'RUNNING' || powerMutation.isPending}
                        className={`
                            p-2.5 rounded-sm hover:bg-dark-800 text-amber-500 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-200 border border-transparent hover:border-dark-700
                            ${powerMutation.isPending && powerMutation.variables === 'restart' ? 'animate-pulse bg-dark-800' : ''}
                        `}
                        title="Restart"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => powerMutation.mutate('stop')}
                        disabled={server.status !== 'RUNNING' || powerMutation.isPending}
                        className={`
                            p-2.5 rounded-sm hover:bg-dark-800 text-red-400 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-200 border border-transparent hover:border-dark-700
                            ${powerMutation.isPending && powerMutation.variables === 'stop' ? 'animate-pulse bg-dark-800' : ''}
                        `}
                        title="Stop"
                    >
                        <Square className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-dark-700 mx-1" />
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to force kill the server?')) {
                                powerMutation.mutate('kill')
                            }
                        }}
                        disabled={server.status === 'OFFLINE' || powerMutation.isPending}
                        className={`
                            p-2.5 rounded-sm hover:bg-red-950/30 text-red-600 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-200 border border-transparent hover:border-red-900/30
                            ${powerMutation.isPending && powerMutation.variables === 'kill' ? 'animate-pulse bg-red-950/30' : ''}
                        `}
                        title="Kill"
                    >
                        <Skull className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Resource Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <Cpu className="w-4 h-4 text-dark-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">CPU Usage</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-white">{stats.cpu}%</p>
                    <div className="mt-3 h-0.5 bg-dark-800 w-full">
                        <div className="h-full bg-accent transition-all duration-300" style={{ width: `${Math.min(stats.cpu, 100)}% ` }} />
                    </div>
                </div>
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <MemoryStick className="w-4 h-4 text-dark-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">Memory</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-white">{stats.memory} MB</p>
                    <div className="mt-3 h-0.5 bg-dark-800 w-full">
                        <div className="h-full bg-white transition-all duration-300" style={{ width: `${Math.min(memoryPercent, 100)}% ` }} />
                    </div>
                </div>
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <HardDrive className="w-4 h-4 text-dark-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">Disk Limit</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-white">{server.disk} MB</p>
                </div>
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-3">
                        <Activity className="w-4 h-4 text-dark-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">CPU Limit</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-white">{server.cpu}%</p>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-dark-700">
                <div className="flex gap-1 overflow-x-auto">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all duration-200 border-b-2
                                ${activeTab === tab.id
                                    ? 'text-white border-accent bg-dark-900'
                                    : 'text-dark-400 border-transparent hover:text-dark-200 hover:bg-dark-900/50'
                                }
                            `}
                        >
                            <tab.icon className="w-4 h-4" />
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
                    />
                )}

                {activeTab === 'ai' && (
                    <div className="h-[600px]">
                        <AIChat serverId={id!} serverName={server.name} />
                    </div>
                )}

                {activeTab === 'files' && <FileManager serverId={id!} />}
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
