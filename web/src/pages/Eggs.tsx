import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Search,
    Edit,
    Trash2,
    Box,
    Server,
    Upload,
    FileCode
} from 'lucide-react'
import { toast } from 'sonner'
import { eggsApi } from '../services/api'
import { useAuthStore } from '../stores/auth'

interface Egg {
    id: string
    name: string
    author?: string
    description?: string
    startup: string
    _count: { servers: number }
}

export default function Eggs() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const user = useAuthStore((state) => state.user)
    const isAdmin = user?.role === 'ADMIN'
    const [search, setSearch] = useState('')
    const [showImport, setShowImport] = useState(false)
    const [importJson, setImportJson] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['eggs'],
        queryFn: eggsApi.list,
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => eggsApi.delete(id),
        onSuccess: () => {
            toast.success('Egg deleted')
            queryClient.invalidateQueries({ queryKey: ['eggs'] })
        },
        onError: (err: any) => toast.error(err.message || 'Failed to delete'),
    })

    const eggs = (data?.eggs || []) as Egg[]
    const filteredEggs = eggs.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.description?.toLowerCase().includes(search.toLowerCase())
    )

    const handleImport = async () => {
        try {
            const eggData = JSON.parse(importJson)
            const res = await fetch('/api/eggs/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(eggData),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message || 'Egg imported!')
                queryClient.invalidateQueries({ queryKey: ['eggs'] })
                setShowImport(false)
                setImportJson('')
            } else {
                toast.error(data.error || 'Import failed')
            }
        } catch {
            toast.error('Invalid JSON format')
        }
    }

    if (!isAdmin) {
        return (
            <div className="card text-center py-16">
                <Box className="w-16 h-16 mx-auto text-dark-500 mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                <p className="text-dark-400">Only administrators can manage eggs.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Eggs</h1>
                    <p className="text-dark-400">Game server templates and configurations</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowImport(true)}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        Import
                    </button>
                    <button
                        onClick={() => navigate('/admin/eggs/new')}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create Egg
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search eggs..."
                    className="input w-full pl-10"
                />
            </div>

            {/* Eggs Grid */}
            {isLoading ? (
                <div className="card p-8 text-center text-dark-400">Loading eggs...</div>
            ) : filteredEggs.length === 0 ? (
                <div className="card text-center py-16">
                    <Box className="w-12 h-12 mx-auto text-dark-500 mb-4" />
                    <p className="text-dark-400">
                        {search ? 'No eggs found matching your search' : 'No eggs created yet'}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEggs.map((egg) => (
                        <div
                            key={egg.id}
                            className="card hover:border-dark-600 transition-colors cursor-pointer"
                            onClick={() => navigate(`/admin/eggs/${egg.id}`)}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="p-2 bg-primary-500/10 rounded-lg">
                                    <Box className="w-6 h-6 text-primary-400" />
                                </div>
                                <div className="flex items-center gap-2 text-dark-400">
                                    <Server className="w-4 h-4" />
                                    <span className="text-sm">{egg._count.servers}</span>
                                </div>
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-1">{egg.name}</h3>
                            <p className="text-sm text-dark-400 line-clamp-2 mb-3">
                                {egg.description || 'No description'}
                            </p>
                            {egg.author && (
                                <p className="text-xs text-dark-500">By {egg.author}</p>
                            )}
                            <div className="mt-4 pt-3 border-t border-dark-700 flex justify-between">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        navigate(`/admin/eggs/${egg.id}`)
                                    }}
                                    className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1"
                                >
                                    <Edit className="w-4 h-4" />
                                    Edit
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        if (egg._count.servers > 0) {
                                            toast.error('Cannot delete egg with active servers')
                                            return
                                        }
                                        if (confirm(`Delete "${egg.name}"?`)) {
                                            deleteMutation.mutate(egg.id)
                                        }
                                    }}
                                    className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="card max-w-2xl w-full max-h-[80vh] overflow-auto">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <FileCode className="w-5 h-5" />
                            Import Pterodactyl Egg
                        </h3>
                        <p className="text-sm text-dark-400 mb-4">
                            Paste the contents of a Pterodactyl egg JSON file. You can find eggs at{' '}
                            <a
                                href="https://github.com/parkervcp/eggs"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary-400 hover:underline"
                            >
                                github.com/parkervcp/eggs
                            </a>
                        </p>
                        <textarea
                            value={importJson}
                            onChange={(e) => setImportJson(e.target.value)}
                            placeholder="Paste egg JSON here..."
                            className="input w-full h-64 font-mono text-sm mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowImport(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleImport} className="btn-primary flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
