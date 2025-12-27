import { useState, useEffect } from 'react'
import {
    Activity,
    Cpu,
    MemoryStick,
    HardDrive,
    Server,
    AlertTriangle,
    TrendingUp
} from 'lucide-react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area
} from 'recharts'
import { socketService } from '../services/socket'

interface NodeStats {
    cpu: number
    memory: { used: number; total: number; percentage: number }
    disk: { used: number; total: number; percentage: number }
    uptime: number
    loadAvg: number[]
}

interface ResourceMonitorProps {
    nodeId: string
    nodeName: string
}

interface ChartData {
    time: string
    cpu: number
    memory: number
    disk: number
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h ${minutes} m`
    if (hours > 0) return `${hours}h ${minutes} m`
    return `${minutes} m`
}

function StatCard({
    icon: Icon,
    label,
    value,
    percentage,
    color = 'primary'
}: {
    icon: React.ElementType
    label: string
    value: string
    percentage?: number
    color?: 'primary' | 'green' | 'yellow' | 'red'
}) {
    const colorClasses = {
        primary: 'text-primary-400',
        green: 'text-green-400',
        yellow: 'text-yellow-400',
        red: 'text-red-400',
    }

    const getPercentageColor = (pct?: number) => {
        if (!pct) return 'bg-primary-500'
        if (pct >= 90) return 'bg-red-500'
        if (pct >= 75) return 'bg-yellow-500'
        return 'bg-green-500'
    }

    return (
        <div className="card">
            <div className="flex items-center gap-3 mb-3">
                <Icon className={`w - 5 h - 5 ${colorClasses[color]} `} />
                <span className="text-dark-400 text-sm">{label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{value}</p>
            {percentage !== undefined && (
                <div className="mt-2">
                    <div className="flex justify-between text-xs text-dark-400 mb-1">
                        <span>Usage</span>
                        <span>{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                        <div
                            className={`h - full ${getPercentageColor(percentage)} rounded - full transition - all duration - 500`}
                            style={{ width: `${Math.min(percentage, 100)}% ` }}
                        />
                    </div>
                </div>
            )}
        </div>
    )
}

export default function ResourceMonitor({ nodeId, nodeName }: ResourceMonitorProps) {
    const [stats, setStats] = useState<NodeStats | null>(null)
    const [chartData, setChartData] = useState<ChartData[]>([])
    const [connected] = useState(false)

    useEffect(() => {
        socketService.subscribeToNode(nodeId)

        const updateStats = (data: any) => {
            if (data.nodeId === nodeId) {
                const newStats: NodeStats = {
                    cpu: data.cpu || 0,
                    memory: data.memory || { used: 0, total: 1, percentage: 0 },
                    disk: data.disk || { used: 0, total: 1, percentage: 0 },
                    uptime: data.uptime || 0,
                    loadAvg: data.loadAvg || [0, 0, 0],
                }
                setStats(newStats)

                // Add to chart data
                const time = new Date().toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit'
                })

                setChartData(prev => [
                    ...prev.slice(-29), // Keep last 30 data points
                    {
                        time,
                        cpu: newStats.cpu,
                        memory: newStats.memory.percentage,
                        disk: newStats.disk.percentage,
                    }
                ])
            }
        }

        const unsubscribe = socketService.onNodeStats(updateStats)

        // Mock data for demo
        const interval = setInterval(() => {
            const mockStats: NodeStats = {
                cpu: 15 + Math.random() * 30,
                memory: {
                    used: 4000000000 + Math.random() * 2000000000,
                    total: 16000000000,
                    percentage: 25 + Math.random() * 20,
                },
                disk: {
                    used: 50000000000 + Math.random() * 10000000000,
                    total: 256000000000,
                    percentage: 20 + Math.random() * 5,
                },
                uptime: 86400 * 7 + Math.random() * 86400,
                loadAvg: [0.5 + Math.random(), 0.7 + Math.random(), 0.8 + Math.random()],
            }

            setStats(mockStats)

            const time = new Date().toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit'
            })

            setChartData(prev => [
                ...prev.slice(-29),
                {
                    time,
                    cpu: mockStats.cpu,
                    memory: mockStats.memory.percentage,
                    disk: mockStats.disk.percentage,
                }
            ])
        }, 5000)

        return () => {
            clearInterval(interval)
            socketService.unsubscribeFromNode(nodeId)
            unsubscribe()
        }
    }, [nodeId])

    if (!stats) {
        return (
            <div className="card text-center py-12">
                <Activity className="w-12 h-12 mx-auto text-dark-500 animate-pulse mb-4" />
                <p className="text-dark-400">Connecting to node...</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Server className="w-6 h-6 text-primary-400" />
                    <div>
                        <h2 className="text-xl font-bold text-white">{nodeName}</h2>
                        <p className="text-sm text-dark-400">Uptime: {formatUptime(stats.uptime)}</p>
                    </div>
                </div>
                <div className={`flex items - center gap - 2 px - 3 py - 1 rounded - full ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    } `}>
                    <div className={`w - 2 h - 2 rounded - full ${connected ? 'bg-green-400' : 'bg-red-400'} `} />
                    {connected ? 'Online' : 'Offline'}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={Cpu}
                    label="CPU Usage"
                    value={`${stats.cpu.toFixed(1)}% `}
                    percentage={stats.cpu}
                    color={stats.cpu > 80 ? 'red' : stats.cpu > 60 ? 'yellow' : 'green'}
                />
                <StatCard
                    icon={MemoryStick}
                    label="Memory"
                    value={formatBytes(stats.memory.used)}
                    percentage={stats.memory.percentage}
                    color={stats.memory.percentage > 80 ? 'red' : stats.memory.percentage > 60 ? 'yellow' : 'green'}
                />
                <StatCard
                    icon={HardDrive}
                    label="Disk"
                    value={formatBytes(stats.disk.used)}
                    percentage={stats.disk.percentage}
                    color={stats.disk.percentage > 80 ? 'red' : stats.disk.percentage > 60 ? 'yellow' : 'green'}
                />
                <StatCard
                    icon={TrendingUp}
                    label="Load Avg"
                    value={stats.loadAvg.map(l => l.toFixed(2)).join(' / ')}
                    color="primary"
                />
            </div>

            {/* CPU Chart */}
            <div className="card">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-white">CPU Usage Over Time</h3>
                    <span className="text-sm text-dark-400">Last 30 readings</span>
                </div>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis
                                dataKey="time"
                                stroke="#475569"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <YAxis
                                stroke="#475569"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                domain={[0, 100]}
                                tickFormatter={(v) => `${v}% `}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(15, 23, 42, 0.9)',
                                    border: '1px solid rgba(99, 102, 241, 0.2)',
                                    borderRadius: '8px',
                                }}
                                labelStyle={{ color: '#fff' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="cpu"
                                stroke="#6366f1"
                                strokeWidth={2}
                                fill="url(#cpuGradient)"
                                name="CPU %"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Memory & Disk Charts */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="card">
                    <h3 className="font-semibold text-white mb-4">Memory Usage</h3>
                    <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(34, 197, 94, 0.2)',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Line type="monotone" dataKey="memory" stroke="#22c55e" strokeWidth={2} dot={false} name="Memory %" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="card">
                    <h3 className="font-semibold text-white mb-4">Disk Usage</h3>
                    <div className="h-36">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <XAxis dataKey="time" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#475569" fontSize={10} domain={[0, 100]} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{
                                        background: 'rgba(15, 23, 42, 0.9)',
                                        border: '1px solid rgba(251, 191, 36, 0.2)',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Line type="monotone" dataKey="disk" stroke="#fbbf24" strokeWidth={2} dot={false} name="Disk %" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Alerts */}
            {(stats.cpu > 80 || stats.memory.percentage > 80 || stats.disk.percentage > 80) && (
                <div className="card border-yellow-500/30 bg-yellow-500/5">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        <div>
                            <p className="font-medium text-yellow-400">Resource Warning</p>
                            <p className="text-sm text-dark-400">
                                {stats.cpu > 80 && 'High CPU usage. '}
                                {stats.memory.percentage > 80 && 'High memory usage. '}
                                {stats.disk.percentage > 80 && 'Low disk space. '}
                                Consider scaling resources.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
