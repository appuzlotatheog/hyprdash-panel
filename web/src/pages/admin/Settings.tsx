import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, Send, AlertCircle, Loader2, Settings as SettingsIcon } from 'lucide-react'
import { toast } from 'sonner'
import { settingsApi } from '../../services/api'

interface SmtpConfig {
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    from: string
}

export default function Settings() {
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState<'general' | 'mail'>('general')

    // General Settings State
    const [panelName, setPanelName] = useState('')

    // Mail Settings State
    const [testEmail, setTestEmail] = useState('')
    const [smtpData, setSmtpData] = useState<SmtpConfig>({
        host: '',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        from: '',
    })

    // Fetch Settings
    const { isLoading } = useQuery({
        queryKey: ['settings', 'all'],
        queryFn: async () => {
            // Fetch General Settings
            const general = await settingsApi.get()
            if (general.panel_name) setPanelName(general.panel_name)

            // Fetch SMTP Settings
            const smtp = await settingsApi.getSmtp()
            if (smtp.config) setSmtpData(smtp.config)

            return { general, smtp }
        },
    })

    // General Settings Mutation
    const generalMutation = useMutation({
        mutationFn: (data: { panel_name: string }) => settingsApi.update(data),
        onSuccess: () => {
            toast.success('Settings saved')
            queryClient.invalidateQueries({ queryKey: ['settings', 'public'] }) // Update layout
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to save settings')
        },
    })

    // SMTP Settings Mutation
    const smtpMutation = useMutation({
        mutationFn: (data: SmtpConfig) => settingsApi.updateSmtp(data),
        onSuccess: () => {
            toast.success('SMTP settings saved')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to save settings')
        },
    })

    const testEmailMutation = useMutation({
        mutationFn: (email: string) => settingsApi.testSmtp(email),
        onSuccess: () => {
            toast.success('Test email sent')
            setTestEmail('')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to send test email')
        },
    })

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
            </div>
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 rounded-xl bg-primary-500/10 text-primary-400">
                    <SettingsIcon className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-semibold text-white">System Settings</h1>
                    <p className="text-dark-400">Configure global panel settings</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-dark-700 mb-6">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general'
                        ? 'border-primary-500 text-white'
                        : 'border-transparent text-dark-400 hover:text-white'
                        }`}
                >
                    General
                </button>
                <button
                    onClick={() => setActiveTab('mail')}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'mail'
                        ? 'border-primary-500 text-white'
                        : 'border-transparent text-dark-400 hover:text-white'
                        }`}
                >
                    Mail
                </button>
            </div>

            {/* General Tab */}
            {activeTab === 'general' && (
                <div className="card space-y-6">
                    <h2 className="text-lg font-medium text-white border-b border-dark-700 pb-4">
                        Branding
                    </h2>
                    <form onSubmit={(e) => { e.preventDefault(); generalMutation.mutate({ panel_name: panelName }); }}>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Panel Name</label>
                                <input
                                    type="text"
                                    value={panelName}
                                    onChange={(e) => setPanelName(e.target.value)}
                                    placeholder="HyprDash"
                                    className="input w-full"
                                />
                                <p className="text-xs text-dark-500 mt-1">
                                    The name displayed in the navigation bar and page titles.
                                </p>
                            </div>
                        </div>
                        <div className="pt-4 mt-6 border-t border-dark-700 flex justify-end">
                            <button
                                type="submit"
                                disabled={generalMutation.isPending}
                                className="btn-primary flex items-center gap-2"
                            >
                                {generalMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Mail Tab */}
            {activeTab === 'mail' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <form onSubmit={(e) => { e.preventDefault(); smtpMutation.mutate(smtpData); }} className="card space-y-6">
                            <h2 className="text-lg font-medium text-white border-b border-dark-700 pb-4">
                                SMTP Configuration
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">SMTP Host</label>
                                    <input
                                        type="text"
                                        value={smtpData.host}
                                        onChange={(e) => setSmtpData({ ...smtpData, host: e.target.value })}
                                        placeholder="smtp.example.com"
                                        className="input w-full"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">SMTP Port</label>
                                    <input
                                        type="number"
                                        value={smtpData.port}
                                        onChange={(e) => setSmtpData({ ...smtpData, port: parseInt(e.target.value) })}
                                        placeholder="587"
                                        className="input w-full"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={smtpData.user}
                                        onChange={(e) => setSmtpData({ ...smtpData, user: e.target.value })}
                                        className="input w-full"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm text-dark-400 mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={smtpData.pass}
                                        onChange={(e) => setSmtpData({ ...smtpData, pass: e.target.value })}
                                        className="input w-full"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm text-dark-400 mb-1">From Address</label>
                                <input
                                    type="email"
                                    value={smtpData.from}
                                    onChange={(e) => setSmtpData({ ...smtpData, from: e.target.value })}
                                    placeholder="noreply@example.com"
                                    className="input w-full"
                                    required
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="secure"
                                    checked={smtpData.secure}
                                    onChange={(e) => setSmtpData({ ...smtpData, secure: e.target.checked })}
                                    className="rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-primary-500/20"
                                />
                                <label htmlFor="secure" className="text-sm text-dark-300">
                                    Use Secure Connection (SSL/TLS)
                                </label>
                            </div>

                            <div className="pt-4 border-t border-dark-700 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={smtpMutation.isPending}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    {smtpMutation.isPending ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="space-y-6">
                        <div className="card space-y-4">
                            <h2 className="text-lg font-medium text-white border-b border-dark-700 pb-4">
                                Test Configuration
                            </h2>
                            <p className="text-sm text-dark-400">
                                Send a test email to verify your SMTP settings are working correctly.
                            </p>

                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Recipient Email</label>
                                <input
                                    type="email"
                                    value={testEmail}
                                    onChange={(e) => setTestEmail(e.target.value)}
                                    placeholder="you@example.com"
                                    className="input w-full"
                                />
                            </div>

                            <button
                                onClick={() => testEmailMutation.mutate(testEmail)}
                                disabled={!testEmail || testEmailMutation.isPending}
                                className="btn-secondary w-full flex items-center justify-center gap-2"
                            >
                                {testEmailMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Send className="w-4 h-4" />
                                )}
                                Send Test Email
                            </button>
                        </div>

                        <div className="card bg-blue-500/5 border-blue-500/20">
                            <div className="flex gap-3">
                                <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
                                <div className="space-y-1">
                                    <h3 className="text-sm font-medium text-blue-400">Configuration Tips</h3>
                                    <ul className="text-xs text-blue-300/80 space-y-1 list-disc list-inside">
                                        <li>For Gmail, use port 587 and enable TLS</li>
                                        <li>Use an App Password if 2FA is enabled</li>
                                        <li>Check your spam folder for test emails</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
