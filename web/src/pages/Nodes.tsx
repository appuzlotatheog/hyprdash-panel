import { useState, useEffect } from 'react'
import { getSocket } from '../services/socket'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    HardDrive,
    Server,
    Trash2,
    Key,
    Copy,
    Check,
    Network
} from 'lucide-react'
import { toast } from 'sonner'
import { nodesApi } from '../services/api'

interface Node {
    id: string
    name: string
    fqdn: string
    port: number
    scheme: string
    memory: number
    disk: number
    token: string
    isOnline: boolean
    allocations?: { id: string; ip: string; port: number; serverId: string | null }[]
    usage?: { memory: number; disk: number }
    _count?: { servers: number; allocations: number }
}

export default function Nodes() {
    const [showCreate, setShowCreate] = useState(false)
    const [showSetup, setShowSetup] = useState<Node | null>(null)
    const [showAllocations, setShowAllocations] = useState<Node | null>(null)
    const [copied, setCopied] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        fqdn: 'localhost',
        port: 8080,
        scheme: 'http',
        memory: 4096,
        disk: 51200,
    })
    const [allocFormData, setAllocFormData] = useState({
        ip: '0.0.0.0',
        portStart: 25565,
        portEnd: 25570,
    })
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['nodes'],
        queryFn: nodesApi.list,
    })

    const createMutation = useMutation({
        mutationFn: nodesApi.create,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['nodes'] })
            setShowCreate(false)
            setFormData({ name: '', fqdn: 'localhost', port: 8080, scheme: 'http', memory: 4096, disk: 51200 })
            setShowSetup(data.node)
            toast.success('Node created!')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create node')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: nodesApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['nodes'] })
            toast.success('Node deleted')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to delete node')
        },
    })

    const addAllocationsMutation = useMutation({
        mutationFn: ({ nodeId, data }: { nodeId: string; data: typeof allocFormData }) =>
            nodesApi.addAllocations(nodeId, data),
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ['nodes'] })
            toast.success(`Added ${result.count} port allocations`)
            setShowAllocations(null)
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to add allocations')
        },
    })

    const copyToken = async (token: string) => {
        await navigator.clipboard.writeText(token)
        setCopied(true)
        toast.success('Token copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    const nodes = (data?.nodes || []) as Node[]

    // Real-time stats
    useEffect(() => {
        if (!nodes.length) return

        const socket = getSocket()
        if (!socket) return

        // Subscribe to stats for all nodes
        nodes.forEach(node => {
            socket.emit('node:subscribe', { nodeId: node.id })
        })

        const handleStats = (stats: any) => {
            queryClient.setQueryData(['nodes'], (old: any) => {
                if (!old?.nodes) return old
                return {
                    ...old,
                    nodes: old.nodes.map((n: Node) => {
                        if (n.id === stats.nodeId) {
                            return {
                                ...n,
                                isOnline: true,
                                usage: {
                                    memory: stats.memory,
                                    disk: stats.disk,
                                    cpu: stats.cpu
                                }
                            }
                        }
                        return n
                    })
                }
            })
        }

        socket.on('node:stats', handleStats)

        return () => {
            nodes.forEach(node => {
                socket.emit('node:unsubscribe', { nodeId: node.id })
            })
            socket.off('node:stats', handleStats)
        }
    }, [nodes.length, queryClient])

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Nodes</h1>
                    <p className="text-dark-400">Manage daemon nodes and allocations</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary inline-flex items-center gap-2 self-start"
                >
                    <Plus className="w-5 h-5" />
                    Add Node
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-semibold text-white mb-4">Add New Node</h2>
                        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Name</label>
                                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input w-full" placeholder="Local Node" required />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">FQDN / IP</label>
                                <input type="text" value={formData.fqdn} onChange={(e) => setFormData({ ...formData, fqdn: e.target.value })} className="input w-full" placeholder="localhost" required />
                                <p className="text-xs text-dark-500 mt-1">Use "localhost" for local development</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Port</label>
                                    <input type="number" value={formData.port} onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })} className="input w-full" required />
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Scheme</label>
                                    <select value={formData.scheme} onChange={(e) => setFormData({ ...formData, scheme: e.target.value })} className="input w-full">
                                        <option value="http">HTTP</option>
                                        <option value="https">HTTPS</option>
                                    </select>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Memory (MB)</label>
                                    <input type="number" value={formData.memory} onChange={(e) => setFormData({ ...formData, memory: parseInt(e.target.value) })} className="input w-full" required />
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Disk (MB)</label>
                                    <input type="number" value={formData.disk} onChange={(e) => setFormData({ ...formData, disk: parseInt(e.target.value) })} className="input w-full" required />
                                </div>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create Node'}
                                </button>
                                <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Setup Modal - shows after node creation */}
            {showSetup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="card max-w-lg w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <Key className="w-6 h-6 text-primary-400" />
                            <h2 className="text-xl font-semibold text-white">Daemon Setup</h2>
                        </div>
                        <p className="text-dark-300 mb-4">
                            Configure your daemon with this token. Edit <code className="text-primary-400">packages/daemon/config.json</code>:
                        </p>
                        <pre className="bg-dark-900 rounded-lg p-4 text-sm overflow-x-auto mb-4">
                            {`{
  "panel_url": "http://localhost:3001",
  "token": "${showSetup.token}"
}`}
                        </pre>
                        <button
                            onClick={() => copyToken(showSetup.token)}
                            className="btn-secondary w-full flex items-center justify-center gap-2 mb-4"
                        >
                            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Copied!' : 'Copy Token'}
                        </button>
                        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
                            <p className="text-sm text-yellow-400">
                                <strong>Next step:</strong> Add port allocations to this node before creating servers.
                            </p>
                        </div>
                        <button
                            onClick={() => { setShowAllocations(showSetup); setShowSetup(null); }}
                            className="btn-primary w-full"
                        >
                            Add Port Allocations
                        </button>
                    </div>
                </div>
            )}

            {/* Allocations Modal */}
            {showAllocations && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="card max-w-md w-full">
                        <div className="flex items-center gap-3 mb-4">
                            <Network className="w-6 h-6 text-primary-400" />
                            <h2 className="text-xl font-semibold text-white">Add Port Allocations</h2>
                        </div>
                        <p className="text-dark-400 text-sm mb-4">
                            Adding allocations to: <span className="text-white">{showAllocations.name}</span>
                        </p>
                        <form onSubmit={(e) => { e.preventDefault(); addAllocationsMutation.mutate({ nodeId: showAllocations.id, data: allocFormData }); }} className="space-y-4">
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">IP Address</label>
                                <input type="text" value={allocFormData.ip} onChange={(e) => setAllocFormData({ ...allocFormData, ip: e.target.value })} className="input w-full" placeholder="0.0.0.0" required />
                                <p className="text-xs text-dark-500 mt-1">Use 0.0.0.0 to bind to all interfaces</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Start Port</label>
                                    <input type="number" value={allocFormData.portStart} onChange={(e) => setAllocFormData({ ...allocFormData, portStart: parseInt(e.target.value) })} className="input w-full" required />
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">End Port</label>
                                    <input type="number" value={allocFormData.portEnd} onChange={(e) => setAllocFormData({ ...allocFormData, portEnd: parseInt(e.target.value) })} className="input w-full" required />
                                </div>
                            </div>
                            <p className="text-xs text-dark-500">
                                This will create {Math.max(0, allocFormData.portEnd - allocFormData.portStart + 1)} port allocations
                            </p>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="btn-primary flex-1" disabled={addAllocationsMutation.isPending}>
                                    {addAllocationsMutation.isPending ? 'Adding...' : 'Add Allocations'}
                                </button>
                                <button type="button" onClick={() => setShowAllocations(null)} className="btn-secondary flex-1">Close</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Nodes List */}
            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                    {[...Array(2)].map((_, i) => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-6 bg-dark-700 rounded w-1/2 mb-4" />
                            <div className="h-4 bg-dark-700 rounded w-3/4" />
                        </div>
                    ))}
                </div>
            ) : nodes.length === 0 ? (
                <div className="card text-center py-16">
                    <HardDrive className="w-16 h-16 text-dark-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No nodes configured</h3>
                    <p className="text-dark-400 mb-6">Add a daemon node to start hosting servers</p>
                    <button onClick={() => setShowCreate(true)} className="btn-primary inline-flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Add Node
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {nodes.map((node) => (
                        <div key={node.id} className="card">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${node.isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-500'} shadow-lg`} />
                                    <div>
                                        <h3 className="font-semibold text-white">{node.name}</h3>
                                        <p className="text-sm text-dark-400">{node.fqdn}:{node.port}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => setShowAllocations(node)} className="p-2 text-dark-400 hover:text-primary-400 transition-colors" title="Manage Allocations">
                                        <Network className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => setShowSetup(node)} className="p-2 text-dark-400 hover:text-primary-400 transition-colors" title="View Token">
                                        <Key className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => { if (confirm('Delete this node?')) deleteMutation.mutate(node.id) }}
                                        className="p-2 text-dark-400 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-dark-400">Memory</span>
                                        <span className="text-white">
                                            {typeof node.usage?.memory === 'object' ? (node.usage.memory as any).used : (node.usage?.memory || 0)} / {node.memory} MB
                                        </span>
                                    </div>
                                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary-500 rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(
                                                    (typeof node.usage?.memory === 'object' ? (node.usage.memory as any).used : (node.usage?.memory || 0)) / node.memory * 100,
                                                    100
                                                )}%`
                                            }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-dark-400">Disk</span>
                                        <span className="text-white">
                                            {typeof node.usage?.disk === 'object' ? (node.usage.disk as any).used : (node.usage?.disk || 0)} / {node.disk} MB
                                        </span>
                                    </div>
                                    <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary-500 rounded-full transition-all"
                                            style={{
                                                width: `${Math.min(
                                                    (typeof node.usage?.disk === 'object' ? (node.usage.disk as any).used : (node.usage?.disk || 0)) / node.disk * 100,
                                                    100
                                                )}%`
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-dark-400 pt-2">
                                    <span className="flex items-center gap-1">
                                        <Server className="w-4 h-4" />
                                        {node._count?.servers || 0} servers
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Network className="w-4 h-4" />
                                        {node.allocations?.filter(a => !a.serverId).length || 0} / {node._count?.allocations || 0} ports free
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

