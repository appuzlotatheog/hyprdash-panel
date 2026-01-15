import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
    Server,
    HardDrive,
    Users,
    Activity,
    ArrowRight,
    MemoryStick,
    RefreshCw,
    Play,
    Square,
    Archive
} from 'lucide-react'
import { serversApi, nodesApi, usersApi, auditApi } from '../services/api'
import { useAuthStore } from '../stores/auth'
import { socketService } from '../services/socket'
import { ResourceGraph } from '../components/ResourceGraph'
import { ActivityFeed } from '../components/ActivityFeed'

// Minimalist Stat Card
function StatCard({
    title,
    value,
    subValue,
    icon: Icon,
    link,
    trend,
    className = ''
}: {
    title: string
    value: number | string
    subValue?: string
    icon: React.ElementType
    link?: string
    trend?: 'up' | 'down' | 'neutral'
    className?: string
}) {
    const Card = link ? Link : 'div'
    const trendColors = {
        up: 'text-emerald-500',
        down: 'text-red-400',
        neutral: 'text-dark-400'
    }

    return (
        <Card
            to={link || '#'}
            className={`group relative overflow-hidden bg-dark-900 border border-dark-700 rounded-sm p-5 hover:border-dark-600 transition-all duration-200 ${className}`}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-dark-400 text-xs font-medium uppercase tracking-wider mb-1">{title}</p>
                    <p className="text-2xl font-mono font-semibold text-white tracking-tight group-hover:text-accent transition-colors duration-200">{value}</p>
                    {subValue && (
                        <p className={`text-xs font-mono mt-1 ${trend ? trendColors[trend] : 'text-dark-500'}`}>
                            {trend === 'up' && '↑ '}
                            {trend === 'down' && '↓ '}
                            {subValue}
                        </p>
                    )}
                </div>
                <Icon className="w-5 h-5 text-dark-600 group-hover:text-white transition-colors duration-200" />
            </div>
        </Card>
    )
}

// Minimalist Server Row
function ServerRow({ server }: { server: any }) {
    const statusColor = {
        RUNNING: 'bg-emerald-500',
        OFFLINE: 'bg-dark-600',
        STARTING: 'bg-amber-500',
        STOPPING: 'bg-orange-500',
    }[server.status as string] || 'bg-dark-600'

    return (
        <Link
            to={`/servers/${server.id}`}
            className="group flex items-center gap-4 py-3 px-4 rounded-sm hover:bg-dark-800 transition-all duration-200 border border-transparent hover:border-dark-700"
        >
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />

            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate group-hover:text-accent transition-colors">{server.name}</p>
                <p className="text-xs text-dark-400 truncate font-mono">
                    {server.allocation?.ip}:{server.allocation?.port}
                </p>
            </div>

            <div className="text-right hidden sm:block">
                <div className="flex items-center gap-2 justify-end text-dark-400">
                    <MemoryStick className="w-3 h-3" />
                    <p className="text-xs font-mono">{server.memory} MB</p>
                </div>
            </div>

            <ArrowRight className="w-4 h-4 text-dark-700 group-hover:text-white transition-colors duration-200" />
        </Link>
    )
}

// Minimalist Node Card
function NodeCard({ node }: { node: any }) {
    const memoryPercent = node.memory > 0 ? ((node.usage?.memory || 0) / node.memory) * 100 : 0
    const diskPercent = node.disk > 0 ? ((node.usage?.disk || 0) / node.disk) * 100 : 0

    return (
        <div className="p-4 rounded-sm border border-dark-700 bg-dark-900 hover:border-dark-600 transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${node.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium text-white">{node.name}</span>
                </div>
                <span className="text-xs text-dark-500 font-mono">{node.fqdn}</span>
            </div>

            <div className="space-y-3">
                <div>
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-dark-400 uppercase tracking-wider text-[10px]">Memory</span>
                        <span className="text-dark-300 font-mono">{Math.round(memoryPercent)}%</span>
                    </div>
                    <div className="h-0.5 bg-dark-800 w-full">
                        <div className="h-full bg-accent transition-all duration-500" style={{ width: `${memoryPercent}%` }} />
                    </div>
                </div>
                <div>
                    <div className="flex justify-between text-xs mb-1.5">
                        <span className="text-dark-400 uppercase tracking-wider text-[10px]">Disk</span>
                        <span className="text-dark-300 font-mono">{Math.round(diskPercent)}%</span>
                    </div>
                    <div className="h-0.5 bg-dark-800 w-full">
                        <div className="h-full bg-white transition-all duration-500" style={{ width: `${diskPercent}%` }} />
                    </div>
                </div>
            </div>
        </div>
    )
}

// Quick Action Button
function QuickAction({
    icon: Icon,
    label,
    onClick,
    disabled,
    variant = 'default'
}: {
    icon: React.ElementType
    label: string
    onClick?: () => void
    disabled?: boolean
    variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
    const variants = {
        default: 'bg-dark-800 hover:bg-dark-700 text-white',
        success: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500',
        warning: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-500',
        danger: 'bg-red-500/10 hover:bg-red-500/20 text-red-500',
    }

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-medium transition-all border border-dark-700 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]}`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    )
}

export default function Dashboard() {
    const user = useAuthStore((state) => state.user)
    const isAdmin = user?.role === 'ADMIN'

    // Aggregate stats from socket updates
    const [aggregateCpu, setAggregateCpu] = useState(0)
    const [networkIn, setNetworkIn] = useState(0)
    const [networkOut, setNetworkOut] = useState(0)

    const { data: serversData, isLoading: loadingServers, refetch: refetchServers } = useQuery({
        queryKey: ['servers'],
        queryFn: serversApi.list,
    })

    const { data: nodesData, isLoading: loadingNodes } = useQuery({
        queryKey: ['nodes'],
        queryFn: nodesApi.list,
        enabled: isAdmin,
    })

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.list,
        enabled: isAdmin,
    })

    const { data: auditData } = useQuery({
        queryKey: ['audit-logs', 10],
        queryFn: () => auditApi.list(10),
        enabled: isAdmin,
        refetchInterval: 30000, // Refresh every 30 seconds
    })

    const servers = serversData?.servers || []
    const nodes = nodesData?.nodes || []
    const users = usersData?.users || []
    const activities = auditData?.logs || []

    const runningServers = servers.filter(s => s.status === 'RUNNING').length
    const onlineNodes = nodes.filter(n => n.isOnline).length

    // Calculate total resources
    const totalMemory = nodes.reduce((sum, n) => sum + n.memory, 0)
    const usedMemory = nodes.reduce((sum, n) => sum + (n.usage?.memory || 0), 0)
    const totalDisk = nodes.reduce((sum, n) => sum + n.disk, 0)
    const usedDisk = nodes.reduce((sum, n) => sum + (n.usage?.disk || 0), 0)

    // Subscribe to node stats for real-time graphs
    useEffect(() => {
        const handleNodeStats = (data: any) => {
            setAggregateCpu(prev => {
                // Simple average (in production you'd track per-node)
                return (prev + data.cpu) / 2
            })
            setNetworkIn(data.networkIn || 0)
            setNetworkOut(data.networkOut || 0)
        }

        const unsubscribe = socketService.onNodeStats?.(handleNodeStats) || (() => { })

        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe()
            }
        }
    }, [])

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-end justify-between border-b border-dark-800 pb-4">
                <div>
                    <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">Dashboard</h1>
                    <p className="text-dark-400 text-sm font-mono">System Overview :: {new Date().toLocaleDateString()}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => refetchServers()}
                        className="btn btn-secondary text-xs"
                    >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh
                    </button>
                    {isAdmin && (
                        <Link to="/servers/create" className="btn btn-primary text-xs uppercase tracking-wider">
                            Deploy Server
                        </Link>
                    )}
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                <StatCard
                    title="Total Servers"
                    value={servers.length}
                    subValue={`${runningServers} running`}
                    icon={Server}
                    link="/servers"
                    trend={runningServers > 0 ? 'up' : 'neutral'}
                />
                <StatCard
                    title="Active Servers"
                    value={runningServers}
                    icon={Play}
                />
                {isAdmin && (
                    <>
                        <StatCard
                            title="Nodes Online"
                            value={`${onlineNodes}/${nodes.length}`}
                            subValue={onlineNodes === nodes.length ? 'All healthy' : `${nodes.length - onlineNodes} offline`}
                            icon={HardDrive}
                            link="/nodes"
                            trend={onlineNodes === nodes.length ? 'up' : 'down'}
                        />
                        <StatCard
                            title="Total Users"
                            value={users.length}
                            icon={Users}
                            link="/users"
                        />
                        <StatCard
                            title="Memory Usage"
                            value={`${Math.round((usedMemory / totalMemory) * 100) || 0}%`}
                            subValue={`${Math.round(usedMemory / 1024)} / ${Math.round(totalMemory / 1024)} GB`}
                            icon={MemoryStick}
                            trend={usedMemory / totalMemory > 0.8 ? 'down' : 'up'}
                        />
                        <StatCard
                            title="Disk Usage"
                            value={`${Math.round((usedDisk / totalDisk) * 100) || 0}%`}
                            subValue={`${Math.round(usedDisk / 1024)} / ${Math.round(totalDisk / 1024)} GB`}
                            icon={Archive}
                            trend={usedDisk / totalDisk > 0.8 ? 'down' : 'up'}
                        />
                    </>
                )}
            </div>

            {/* Quick Actions (Admin Only) */}
            {isAdmin && (
                <div className="flex flex-wrap gap-2">
                    <QuickAction icon={Play} label="Start All Servers" variant="success" disabled />
                    <QuickAction icon={Square} label="Stop All Servers" variant="danger" disabled />
                    <QuickAction icon={RefreshCw} label="Restart All Servers" variant="warning" disabled />
                    <QuickAction icon={Archive} label="Backup All Servers" />
                </div>
            )}

            {/* Resource Graphs (Admin Only) */}
            {isAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <ResourceGraph
                        title="Aggregate CPU Usage"
                        unit="%"
                        color="#10b981"
                        maxValue={100}
                        realTimeValue={aggregateCpu}
                    />
                    <ResourceGraph
                        title="Network I/O"
                        unit=" KB/s"
                        color="#6366f1"
                        maxValue={1000}
                        realTimeValue={networkIn + networkOut}
                    />
                </div>
            )}

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Server List - Takes 2 columns */}
                <div className={`${isAdmin ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
                    <div className="bg-dark-900 border border-dark-700 rounded-sm overflow-hidden min-h-[400px]">
                        <div className="px-6 py-4 border-b border-dark-700 flex justify-between items-center bg-black/20">
                            <h2 className="text-xs font-medium text-dark-400 uppercase tracking-wider">Active Deployments</h2>
                            <Link to="/servers" className="text-xs text-accent hover:text-white transition-colors font-mono">
                                VIEW_ALL →
                            </Link>
                        </div>

                        {loadingServers ? (
                            <div className="p-4 space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-12 bg-dark-800 rounded-sm animate-pulse" />
                                ))}
                            </div>
                        ) : servers.length > 0 ? (
                            <div className="divide-y divide-dark-800">
                                {servers.slice(0, 8).map(server => (
                                    <ServerRow key={server.id} server={server} />
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center flex flex-col items-center justify-center h-64">
                                <div className="w-12 h-12 rounded-full bg-dark-800 flex items-center justify-center mb-4 border border-dark-700">
                                    <Server className="w-6 h-6 text-dark-500" />
                                </div>
                                <p className="text-white font-medium mb-1">No servers deployed</p>
                                <p className="text-dark-400 text-sm mb-4 max-w-xs mx-auto">
                                    Get started by deploying your first game server instance.
                                </p>
                                <Link to="/servers/create" className="btn btn-secondary text-xs">
                                    Create Instance
                                </Link>
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar (Admin Only) */}
                {isAdmin && (
                    <div className="space-y-6">
                        {/* Node Health */}
                        <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xs font-medium text-dark-400 uppercase tracking-wider">System Health</h2>
                                <Activity className="w-4 h-4 text-dark-500" />
                            </div>
                            <div className="space-y-3">
                                {loadingNodes ? (
                                    [1, 2].map(i => (
                                        <div key={i} className="h-24 bg-dark-800 rounded-sm animate-pulse" />
                                    ))
                                ) : nodes.length > 0 ? (
                                    nodes.slice(0, 3).map(node => (
                                        <NodeCard key={node.id} node={node} />
                                    ))
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-dark-400 text-xs font-mono">NO_NODES_FOUND</p>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4 pt-3 border-t border-dark-800">
                                <Link to="/nodes" className="block text-center text-xs text-dark-400 hover:text-white transition-colors font-mono">
                                    MANAGE_NODES
                                </Link>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <ActivityFeed activities={activities} limit={8} />
                    </div>
                )}
            </div>
        </div>
    )
}
