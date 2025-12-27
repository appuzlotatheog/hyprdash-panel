import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
    User,
    Lock,
    Shield,
    Key,
    Smartphone
} from 'lucide-react'
import { toast } from 'sonner'
import { authApi } from '../services/api'
import { useAuthStore } from '../stores/auth'

export default function Settings() {
    const { user, updateUser } = useAuthStore()
    const [activeTab, setActiveTab] = useState('account')

    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })

    const [twoFAData, setTwoFAData] = useState<{ secret: string; qrCode: string } | null>(null)
    const [twoFACode, setTwoFACode] = useState('')

    const passwordMutation = useMutation({
        mutationFn: () => authApi.changePassword(passwords.currentPassword, passwords.newPassword),
        onSuccess: () => {
            toast.success('Password changed successfully')
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' })
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to change password')
        },
    })

    const enable2FAMutation = useMutation({
        mutationFn: authApi.enable2FA,
        onSuccess: (data) => {
            setTwoFAData(data)
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to enable 2FA')
        },
    })

    const verify2FAMutation = useMutation({
        mutationFn: (code: string) => authApi.verify2FA(code),
        onSuccess: () => {
            toast.success('2FA enabled successfully')
            updateUser({ twoFactorEnabled: true })
            setTwoFAData(null)
            setTwoFACode('')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Invalid code')
        },
    })

    const disable2FAMutation = useMutation({
        mutationFn: (code: string) => authApi.disable2FA(code),
        onSuccess: () => {
            toast.success('2FA disabled')
            updateUser({ twoFactorEnabled: false })
            setTwoFACode('')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Invalid code')
        },
    })

    const handlePasswordChange = (e: React.FormEvent) => {
        e.preventDefault()
        if (passwords.newPassword !== passwords.confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (passwords.newPassword.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }
        passwordMutation.mutate()
    }

    const tabs = [
        { id: 'account', label: 'Account', icon: User },
        { id: 'security', label: 'Security', icon: Lock },
        { id: '2fa', label: 'Two-Factor Auth', icon: Smartphone },
        { id: 'api', label: 'API Keys', icon: Key },
    ]

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-white">Settings</h1>
                <p className="text-dark-400">Manage your account settings</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Sidebar */}
                <div className="lg:w-64 flex-shrink-0">
                    <nav className="card p-2 space-y-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                  ${activeTab === tab.id
                                        ? 'bg-primary-600/20 text-primary-400'
                                        : 'text-dark-300 hover:text-white hover:bg-dark-800/50'
                                    }`}
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                {/* Content */}
                <div className="flex-1">
                    {activeTab === 'account' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-white mb-4">Account Information</h2>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-2xl font-bold text-white">
                                        {user?.username?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-xl font-medium text-white">{user?.username}</p>
                                        <p className="text-dark-400">{user?.email}</p>
                                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${user?.role === 'ADMIN'
                                                ? 'bg-primary-500/20 text-primary-400'
                                                : 'bg-dark-700 text-dark-300'
                                            }`}>
                                            {user?.role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'security' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-white mb-4">Change Password</h2>
                            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-md">
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Current Password</label>
                                    <input
                                        type="password"
                                        value={passwords.currentPassword}
                                        onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                                        className="input w-full"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={passwords.newPassword}
                                        onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                                        className="input w-full"
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        value={passwords.confirmPassword}
                                        onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                                        className="input w-full"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={passwordMutation.isPending}
                                >
                                    {passwordMutation.isPending ? 'Changing...' : 'Change Password'}
                                </button>
                            </form>
                        </div>
                    )}

                    {activeTab === '2fa' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-white mb-4">Two-Factor Authentication</h2>

                            {user?.twoFactorEnabled ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                        <Shield className="w-6 h-6 text-green-400" />
                                        <div>
                                            <p className="font-medium text-green-400">2FA is enabled</p>
                                            <p className="text-sm text-dark-400">Your account is protected with two-factor authentication</p>
                                        </div>
                                    </div>

                                    <div className="max-w-md">
                                        <p className="text-sm text-dark-400 mb-2">Enter your 2FA code to disable:</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={twoFACode}
                                                onChange={(e) => setTwoFACode(e.target.value)}
                                                className="input flex-1 text-center tracking-widest"
                                                placeholder="000000"
                                                maxLength={6}
                                            />
                                            <button
                                                onClick={() => disable2FAMutation.mutate(twoFACode)}
                                                className="btn-danger"
                                                disabled={disable2FAMutation.isPending || twoFACode.length !== 6}
                                            >
                                                Disable 2FA
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : twoFAData ? (
                                <div className="space-y-4">
                                    <p className="text-dark-300">Scan this QR code with your authenticator app:</p>
                                    <div className="bg-white p-4 rounded-lg w-fit">
                                        <img src={twoFAData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                                    </div>
                                    <p className="text-sm text-dark-400">Or enter this code manually: <code className="px-2 py-1 bg-dark-800 rounded">{twoFAData.secret}</code></p>

                                    <div className="max-w-md">
                                        <p className="text-sm text-dark-400 mb-2">Enter the code from your app to verify:</p>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={twoFACode}
                                                onChange={(e) => setTwoFACode(e.target.value)}
                                                className="input flex-1 text-center tracking-widest"
                                                placeholder="000000"
                                                maxLength={6}
                                            />
                                            <button
                                                onClick={() => verify2FAMutation.mutate(twoFACode)}
                                                className="btn-primary"
                                                disabled={verify2FAMutation.isPending || twoFACode.length !== 6}
                                            >
                                                Verify
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-dark-300">Add an extra layer of security to your account by enabling two-factor authentication.</p>
                                    <button
                                        onClick={() => enable2FAMutation.mutate()}
                                        className="btn-primary"
                                        disabled={enable2FAMutation.isPending}
                                    >
                                        {enable2FAMutation.isPending ? 'Setting up...' : 'Enable 2FA'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="card">
                            <h2 className="text-lg font-semibold text-white mb-4">API Keys</h2>
                            <p className="text-dark-400 mb-4">API keys allow external applications to interact with your account.</p>
                            <div className="p-8 border-2 border-dashed border-dark-700 rounded-lg text-center">
                                <Key className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                                <p className="text-dark-400">API key management coming soon</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
