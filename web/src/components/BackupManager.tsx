import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Archive,
    Download,
    Trash2,
    RefreshCw,
    RotateCcw,
    Clock,
    CheckCircle,
    XCircle,
    Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'

interface Backup {
    id: string
    name: string
    size: number | string
    status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
    storagePath: string | null
    createdAt: string
}

interface BackupManagerProps {
    serverId: string
}

function formatSize(bytes: number | string): string {
    const value = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes
    if (!value || value === 0) return '—'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(value) / Math.log(k))
    return parseFloat((value / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(date: string): string {
    return new Date(date).toLocaleString()
}

const statusIcons = {
    PENDING: Clock,
    IN_PROGRESS: Loader2,
    COMPLETED: CheckCircle,
    FAILED: XCircle,
}

const statusColors = {
    PENDING: 'text-amber-400',
    IN_PROGRESS: 'text-blue-400 animate-spin',
    COMPLETED: 'text-emerald-400',
    FAILED: 'text-red-400',
}

export default function BackupManager({ serverId }: BackupManagerProps) {
    const [backupName, setBackupName] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const queryClient = useQueryClient()

    const { data, isLoading, refetch } = useQuery({
        queryKey: ['backups', serverId],
        queryFn: () => api.get<{ backups: Backup[] }>(`/servers/${serverId}/backups`),
    })

    const createMutation = useMutation({
        mutationFn: (name: string) =>
            api.post(`/servers/${serverId}/backups`, { name: name || undefined }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups', serverId] })
            toast.success('Backup creation started')
            setShowCreate(false)
            setBackupName('')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create backup')
        },
    })

    const restoreMutation = useMutation({
        mutationFn: (backupId: string) =>
            api.post(`/servers/${serverId}/backups/${backupId}/restore`),
        onSuccess: () => {
            toast.success('Backup restore started')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to restore backup')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (backupId: string) =>
            api.delete(`/servers/${serverId}/backups/${backupId}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['backups', serverId] })
            toast.success('Backup deleted')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to delete backup')
        },
    })

    const downloadBackup = async (backupId: string) => {
        try {
            const result = await api.get<{ downloadUrl: string }>(`/servers/${serverId}/backups/${backupId}/download`)
            window.open(result.downloadUrl, '_blank')
        } catch (error: any) {
            toast.error(error.message || 'Failed to get download URL')
        }
    }

    const backups = data?.backups || []

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-dark-900 border border-dark-700 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <div className="h-4 w-px bg-dark-700 mx-1" />
                    <span className="text-sm text-dark-400 px-2">{backups.length} / 10 backups</span>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    disabled={backups.length >= 10}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 disabled:opacity-50"
                >
                    <Archive className="w-3.5 h-3.5" />
                    Create Backup
                </button>
            </div>

            {/* Backup List */}
            {isLoading ? (
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-12 text-center">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-dark-400 mb-3" />
                    <p className="text-sm text-dark-400">Loading backups...</p>
                </div>
            ) : backups.length === 0 ? (
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-12 text-center">
                    <Archive className="w-10 h-10 mx-auto text-dark-600 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-white mb-2">No Backups</h3>
                    <p className="text-sm text-dark-400 mb-6">Create your first backup to protect your server data</p>
                    <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
                        Create Backup
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {backups.map((backup) => {
                        const StatusIcon = statusIcons[backup.status]
                        return (
                            <div key={backup.id} className="bg-dark-900 border border-dark-700 rounded-lg p-4 flex items-center gap-4 group hover:border-dark-600 transition-colors">
                                <div className={`p-2 rounded-lg bg-dark-800/50 ${statusColors[backup.status]}`}>
                                    <StatusIcon className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-white truncate text-sm mb-0.5">{backup.name}</h4>
                                    <div className="flex items-center gap-3 text-xs text-dark-400 font-mono">
                                        <span>{formatSize(backup.size)}</span>
                                        <span className="w-1 h-1 rounded-full bg-dark-700" />
                                        <span>{formatDate(backup.createdAt)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {backup.status === 'COMPLETED' && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    if (confirm('This will overwrite all current server files. Continue?')) {
                                                        restoreMutation.mutate(backup.id)
                                                    }
                                                }}
                                                className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                                                title="Restore"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => downloadBackup(backup.id)}
                                                className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                                                title="Download"
                                            >
                                                <Download className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (confirm('Delete this backup?')) {
                                                deleteMutation.mutate(backup.id)
                                            }
                                        }}
                                        className="p-2 hover:bg-red-500/10 rounded text-dark-400 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-900 border border-dark-700 rounded-lg max-w-md w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-medium text-white mb-4">Create Backup</h3>
                        <input
                            type="text"
                            value={backupName}
                            onChange={(e) => setBackupName(e.target.value)}
                            placeholder="Backup name (optional)"
                            className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 mb-4"
                            autoFocus
                        />
                        <p className="text-xs text-dark-400 mb-6 leading-relaxed">
                            This will create a compressed archive of your entire server directory. The server may experience slightly reduced performance during this process.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowCreate(false)} className="btn-secondary text-xs">
                                Cancel
                            </button>
                            <button
                                onClick={() => createMutation.mutate(backupName)}
                                disabled={createMutation.isPending}
                                className="btn-primary text-xs"
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create Backup'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
