import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Webhook,
    Plus,
    Trash2,
    Play,
    Check,
    X,
    Send,
    Bell,
    User,
    Archive,
    AlertTriangle
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../services/api'

interface WebhookConfig {
    id: string
    name: string
    url: string
    type: 'discord' | 'slack' | 'generic'
    events: string[]
    isActive: boolean
    lastTriggered?: string
    createdAt: string
}

const AVAILABLE_EVENTS = [
    { id: 'server.start', label: 'Server Started', icon: Play, category: 'Server' },
    { id: 'server.stop', label: 'Server Stopped', icon: X, category: 'Server' },
    { id: 'server.create', label: 'Server Created', icon: Plus, category: 'Server' },
    { id: 'server.delete', label: 'Server Deleted', icon: Trash2, category: 'Server' },
    { id: 'backup.create', label: 'Backup Created', icon: Archive, category: 'Backup' },
    { id: 'backup.restore', label: 'Backup Restored', icon: Archive, category: 'Backup' },
    { id: 'user.login', label: 'User Login', icon: User, category: 'User' },
    { id: 'user.create', label: 'User Created', icon: User, category: 'User' },
    { id: 'node.offline', label: 'Node Offline', icon: AlertTriangle, category: 'Node' },
    { id: 'node.online', label: 'Node Online', icon: Check, category: 'Node' },
]

export default function Webhooks() {
    const queryClient = useQueryClient()
    const [showCreate, setShowCreate] = useState(false)

    // Form state
    const [name, setName] = useState('')
    const [url, setUrl] = useState('')
    const [type, setType] = useState<'discord' | 'slack' | 'generic'>('discord')
    const [selectedEvents, setSelectedEvents] = useState<string[]>([])

    // Simulated query - in real app this would fetch from API
    const { data, isLoading } = useQuery({
        queryKey: ['webhooks'],
        queryFn: async () => {
            // Placeholder - implement actual API endpoint
            return { webhooks: [] as WebhookConfig[] }
        },
    })

    const webhooks = data?.webhooks || []

    const createMutation = useMutation({
        mutationFn: (data: { name: string; url: string; type: string; events: string[] }) =>
            api.post('/webhooks', data),
        onSuccess: () => {
            toast.success('Webhook created')
            queryClient.invalidateQueries({ queryKey: ['webhooks'] })
            resetForm()
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create webhook')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/webhooks/${id}`),
        onSuccess: () => {
            toast.success('Webhook deleted')
            queryClient.invalidateQueries({ queryKey: ['webhooks'] })
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to delete webhook')
        },
    })

    const testMutation = useMutation({
        mutationFn: (id: string) => api.post(`/webhooks/${id}/test`),
        onSuccess: () => {
            toast.success('Test message sent')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to send test')
        },
    })

    const toggleMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
            api.patch(`/webhooks/${id}`, { isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['webhooks'] })
        },
    })

    const resetForm = () => {
        setShowCreate(false)
        setName('')
        setUrl('')
        setType('discord')
        setSelectedEvents([])
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!name || !url || selectedEvents.length === 0) {
            toast.error('Please fill in all fields')
            return
        }

        createMutation.mutate({ name, url, type, events: selectedEvents })
    }

    const toggleEvent = (eventId: string) => {
        setSelectedEvents(prev =>
            prev.includes(eventId)
                ? prev.filter(e => e !== eventId)
                : [...prev, eventId]
        )
    }

    const groupedEvents = AVAILABLE_EVENTS.reduce((acc, event) => {
        if (!acc[event.category]) acc[event.category] = []
        acc[event.category].push(event)
        return acc
    }, {} as Record<string, typeof AVAILABLE_EVENTS>)

    return (
        <div className="max-w-[1200px] mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-end justify-between border-b border-dark-800 pb-4">
                <div>
                    <h1 className="text-2xl font-semibold text-white mb-1 tracking-tight">Webhooks</h1>
                    <p className="text-dark-400 text-sm font-mono">Configure external integrations</p>
                </div>
                <button
                    onClick={() => setShowCreate(true)}
                    className="btn btn-primary text-xs"
                >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Webhook
                </button>
            </div>

            {/* Create/Edit Form */}
            {showCreate && (
                <div className="bg-dark-900 border border-dark-700 rounded-sm p-6">
                    <h2 className="text-lg font-medium text-white mb-4">New Webhook</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-dark-400 uppercase tracking-wider mb-2">Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="My Discord Webhook"
                                    className="w-full bg-dark-800 border border-dark-600 rounded-sm px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-dark-400 uppercase tracking-wider mb-2">Type</label>
                                <select
                                    value={type}
                                    onChange={(e) => setType(e.target.value as any)}
                                    className="w-full bg-dark-800 border border-dark-600 rounded-sm px-3 py-2 text-sm text-white focus:border-accent focus:outline-none"
                                >
                                    <option value="discord">Discord</option>
                                    <option value="slack">Slack</option>
                                    <option value="generic">Generic (HTTP POST)</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-dark-400 uppercase tracking-wider mb-2">Webhook URL</label>
                            <input
                                type="url"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                placeholder="https://discord.com/api/webhooks/..."
                                className="w-full bg-dark-800 border border-dark-600 rounded-sm px-3 py-2 text-sm text-white font-mono focus:border-accent focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs text-dark-400 uppercase tracking-wider mb-2">Events</label>
                            <div className="bg-dark-800 border border-dark-600 rounded-sm p-4 space-y-4">
                                {Object.entries(groupedEvents).map(([category, events]) => (
                                    <div key={category}>
                                        <p className="text-xs text-dark-500 uppercase tracking-wider mb-2">{category}</p>
                                        <div className="flex flex-wrap gap-2">
                                            {events.map(event => (
                                                <button
                                                    key={event.id}
                                                    type="button"
                                                    onClick={() => toggleEvent(event.id)}
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border transition-colors ${selectedEvents.includes(event.id)
                                                        ? 'bg-accent/20 border-accent text-accent'
                                                        : 'bg-dark-900 border-dark-700 text-dark-400 hover:text-white'
                                                        }`}
                                                >
                                                    <event.icon className="w-3 h-3" />
                                                    {event.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={resetForm}
                                className="btn btn-secondary text-xs"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={createMutation.isPending}
                                className="btn btn-primary text-xs"
                            >
                                {createMutation.isPending ? 'Creating...' : 'Create Webhook'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Webhook List */}
            <div className="space-y-4">
                {isLoading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-24 bg-dark-800 rounded-sm animate-pulse" />
                    ))
                ) : webhooks.length > 0 ? (
                    webhooks.map(webhook => (
                        <div
                            key={webhook.id}
                            className="bg-dark-900 border border-dark-700 rounded-sm p-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-sm ${webhook.type === 'discord' ? 'bg-indigo-500/10 text-indigo-400' :
                                        webhook.type === 'slack' ? 'bg-green-500/10 text-green-400' :
                                            'bg-dark-800 text-dark-400'
                                        }`}>
                                        <Webhook className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-white font-medium">{webhook.name}</h3>
                                            <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${webhook.isActive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-dark-700 text-dark-500'
                                                }`}>
                                                {webhook.isActive ? 'Active' : 'Disabled'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-dark-500 font-mono mb-2 truncate max-w-md">{webhook.url}</p>
                                        <div className="flex flex-wrap gap-1">
                                            {webhook.events.slice(0, 3).map(event => (
                                                <span key={event} className="text-[10px] bg-dark-800 text-dark-400 px-1.5 py-0.5 rounded">
                                                    {event}
                                                </span>
                                            ))}
                                            {webhook.events.length > 3 && (
                                                <span className="text-[10px] text-dark-500">+{webhook.events.length - 3} more</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => testMutation.mutate(webhook.id)}
                                        disabled={testMutation.isPending}
                                        className="p-2 text-dark-400 hover:text-accent transition-colors"
                                        title="Test Webhook"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => toggleMutation.mutate({ id: webhook.id, isActive: !webhook.isActive })}
                                        className="p-2 text-dark-400 hover:text-white transition-colors"
                                        title={webhook.isActive ? 'Disable' : 'Enable'}
                                    >
                                        {webhook.isActive ? <Bell className="w-4 h-4" /> : <Bell className="w-4 h-4 opacity-50" />}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm('Delete this webhook?')) {
                                                deleteMutation.mutate(webhook.id)
                                            }
                                        }}
                                        className="p-2 text-dark-400 hover:text-red-400 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="bg-dark-900 border border-dark-700 rounded-sm p-12 text-center">
                        <Webhook className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                        <p className="text-white font-medium mb-1">No webhooks configured</p>
                        <p className="text-dark-500 text-sm mb-4">
                            Set up webhooks to receive notifications in Discord, Slack, or other services
                        </p>
                        <button
                            onClick={() => setShowCreate(true)}
                            className="btn btn-secondary text-xs"
                        >
                            <Plus className="w-3 h-3 mr-1" />
                            Add Your First Webhook
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
