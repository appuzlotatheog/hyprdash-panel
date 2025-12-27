import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
    Plus,
    Search,
    Server as ServerIcon,
    Play,
    Square,
    RotateCcw,
    Globe,
    MemoryStick
} from 'lucide-react'
import { toast } from 'sonner'
import { serversApi } from '../services/api'
import { useAuthStore } from '../stores/auth'

const statusConfig = {
    RUNNING: {
        color: 'bg-emerald-500',
        glow: 'shadow-emerald-500/50',
        text: 'Running',
        textColor: 'text-emerald-400',
        bgColor: 'bg-emerald-500/10',
        pulse: true
    },
    OFFLINE: {
        color: 'bg-gray-500',
        glow: '',
        text: 'Offline',
        textColor: 'text-gray-400',
        bgColor: 'bg-gray-500/10',
        pulse: false
    },
    STARTING: {
        color: 'bg-amber-500',
        glow: 'shadow-amber-500/50',
        text: 'Starting...',
        textColor: 'text-amber-400',
        bgColor: 'bg-amber-500/10',
        pulse: true
    },
    STOPPING: {
        color: 'bg-orange-500',
        glow: 'shadow-orange-500/50',
        text: 'Stopping...',
        textColor: 'text-orange-400',
        bgColor: 'bg-orange-500/10',
        pulse: true
    },
}

function ServerCard({ server, index, onPower, isPending }: {
    server: any
    index: number
    onPower: (id: string, action: 'start' | 'stop' | 'restart' | 'kill') => void
    isPending: boolean
}) {
    const status = statusConfig[server.status as keyof typeof statusConfig] || statusConfig.OFFLINE

    return (
        <div
            className="card-interactive group"
            style={{ animationDelay: `${index * 0.05}s` }}
        >
            <Link to={`/servers/${server.id}`} className="block">
                {/* Status badge and name */}
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                        {/* Status dot with pulse */}
                        <div className="relative">
                            <div className={`w-3 h-3 rounded-full ${status.color} ${status.glow} shadow-lg`} />
                            {status.pulse && (
                                <div className={`absolute inset-0 w-3 h-3 rounded-full ${status.color} animate-ping opacity-75`} />
                            )}
                        </div>
                        <div>
                            <h3 className="font-bold text-white group-hover:text-indigo-400 transition-colors text-lg">
                                {server.name}
                            </h3>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.bgColor} ${status.textColor}`}>
                                {status.text}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Server details */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Address
                        </span>
                        <span className="text-gray-300 font-mono text-xs bg-white/5 px-2 py-1 rounded">
                            {server.allocation ? `${server.allocation.ip}:${server.allocation.port}` : 'N/A'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-2">
                            <ServerIcon className="w-4 h-4" />
                            Node
                        </span>
                        <span className="text-gray-300">{server.node?.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 flex items-center gap-2">
                            <MemoryStick className="w-4 h-4" />
                            Memory
                        </span>
                        <span className="text-gray-300">{server.memory} MB</span>
                    </div>
                </div>
            </Link>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-5 pt-4 border-t border-white/5">
                {server.status === 'OFFLINE' ? (
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            onPower(server.id, 'start')
                            toast.success('Starting server...')
                        }}
                        className="flex-1 btn-success flex items-center justify-center gap-2 py-2.5 text-sm"
                        disabled={isPending}
                    >
                        <Play className="w-4 h-4" />
                        Start
                    </button>
                ) : server.status === 'RUNNING' ? (
                    <>
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                onPower(server.id, 'restart')
                                toast.info('Restarting server...')
                            }}
                            className="flex-1 btn-secondary flex items-center justify-center gap-2 py-2.5 text-sm"
                            disabled={isPending}
                        >
                            <RotateCcw className="w-4 h-4" />
                            Restart
                        </button>
                        <button
                            onClick={(e) => {
                                e.preventDefault()
                                onPower(server.id, 'stop')
                                toast.info('Stopping server...')
                            }}
                            className="flex-1 btn-danger flex items-center justify-center gap-2 py-2.5 text-sm"
                            disabled={isPending}
                        >
                            <Square className="w-4 h-4" />
                            Stop
                        </button>
                    </>
                ) : (
                    <button className="flex-1 btn-secondary py-2.5 text-sm opacity-50 cursor-not-allowed" disabled>
                        {server.status === 'STARTING' ? 'Starting...' : 'Stopping...'}
                    </button>
                )}
            </div>
        </div>
    )
}

export default function Servers() {
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState<'all' | 'running' | 'offline'>('all')
    const queryClient = useQueryClient()
    const user = useAuthStore((state) => state.user)
    const isAdmin = user?.role === 'ADMIN'

    const { data, isLoading } = useQuery({
        queryKey: ['servers'],
        queryFn: serversApi.list,
    })

    const powerMutation = useMutation({
        mutationFn: ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' | 'kill' }) =>
            serversApi.power(id, action),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['servers'] })
        },
        onError: (error: any) => {
            toast.error(error.message || 'Power action failed')
        },
    })

    const allServers = data?.servers || []
    const servers = allServers
        .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
        .filter(s => {
            if (filter === 'running') return s.status === 'RUNNING'
            if (filter === 'offline') return s.status === 'OFFLINE'
            return true
        })

    const runningCount = allServers.filter(s => s.status === 'RUNNING').length
    const offlineCount = allServers.filter(s => s.status === 'OFFLINE').length

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center animate-blur-in">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20">
                            <ServerIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <span className="text-sm font-medium text-indigo-400 tracking-wide uppercase">Server Management</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white">Your Servers</h1>
                    <p className="text-gray-400 mt-1">Manage and monitor your game servers</p>
                </div>
                {isAdmin && (
                    <Link
                        to="/servers/create"
                        className="btn-primary flex items-center gap-2 animate-pulse-glow"
                    >
                        <Plus className="w-5 h-5" />
                        Create Server
                    </Link>
                )}
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search servers..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="input w-full pl-12"
                    />
                </div>

                {/* Filter pills */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'all'
                            ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                            }`}
                    >
                        All ({allServers.length})
                    </button>
                    <button
                        onClick={() => setFilter('running')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'running'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                            }`}
                    >
                        Running ({runningCount})
                    </button>
                    <button
                        onClick={() => setFilter('offline')}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === 'offline'
                            ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                            : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                            }`}
                    >
                        Offline ({offlineCount})
                    </button>
                </div>
            </div>

            {/* Server Grid */}
            {isLoading ? (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="card space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-3 rounded-full skeleton" />
                                <div className="h-5 w-32 skeleton" />
                            </div>
                            <div className="space-y-3">
                                <div className="h-4 w-full skeleton" />
                                <div className="h-4 w-3/4 skeleton" />
                                <div className="h-4 w-1/2 skeleton" />
                            </div>
                            <div className="h-10 w-full skeleton" />
                        </div>
                    ))}
                </div>
            ) : servers.length === 0 ? (
                <div className="card text-center py-16 animate-fade-in-up">
                    <div className="relative inline-block mb-4">
                        <ServerIcon className="w-16 h-16 text-gray-600" />
                        <div className="absolute inset-0 w-16 h-16 bg-indigo-500/20 rounded-full blur-xl" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                        {search || filter !== 'all' ? 'No servers found' : 'No servers yet'}
                    </h3>
                    <p className="text-gray-400 mb-6 max-w-md mx-auto">
                        {search ? 'Try a different search term' :
                            filter !== 'all' ? 'No servers match this filter' :
                                'Get started by creating your first game server'}
                    </p>
                    {isAdmin && !search && filter === 'all' && (
                        <Link to="/servers/create" className="btn-primary inline-flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            Create Server
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                    {servers.map((server, index) => (
                        <ServerCard
                            key={server.id}
                            server={server}
                            index={index}
                            onPower={(id, action) => powerMutation.mutate({ id, action })}
                            isPending={powerMutation.isPending}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
