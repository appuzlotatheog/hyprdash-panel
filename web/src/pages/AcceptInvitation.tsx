import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Sparkles, Loader2, Shield, Server, Mail, Calendar, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { settingsApi } from '../services/api'

interface InvitationDetails {
    email: string
    serverName: string
    invitedBy: string
    permissions: string[]
    expiresAt: string
}

export default function AcceptInvitation() {
    const { token } = useParams<{ token: string }>()
    const navigate = useNavigate()
    const [showPassword, setShowPassword] = useState(false)
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
    })

    const { data: settings } = useQuery({
        queryKey: ['settings', 'public'],
        queryFn: settingsApi.getPublic,
        staleTime: 1000 * 60 * 5,
    })

    const panelName = settings?.panel_name || 'HyprDash'

    const { data: invitation, isLoading, error } = useQuery<InvitationDetails>({
        queryKey: ['invitation', token],
        queryFn: async () => {
            const res = await fetch(`/api/invitations/${token}`)
            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Invalid invitation')
            }
            return res.json()
        },
        enabled: !!token,
        retry: false,
    })

    const acceptMutation = useMutation({
        mutationFn: async (data: { username: string; password: string }) => {
            const res = await fetch('/api/invitations/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, ...data }),
            })
            if (!res.ok) {
                const json = await res.json()
                throw new Error(json.error || 'Failed to accept invitation')
            }
            return res.json()
        },
        onSuccess: (data) => {
            toast.success(data.message)
            navigate('/login')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to accept invitation')
        },
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (formData.password !== formData.confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        if (formData.password.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }

        acceptMutation.mutate({
            username: formData.username,
            password: formData.password,
        })
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-950">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
        )
    }

    if (error || !invitation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-dark-950 p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                        <Shield className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
                    <p className="text-dark-400 mb-6">
                        {(error as Error)?.message || 'This invitation link is invalid or has expired.'}
                    </p>
                    <Link to="/login" className="btn btn-primary">
                        Go to Login
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="bg-grid" />
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="w-full max-w-md relative z-10">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-2xl shadow-indigo-500/30 mb-4">
                        <Mail className="w-10 h-10 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">You're Invited!</h1>
                    <p className="text-dark-400">Join {panelName} and manage servers</p>
                </div>

                {/* Invitation Details */}
                <div className="glass-strong rounded-xl p-6 mb-6 border border-dark-700">
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Server className="w-5 h-5 text-accent" />
                            <div>
                                <p className="text-xs text-dark-400 uppercase tracking-wider">Server</p>
                                <p className="text-white font-medium">{invitation.serverName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-accent" />
                            <div>
                                <p className="text-xs text-dark-400 uppercase tracking-wider">Your Email</p>
                                <p className="text-white font-medium">{invitation.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-accent" />
                            <div>
                                <p className="text-xs text-dark-400 uppercase tracking-wider">Expires</p>
                                <p className="text-white font-medium">{new Date(invitation.expiresAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-dark-400 uppercase tracking-wider mb-2">Permissions</p>
                            <div className="flex flex-wrap gap-2">
                                {invitation.permissions.map((perm) => (
                                    <span key={perm} className="px-2 py-1 bg-accent/10 text-accent text-xs rounded uppercase tracking-wider">
                                        {perm}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Setup Form */}
                <div className="glass-strong rounded-xl p-6 border border-dark-700">
                    <h2 className="text-lg font-semibold text-white mb-4">Create Your Account</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">Username</label>
                            <input
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                className="input w-full"
                                placeholder="Choose a username"
                                required
                                minLength={3}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input w-full pr-12"
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-dark-300 mb-2">Confirm Password</label>
                            <input
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                className="input w-full"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={acceptMutation.isPending}
                            className="btn btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {acceptMutation.isPending ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Sparkles className="w-5 h-5" />
                            )}
                            Accept & Create Account
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-dark-400 mt-6">
                    Already have an account?{' '}
                    <Link to="/login" className="text-accent hover:underline">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    )
}
