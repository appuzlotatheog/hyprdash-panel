import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Plus,
    Users as UsersIcon,
    Trash2,
    Shield,
    ShieldCheck,
    User as UserIcon
} from 'lucide-react'
import { toast } from 'sonner'
import { usersApi } from '../services/api'

const roleColors = {
    ADMIN: 'bg-primary-500/20 text-primary-400',
    MODERATOR: 'bg-yellow-500/20 text-yellow-400',
    USER: 'bg-dark-700 text-dark-300',
}

const roleIcons = {
    ADMIN: ShieldCheck,
    MODERATOR: Shield,
    USER: UserIcon,
}

export default function Users() {
    const [showCreate, setShowCreate] = useState(false)
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        role: 'USER',
    })
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: usersApi.list,
    })

    const createMutation = useMutation({
        mutationFn: usersApi.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            setShowCreate(false)
            setFormData({ username: '', email: '', password: '', role: 'USER' })
            toast.success('User created')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create user')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: usersApi.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] })
            toast.success('User deleted')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to delete user')
        },
    })

    const users = data?.users || []

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Users</h1>
                    <p className="text-dark-400">Manage user accounts</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary inline-flex items-center gap-2 self-start"
                >
                    <Plus className="w-5 h-5" />
                    Add User
                </button>
            </div>

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="card max-w-md w-full">
                        <h2 className="text-xl font-semibold text-white mb-4">Add New User</h2>
                        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Username</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="input w-full"
                                    placeholder="johndoe"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="input w-full"
                                    placeholder="john@example.com"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Password</label>
                                <input
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input w-full"
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Role</label>
                                <select
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="input w-full"
                                >
                                    <option value="USER">User</option>
                                    <option value="MODERATOR">Moderator</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button type="submit" className="btn-primary flex-1" disabled={createMutation.isPending}>
                                    {createMutation.isPending ? 'Creating...' : 'Create User'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(false)}
                                    className="btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Users Table */}
            {isLoading ? (
                <div className="card animate-pulse">
                    <div className="h-12 bg-dark-700 rounded mb-4" />
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="h-16 bg-dark-800 rounded mb-2" />
                    ))}
                </div>
            ) : users.length === 0 ? (
                <div className="card text-center py-16">
                    <UsersIcon className="w-16 h-16 text-dark-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No users found</h3>
                    <p className="text-dark-400">Users will appear here</p>
                </div>
            ) : (
                <div className="card overflow-hidden p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-dark-800/50">
                                <tr>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">User</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Role</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">2FA</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Servers</th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-dark-400">Created</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-700/50">
                                {users.map((user) => {
                                    const RoleIcon = roleIcons[user.role as keyof typeof roleIcons]
                                    return (
                                        <tr key={user.id} className="hover:bg-dark-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-semibold">
                                                        {user.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-white">{user.username}</p>
                                                        <p className="text-sm text-dark-400">{user.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${roleColors[user.role as keyof typeof roleColors]}`}>
                                                    <RoleIcon className="w-3 h-3" />
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-sm ${user.twoFactorEnabled ? 'text-green-400' : 'text-dark-500'}`}>
                                                    {user.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-dark-300">
                                                {user._count?.servers || 0}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-dark-400">
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Delete user ${user.username}?`)) {
                                                            deleteMutation.mutate(user.id)
                                                        }
                                                    }}
                                                    className="p-2 text-dark-400 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}
