import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserPlus, Shield, Check } from 'lucide-react'
import { toast } from 'sonner'
import { serversApi } from '../services/api'

interface SubuserManagerProps {
    serverId: string
    isOwner: boolean
}

export default function SubuserManager({ serverId, isOwner }: SubuserManagerProps) {
    const [email, setEmail] = useState('')
    const [permissions, setPermissions] = useState<string[]>(['console', 'power'])
    const [isAdding, setIsAdding] = useState(false)
    const queryClient = useQueryClient()

    const { data: server } = useQuery({
        queryKey: ['server', serverId],
        queryFn: () => serversApi.get(serverId),
    })

    const subusers = server?.server?.subusers || []

    const addMutation = useMutation({
        mutationFn: (data: { email: string; permissions: string }) =>
            serversApi.addSubuser(serverId, data.email, data.permissions),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['server', serverId] })
            toast.success('Subuser added successfully')
            setEmail('')
            setIsAdding(false)
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to add subuser')
        },
    })

    const removeMutation = useMutation({
        mutationFn: (userId: string) => serversApi.removeSubuser(serverId, userId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['server', serverId] })
            toast.success('Subuser removed')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to remove subuser')
        },
    })

    const availablePermissions = [
        { id: 'console', label: 'Console Access' },
        { id: 'power', label: 'Power Actions' },
        { id: 'files', label: 'File Manager' },
        { id: 'backups', label: 'Backup Manager' },
        { id: 'schedules', label: 'Schedule Manager' },
    ]

    const togglePermission = (perm: string) => {
        setPermissions(prev =>
            prev.includes(perm)
                ? prev.filter(p => p !== perm)
                : [...prev, perm]
        )
    }

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault()
        if (!email) return
        addMutation.mutate({
            email,
            permissions: JSON.stringify(permissions)
        })
    }

    if (!isOwner) {
        return (
            <div className="p-6 text-center text-dark-400">
                <Shield className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Only the server owner can manage sub-users.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium text-white">Sub-users</h3>
                    <p className="text-sm text-dark-400">Manage access to this server for other users.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="btn btn-primary text-xs uppercase tracking-wider flex items-center gap-2"
                >
                    <UserPlus className="w-4 h-4" />
                    {isAdding ? 'Cancel' : 'Add User'}
                </button>
            </div>

            {isAdding && (
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-6 animate-in fade-in slide-in-from-top-2">
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">
                                User Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input w-full"
                                placeholder="user@example.com"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-dark-400 uppercase tracking-wider mb-2">
                                Permissions
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {availablePermissions.map((perm) => (
                                    <button
                                        key={perm.id}
                                        type="button"
                                        onClick={() => togglePermission(perm.id)}
                                        className={`
                                            flex items-center gap-2 p-3 rounded-sm border text-sm transition-all duration-200
                                            ${permissions.includes(perm.id)
                                                ? 'bg-accent/10 border-accent text-white'
                                                : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                                            }
                                        `}
                                    >
                                        <div className={`
                                            w-4 h-4 rounded-sm border flex items-center justify-center transition-colors
                                            ${permissions.includes(perm.id)
                                                ? 'bg-accent border-accent'
                                                : 'border-dark-600'
                                            }
                                        `}>
                                            {permissions.includes(perm.id) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        {perm.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                type="submit"
                                disabled={addMutation.isPending}
                                className="btn btn-primary"
                            >
                                {addMutation.isPending ? 'Adding...' : 'Grant Access'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="space-y-3">
                {subusers.length === 0 ? (
                    <div className="text-center py-12 bg-dark-900 border border-dark-700 rounded-sm border-dashed">
                        <Users className="w-8 h-8 mx-auto mb-3 text-dark-600" />
                        <p className="text-dark-400 text-sm">No sub-users assigned to this server.</p>
                    </div>
                ) : (
                    subusers.map((subuser: any) => (
                        <div
                            key={subuser.userId}
                            className="flex items-center justify-between p-4 bg-dark-900 border border-dark-700 rounded-sm hover:border-dark-600 transition-colors"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-dark-800 flex items-center justify-center border border-dark-700">
                                    <span className="text-lg font-medium text-dark-300">
                                        {subuser.user.username.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div>
                                    <p className="text-white font-medium">{subuser.user.username}</p>
                                    <p className="text-xs text-dark-400">{subuser.user.email}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="hidden md:flex gap-1">
                                    {JSON.parse(subuser.permissions).map((perm: string) => (
                                        <span key={perm} className="px-2 py-0.5 rounded-sm bg-dark-800 border border-dark-700 text-[10px] text-dark-300 uppercase tracking-wider">
                                            {perm}
                                        </span>
                                    ))}
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm('Remove this user?')) {
                                            removeMutation.mutate(subuser.userId)
                                        }
                                    }}
                                    className="p-2 text-dark-400 hover:text-red-500 hover:bg-red-500/10 rounded-sm transition-colors"
                                    title="Remove User"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

function Users({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
    )
}
