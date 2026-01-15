import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderGit2, Plus, Trash2, Server, HardDrive, Link, Unlink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { Dialog } from '@headlessui/react'

interface Mount {
    id: string
    name: string
    source: string
    target: string
    readOnly: boolean
    nodeId: string
    node: { id: string; name: string }
    servers: Array<{
        server: { id: string; name: string }
    }>
}

interface Node {
    id: string
    name: string
}

export default function Mounts() {
    const queryClient = useQueryClient()
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isAttachOpen, setIsAttachOpen] = useState(false)
    const [selectedMount, setSelectedMount] = useState<Mount | null>(null)

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        source: '',
        target: '',
        readOnly: false,
        nodeId: '',
    })
    const [attachServerId, setAttachServerId] = useState('')

    const { data: mounts, isLoading } = useQuery({
        queryKey: ['mounts'],
        queryFn: async () => {
            const res = await api.get<{ mounts: Mount[] }>('/mounts')
            return res.mounts
        },
    })

    const { data: nodes } = useQuery({
        queryKey: ['nodes'],
        queryFn: async () => {
            const res = await api.get<{ nodes: Node[] }>('/nodes')
            return res.nodes
        },
    })

    const createMutation = useMutation({
        mutationFn: (data: typeof formData) => api.post('/mounts', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mounts'] })
            setIsCreateOpen(false)
            setFormData({ name: '', source: '', target: '', readOnly: false, nodeId: '' })
            toast.success('Mount created successfully')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create mount')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/mounts/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mounts'] })
            toast.success('Mount deleted')
        },
    })

    const attachMutation = useMutation({
        mutationFn: ({ mountId, serverId }: { mountId: string; serverId: string }) =>
            api.post(`/mounts/${mountId}/servers`, { serverId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mounts'] })
            setIsAttachOpen(false)
            setAttachServerId('')
            toast.success('Mount attached to server')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to attach mount')
        },
    })

    const detachMutation = useMutation({
        mutationFn: ({ mountId, serverId }: { mountId: string; serverId: string }) =>
            api.delete(`/mounts/${mountId}/servers/${serverId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['mounts'] })
            toast.success('Mount detached from server')
        },
    })

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault()
        createMutation.mutate(formData)
    }

    const handleAttach = (e: React.FormEvent) => {
        e.preventDefault()
        if (selectedMount) {
            attachMutation.mutate({ mountId: selectedMount.id, serverId: attachServerId })
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-primary-500/10 text-primary-400">
                        <FolderGit2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-white">Mounts</h1>
                        <p className="text-dark-400">Manage external storage mounts for servers</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsCreateOpen(true)}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Create Mount
                </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {mounts?.map((mount) => (
                    <div key={mount.id} className="card group">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-lg font-medium text-white">{mount.name}</h3>
                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-dark-800 text-dark-300 border border-dark-700">
                                        {mount.node.name}
                                    </span>
                                    {mount.readOnly && (
                                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                            Read Only
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-dark-400 font-mono">
                                    <span className="flex items-center gap-1.5">
                                        <HardDrive className="w-3 h-3" />
                                        {mount.source}
                                    </span>
                                    <span className="text-dark-600">→</span>
                                    <span className="flex items-center gap-1.5">
                                        <FolderGit2 className="w-3 h-3" />
                                        {mount.target}
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => {
                                        setSelectedMount(mount)
                                        setIsAttachOpen(true)
                                    }}
                                    className="p-2 rounded hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
                                    title="Attach to Server"
                                >
                                    <Link className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => deleteMutation.mutate(mount.id)}
                                    className="p-2 rounded hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-colors"
                                    title="Delete Mount"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {mount.servers.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-dark-700">
                                <h4 className="text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">
                                    Attached Servers
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {mount.servers.map(({ server }) => (
                                        <div
                                            key={server.id}
                                            className="flex items-center gap-2 px-2 py-1 rounded bg-dark-800 border border-dark-700 text-sm text-dark-200"
                                        >
                                            <Server className="w-3 h-3 text-dark-400" />
                                            {server.name}
                                            <button
                                                onClick={() => detachMutation.mutate({ mountId: mount.id, serverId: server.id })}
                                                className="ml-1 hover:text-red-400 transition-colors"
                                            >
                                                <Unlink className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}

                {mounts?.length === 0 && (
                    <div className="text-center py-12 text-dark-400">
                        <FolderGit2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                        <p>No mounts created yet</p>
                    </div>
                )}
            </div>

            {/* Create Mount Modal */}
            <Dialog
                open={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                className="relative z-50"
            >
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="bg-dark-900 border border-dark-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
                        <Dialog.Title className="text-lg font-medium text-white mb-4">
                            Create New Mount
                        </Dialog.Title>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="input w-full"
                                    placeholder="Global Maps"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Node</label>
                                <select
                                    value={formData.nodeId}
                                    onChange={(e) => setFormData({ ...formData, nodeId: e.target.value })}
                                    className="input w-full"
                                    required
                                >
                                    <option value="">Select a node</option>
                                    {Array.isArray(nodes) && nodes.map((node) => (
                                        <option key={node.id} value={node.id}>
                                            {node.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Source Path (Host)</label>
                                <input
                                    type="text"
                                    value={formData.source}
                                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                    className="input w-full font-mono text-sm"
                                    placeholder="/mnt/storage/maps"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Target Path (Container)</label>
                                <input
                                    type="text"
                                    value={formData.target}
                                    onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                                    className="input w-full font-mono text-sm"
                                    placeholder="/maps"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="readOnly"
                                    checked={formData.readOnly}
                                    onChange={(e) => setFormData({ ...formData, readOnly: e.target.checked })}
                                    className="rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/20"
                                />
                                <label htmlFor="readOnly" className="text-sm text-dark-300">
                                    Read Only
                                </label>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateOpen(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createMutation.isPending}
                                    className="btn-primary"
                                >
                                    {createMutation.isPending ? 'Creating...' : 'Create Mount'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>

            {/* Attach Server Modal */}
            <Dialog
                open={isAttachOpen}
                onClose={() => setIsAttachOpen(false)}
                className="relative z-50"
            >
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="bg-dark-900 border border-dark-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
                        <Dialog.Title className="text-lg font-medium text-white mb-4">
                            Attach Server
                        </Dialog.Title>
                        <p className="text-sm text-dark-400 mb-4">
                            Enter the Server ID to attach to <strong>{selectedMount?.name}</strong>.
                            The server must be on node <strong>{selectedMount?.node.name}</strong>.
                        </p>

                        <form onSubmit={handleAttach} className="space-y-4">
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Server ID</label>
                                <input
                                    type="text"
                                    value={attachServerId}
                                    onChange={(e) => setAttachServerId(e.target.value)}
                                    className="input w-full font-mono text-sm"
                                    placeholder="UUID"
                                    required
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsAttachOpen(false)}
                                    className="btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={attachMutation.isPending}
                                    className="btn-primary"
                                >
                                    {attachMutation.isPending ? 'Attaching...' : 'Attach Server'}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    )
}
