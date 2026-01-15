import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
    Activity,
    HardDrive,
    Wifi,
    AlertTriangle,
    CheckCircle,
    XCircle,
    RefreshCw,
    Server,
    Clock
} from 'lucide-react'
import { nodesApi } from '../../services/api'
import { ResourceGraph } from '../../components/ResourceGraph'

interface NodeHealthData {
    id: string
    name: string
    fqdn: string
    isOnline: boolean
    memory: number
    disk: number
    usage?: {
        memory: number
        disk: number
        cpu: number
        uptime: number
        networkIn?: number
        networkOut?: number
    }
    serverCount: number
    lastChecked?: string
}

export default function NodeHealth() {
    const [selectedNode, setSelectedNode] = useState<string | null>(null)

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['nodes-health'],
        queryFn: nodesApi.list,
        refetchInterval: 10000, // Refresh every 10 seconds
    })

    const nodes: NodeHealthData[] = (data?.nodes || []).map((n: any) => ({
        ...n,
        serverCount: n._count?.servers || 0
    }))

    const selectedNodeData = nodes.find(n => n.id === selectedNode)

    const getHealthStatus = (node: NodeHealthData) => {
        if (!node.isOnline) return { status: 'offline', color: 'text-red-500', icon: XCircle }
        const memoryUsage = node.usage?.memory ? (node.usage.memory / node.memory) * 100 : 0
        const diskUsage = node.usage?.disk ? (node.usage.disk / node.disk) * 100 : 0

        if (memoryUsage > 90 || diskUsage > 90) {
            return { status: 'critical', color: 'text-red-500', icon: AlertTriangle }
        }
        if (memoryUsage > 75 || diskUsage > 75) {
            return { status: 'warning', color: 'text-amber-500', icon: AlertTriangle }
        }
        return { status: 'healthy', color: 'text-emerald-500', icon: CheckCircle }
    }

    const formatUptime = (seconds?: number) => {
        if (!seconds) return 'N/A'
        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const mins = Math.floor((seconds % 3600) / 60)
        if (days > 0) return `${days}d ${hours}h`
        if (hours > 0) return `${hours}h ${mins}m`
        return `${mins}m`
    }

    const formatBytes = (bytes: number) => {
        if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} GB`
        return `${bytes} MB`
    }

    return (
        <div className="max-w-[1600px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-end justify-between border-b border-dark-800 pb-4">
                <div>
                    <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">Node Health</h1>
                    <p className="text-dark-400 text-sm font-mono">Real-time infrastructure monitoring</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => refetch()}
                        className="btn btn-secondary text-xs"
                    >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Refresh
                    </button>
                    <Link to="/nodes" className="btn btn-primary text-xs">
                        Manage Nodes
                    </Link>
                </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <HardDrive className="w-4 h-4 text-dark-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">Total Nodes</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-white">{nodes.length}</p>
                </div>
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">Online</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-emerald-500">
                        {nodes.filter(n => n.isOnline).length}
                    </p>
                </div>
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <Server className="w-4 h-4 text-dark-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">Total Servers</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-white">
                        {nodes.reduce((sum, n) => sum + n.serverCount, 0)}
                    </p>
                </div>
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        <span className="text-[10px] font-medium text-dark-400 uppercase tracking-wider">Alerts</span>
                    </div>
                    <p className="text-2xl font-mono font-semibold text-amber-500">
                        {nodes.filter(n => {
                            const health = getHealthStatus(n)
                            return health.status !== 'healthy'
                        }).length}
                    </p>
                </div>
            </div>

            {/* Node Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Node List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-dark-900 border border-dark-700 rounded-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-dark-700 bg-black/20">
                            <h2 className="text-xs font-medium text-dark-400 uppercase tracking-wider">Nodes</h2>
                        </div>
                        <div className="divide-y divide-dark-800">
                            {isLoading ? (
                                [1, 2, 3].map(i => (
                                    <div key={i} className="p-4">
                                        <div className="h-6 bg-dark-800 rounded animate-pulse" />
                                    </div>
                                ))
                            ) : nodes.length > 0 ? (
                                nodes.map(node => {
                                    const health = getHealthStatus(node)
                                    const StatusIcon = health.icon

                                    return (
                                        <button
                                            key={node.id}
                                            onClick={() => setSelectedNode(node.id === selectedNode ? null : node.id)}
                                            className={`w-full text-left p-4 hover:bg-dark-800/50 transition-colors ${selectedNode === node.id ? 'bg-dark-800' : ''
                                                }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <StatusIcon className={`w-4 h-4 ${health.color}`} />
                                                    <div>
                                                        <p className="text-sm font-medium text-white">{node.name}</p>
                                                        <p className="text-xs text-dark-500 font-mono">{node.fqdn}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-dark-400">{node.serverCount} servers</p>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="p-8 text-center text-dark-500">
                                    No nodes found
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Node Details */}
                <div className="lg:col-span-2">
                    {selectedNodeData ? (
                        <div className="space-y-6">
                            {/* Node Header */}
                            <div className="bg-dark-900 border border-dark-700 rounded-sm p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <div className={`w-2 h-2 rounded-full ${selectedNodeData.isOnline ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                            <h2 className="text-xl font-semibold text-white">{selectedNodeData.name}</h2>
                                        </div>
                                        <p className="text-dark-400 text-sm font-mono">{selectedNodeData.fqdn}</p>
                                    </div>
                                    <div className="flex items-center gap-2 text-dark-500">
                                        <Clock className="w-4 h-4" />
                                        <span className="text-xs font-mono">
                                            Uptime: {formatUptime(selectedNodeData.usage?.uptime)}
                                        </span>
                                    </div>
                                </div>

                                {/* Resource Stats */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">CPU</p>
                                        <p className="text-xl font-mono text-white">
                                            {selectedNodeData.usage?.cpu?.toFixed(1) || 0}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Memory</p>
                                        <p className="text-xl font-mono text-white">
                                            {formatBytes(selectedNodeData.usage?.memory || 0)} / {formatBytes(selectedNodeData.memory)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Disk</p>
                                        <p className="text-xl font-mono text-white">
                                            {formatBytes(selectedNodeData.usage?.disk || 0)} / {formatBytes(selectedNodeData.disk)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Servers</p>
                                        <p className="text-xl font-mono text-white">{selectedNodeData.serverCount}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Resource Graphs */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <ResourceGraph
                                    title="CPU Usage"
                                    unit="%"
                                    color="#10b981"
                                    maxValue={100}
                                    realTimeValue={selectedNodeData.usage?.cpu || 0}
                                />
                                <ResourceGraph
                                    title="Memory Usage"
                                    unit=" MB"
                                    color="#6366f1"
                                    maxValue={selectedNodeData.memory}
                                    realTimeValue={selectedNodeData.usage?.memory || 0}
                                />
                            </div>

                            {/* Network Stats */}
                            <div className="bg-dark-900 border border-dark-700 rounded-sm p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Wifi className="w-4 h-4 text-dark-500" />
                                    <span className="text-xs font-medium text-dark-400 uppercase tracking-wider">Network</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Inbound</p>
                                        <p className="text-lg font-mono text-white">
                                            {selectedNodeData.usage?.networkIn?.toFixed(1) || 0} KB/s
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-dark-500 uppercase tracking-wider mb-1">Outbound</p>
                                        <p className="text-lg font-mono text-white">
                                            {selectedNodeData.usage?.networkOut?.toFixed(1) || 0} KB/s
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-dark-900 border border-dark-700 rounded-sm p-12 text-center">
                            <Activity className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                            <p className="text-white font-medium mb-1">Select a node</p>
                            <p className="text-dark-500 text-sm">Click on a node to view detailed health metrics</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
