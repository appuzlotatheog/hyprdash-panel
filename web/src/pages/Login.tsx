import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Gamepad2, Eye, EyeOff, Loader2, Sparkles, Shield, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { authApi, settingsApi } from '../services/api'
import { useAuthStore } from '../stores/auth'

export default function Login() {
    const [isLogin, setIsLogin] = useState(true)
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [show2FA, setShow2FA] = useState(false)

    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
        twoFactorCode: '',
    })

    const navigate = useNavigate()
    const login = useAuthStore((state) => state.login)

    const { data: settings } = useQuery({
        queryKey: ['settings', 'public'],
        queryFn: settingsApi.getPublic,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

    const panelName = settings?.panel_name || 'HyprDash'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            if (isLogin) {
                const result = await authApi.login(
                    formData.email,
                    formData.password,
                    formData.twoFactorCode || undefined
                )
                login(result.user, result.token)
                toast.success('Welcome back!')
                navigate('/')
            } else {
                const result = await authApi.register(
                    formData.email,
                    formData.username,
                    formData.password
                )
                login(result.user, result.token)
                toast.success('Account created successfully!')
                navigate('/')
            }
        } catch (error: any) {
            if (error.message === '2FA code required') {
                setShow2FA(true)
                toast.info('Please enter your 2FA code')
            } else {
                toast.error(error.message || 'Authentication failed')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
            {/* Animated background effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {/* Grid background */}
                <div className="bg-grid" />

                {/* Floating orbs */}
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />

                {/* Floating particles */}
                {Array.from({ length: 20 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute w-1 h-1 bg-indigo-400/50 rounded-full"
                        style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animation: `float ${5 + Math.random() * 5}s ease-in-out infinite`,
                            animationDelay: `${Math.random() * 5}s`,
                        }}
                    />
                ))}
            </div>

            <div className="w-full max-w-md relative z-10 animate-blur-in">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="relative inline-block">
                        <div className="inline-flex items-center justify-center p-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-2xl shadow-indigo-500/30 mb-4">
                            <Gamepad2 className="w-10 h-10 text-white" />
                        </div>
                        {/* Glow effect behind logo */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 blur-xl opacity-50 -z-10 scale-150" />
                    </div>
                    <h1 className="text-4xl font-bold gradient-text mb-2">
                        {panelName}
                    </h1>
                    <p className="text-gray-400">
                        {isLogin ? 'Welcome back! Sign in to continue' : 'Create your account to get started'}
                    </p>
                </div>

                {/* Form Card */}
                <div className="glass-strong rounded-2xl p-8 gradient-border animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="input w-full"
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        {!isLogin && (
                            <div className="animate-fade-in-up" style={{ animationDelay: '0.35s' }}>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Username
                                </label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="input w-full"
                                    placeholder="Choose a username"
                                    required
                                />
                            </div>
                        )}

                        <div className="animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="input w-full pr-12"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {show2FA && isLogin && (
                            <div className="animate-fade-in-up">
                                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-indigo-400" />
                                    2FA Code
                                </label>
                                <input
                                    type="text"
                                    value={formData.twoFactorCode}
                                    onChange={(e) => setFormData({ ...formData, twoFactorCode: e.target.value })}
                                    className="input w-full text-center tracking-[0.5em] text-xl font-mono"
                                    placeholder="000000"
                                    maxLength={6}
                                    autoFocus
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-base font-semibold animate-fade-in-up"
                            style={{ animationDelay: '0.5s' }}
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Sparkles className="w-5 h-5" />
                            )}
                            {isLogin ? 'Sign In' : 'Create Account'}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-gray-400 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                        {isLogin ? "Don't have an account? " : 'Already have an account? '}
                        <button
                            type="button"
                            onClick={() => {
                                setIsLogin(!isLogin)
                                setShow2FA(false)
                            }}
                            className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors"
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </div>
                </div>

                {/* Bottom text */}
                <p className="text-center text-xs text-gray-600 mt-6 flex items-center justify-center gap-1 animate-fade-in-up" style={{ animationDelay: '0.7s' }}>
                    <Zap className="w-3 h-3" />
                    Powered by {panelName}
                </p>
            </div>
        </div>
    )
}
