import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
    Server,
    ArrowLeft,
    Save,
    Cpu,
    MemoryStick,
    HardDrive,
    User
} from 'lucide-react'
import { toast } from 'sonner'
import { nodesApi, eggsApi, serversApi, usersApi } from '../services/api'
import { useAuthStore } from '../stores/auth'

interface Egg {
    id: string
    name: string
    description?: string
    startup: string
}

interface Node {
    id: string
    name: string
    fqdn: string
    isOnline: boolean
    allocations?: { id: string; ip: string; port: number; serverId: string | null }[]
}

interface User {
    id: string
    username: string
    email: string
}

export default function CreateServer() {
    const navigate = useNavigate()
    const user = useAuthStore((state) => state.user)
    const isAdmin = user?.role === 'ADMIN'

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        nodeId: '',
        eggId: '',
        memory: 1024,
        disk: 10240,
        cpu: 100,
        allocationId: '',
        ownerId: '',
    })

    const { data: nodesData, isLoading: nodesLoading } = useQuery({
        queryKey: ['nodes'],
        queryFn: nodesApi.list,
    })

    const { data: eggsData, isLoading: eggsLoading } = useQuery({
        queryKey: ['eggs'],
        queryFn: eggsApi.list,
    })

    const { data: usersData, isLoading: usersLoading } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.list,
        enabled: isAdmin,
    })

    const createMutation = useMutation({
        mutationFn: (data: any) => serversApi.create(data),
        onSuccess: (response) => {
            toast.success('Server created successfully!')
            navigate(`/servers/${response.server.id}`)
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create server')
        },
    })

    const nodes = (nodesData?.nodes || []) as Node[]
    const eggs = (eggsData?.eggs || []) as Egg[]
    const users = (usersData?.users || []) as User[]
    const selectedNode = nodes.find(n => n.id === formData.nodeId)
    const selectedEgg = eggs.find(e => e.id === formData.eggId)
    const availableAllocations = selectedNode?.allocations?.filter(a => !a.serverId) || []

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!formData.name.trim()) {
            toast.error('Server name is required')
            return
        }
        if (!formData.nodeId) {
            toast.error('Please select a node')
            return
        }
        if (!formData.eggId || !selectedEgg) {
            toast.error('Please select a game/egg')
            return
        }
        if (!formData.allocationId) {
            toast.error('Please select a port allocation')
            return
        }

        // Get startup from selected egg
        const serverData = {
            ...formData,
            startup: selectedEgg.startup,
            // Only send ownerId if it's set (and user is admin, though backend checks too)
            ownerId: isAdmin && formData.ownerId ? formData.ownerId : undefined
        }

        createMutation.mutate(serverData)
    }

    if (!isAdmin) {
        return (
            <div className="card text-center py-16">
                <Server className="w-16 h-16 mx-auto text-dark-500 mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                <p className="text-dark-400">Only administrators can create servers.</p>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/servers')}
                    className="btn-secondary p-2"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Create Server</h1>
                    <p className="text-dark-400">Set up a new game server</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Server Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="My Minecraft Server"
                                className="input w-full"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Description (Optional)</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="A fun server for friends"
                                className="input w-full h-20 resize-none"
                            />
                        </div>

                        {/* Owner Selection (Admin Only) */}
                        {isAdmin && (
                            <div>
                                <label className="block text-sm text-dark-400 mb-1 flex items-center gap-1">
                                    <User className="w-4 h-4" /> Server Owner
                                </label>
                                {usersLoading ? (
                                    <p className="text-dark-500 text-sm">Loading users...</p>
                                ) : (
                                    <select
                                        value={formData.ownerId}
                                        onChange={(e) => setFormData({ ...formData, ownerId: e.target.value })}
                                        className="input w-full"
                                    >
                                        <option value="">Assign to me ({user?.username})</option>
                                        {users.filter(u => u.id !== user?.id).map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.username} ({u.email})
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-xs text-dark-500 mt-1">
                                    Leave empty to assign to yourself.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Node & Allocation */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Node & Port</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Node</label>
                            {nodesLoading ? (
                                <p className="text-dark-500">Loading nodes...</p>
                            ) : nodes.length === 0 ? (
                                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                    <p className="text-yellow-400 text-sm">
                                        No nodes available. Go to <button onClick={() => navigate('/nodes')} className="underline">Nodes</button> to add one first.
                                    </p>
                                </div>
                            ) : (
                                <select
                                    value={formData.nodeId}
                                    onChange={(e) => setFormData({ ...formData, nodeId: e.target.value, allocationId: '' })}
                                    className="input w-full"
                                    required
                                >
                                    <option value="">Select a node...</option>
                                    {nodes.map((node) => (
                                        <option key={node.id} value={node.id}>
                                            {node.name} ({node.fqdn}) - {node.isOnline ? '🟢 Online' : '🔴 Offline'}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        {formData.nodeId && (
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Port Allocation</label>
                                {availableAllocations.length === 0 ? (
                                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                        <p className="text-yellow-400 text-sm">
                                            No available ports on this node. Add allocations in the Nodes management page.
                                        </p>
                                    </div>
                                ) : (
                                    <select
                                        value={formData.allocationId}
                                        onChange={(e) => setFormData({ ...formData, allocationId: e.target.value })}
                                        className="input w-full"
                                        required
                                    >
                                        <option value="">Select a port...</option>
                                        {availableAllocations.map((alloc) => (
                                            <option key={alloc.id} value={alloc.id}>
                                                {alloc.ip}:{alloc.port}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Game Selection */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Game Template</h3>
                    {eggsLoading ? (
                        <p className="text-dark-500">Loading templates...</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            {eggs.map((egg) => (
                                <button
                                    key={egg.id}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, eggId: egg.id })}
                                    className={`p-4 rounded-lg border text-left transition-all ${formData.eggId === egg.id
                                        ? 'border-primary-500 bg-primary-500/10'
                                        : 'border-dark-700 bg-dark-800/50 hover:border-dark-600'
                                        }`}
                                >
                                    <p className="font-medium text-white">{egg.name}</p>
                                    <p className="text-xs text-dark-400 mt-1">{egg.description || 'No description'}</p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Resource Limits */}
                <div className="card">
                    <h3 className="text-lg font-semibold text-white mb-4">Resource Limits</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm text-dark-400 mb-1 flex items-center gap-1">
                                <MemoryStick className="w-4 h-4" /> Memory (MB)
                            </label>
                            <input
                                type="number"
                                value={formData.memory}
                                onChange={(e) => setFormData({ ...formData, memory: parseInt(e.target.value) || 0 })}
                                min={128}
                                step={128}
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1 flex items-center gap-1">
                                <HardDrive className="w-4 h-4" /> Disk (MB)
                            </label>
                            <input
                                type="number"
                                value={formData.disk}
                                onChange={(e) => setFormData({ ...formData, disk: parseInt(e.target.value) || 0 })}
                                min={1024}
                                step={1024}
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1 flex items-center gap-1">
                                <Cpu className="w-4 h-4" /> CPU (%)
                            </label>
                            <input
                                type="number"
                                value={formData.cpu}
                                onChange={(e) => setFormData({ ...formData, cpu: parseInt(e.target.value) || 0 })}
                                min={25}
                                max={400}
                                step={25}
                                className="input w-full"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-dark-500 mt-2">
                        100% CPU = 1 core. Set to 200% for 2 cores, etc.
                    </p>
                </div>

                {/* Submit */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/servers')}
                        className="btn-secondary flex-1"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {createMutation.isPending ? 'Creating...' : 'Create Server'}
                    </button>
                </div>
            </form>
        </div>
    )
}
