import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    Clock,
    Plus,
    Trash2,
    Play,
    Pause,
    Edit,
    X,
    CalendarDays,
    RotateCcw,
    Terminal,
    Power,
    Check
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'

interface Schedule {
    id: string
    name: string
    cron: string
    action: 'restart' | 'backup' | 'command' | 'power'
    payload: string | null
    isActive: boolean
    lastRunAt: string | null
    nextRunAt: string
    createdAt: string
}

interface ScheduleManagerProps {
    serverId: string
}

const actionIcons = {
    restart: RotateCcw,
    backup: Clock,
    command: Terminal,
    power: Power,
}

const actionLabels = {
    restart: 'Restart Server',
    backup: 'Create Backup',
    command: 'Run Command',
    power: 'Power Action',
}

// Common cron presets
const cronPresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Every 6 hours', value: '0 */6 * * *' },
    { label: 'Daily at midnight', value: '0 0 * * *' },
    { label: 'Daily at 3 AM', value: '0 3 * * *' },
    { label: 'Weekly (Sunday)', value: '0 0 * * 0' },
    { label: 'Monthly', value: '0 0 1 * *' },
]

export default function ScheduleManager({ serverId }: ScheduleManagerProps) {
    const [showCreate, setShowCreate] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        name: '',
        cron: '0 0 * * *',
        action: 'restart' as Schedule['action'],
        payload: '',
    })
    const queryClient = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['schedules', serverId],
        queryFn: () => api.get<{ schedules: Schedule[] }>(`/servers/${serverId}/schedules`),
    })

    const createMutation = useMutation({
        mutationFn: (data: typeof formData) =>
            api.post(`/servers/${serverId}/schedules`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules', serverId] })
            toast.success('Schedule created')
            resetForm()
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to create schedule')
        },
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> & { isActive?: boolean } }) =>
            api.patch(`/servers/${serverId}/schedules/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules', serverId] })
            toast.success('Schedule updated')
            resetForm()
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to update schedule')
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) =>
            api.delete(`/servers/${serverId}/schedules/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules', serverId] })
            toast.success('Schedule deleted')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to delete schedule')
        },
    })

    const executeMutation = useMutation({
        mutationFn: (id: string) =>
            api.post(`/servers/${serverId}/schedules/${id}/execute`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['schedules', serverId] })
            toast.success('Schedule executed')
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to execute schedule')
        },
    })

    const resetForm = () => {
        setFormData({ name: '', cron: '0 0 * * *', action: 'restart', payload: '' })
        setShowCreate(false)
        setEditingId(null)
    }

    const startEdit = (schedule: Schedule) => {
        setFormData({
            name: schedule.name,
            cron: schedule.cron,
            action: schedule.action,
            payload: schedule.payload || '',
        })
        setEditingId(schedule.id)
        setShowCreate(true)
    }

    const handleSubmit = () => {
        if (!formData.name.trim()) {
            toast.error('Name is required')
            return
        }

        if (editingId) {
            updateMutation.mutate({ id: editingId, data: formData })
        } else {
            createMutation.mutate(formData)
        }
    }

    const schedules = data?.schedules || []

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-dark-900 border border-dark-700 p-2 rounded-lg">
                <p className="text-sm text-dark-400 px-2">{schedules.length} scheduled tasks</p>
                <button
                    onClick={() => setShowCreate(true)}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Schedule
                </button>
            </div>

            {/* Schedule List */}
            {isLoading ? (
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-12 text-center">
                    <Clock className="w-6 h-6 mx-auto animate-pulse text-dark-400 mb-3" />
                    <p className="text-sm text-dark-400">Loading schedules...</p>
                </div>
            ) : schedules.length === 0 ? (
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-12 text-center">
                    <CalendarDays className="w-10 h-10 mx-auto text-dark-600 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium text-white mb-2">No Schedules</h3>
                    <p className="text-sm text-dark-400 mb-6">Automate tasks like restarts and backups</p>
                    <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
                        Create Schedule
                    </button>
                </div>
            ) : (
                <div className="grid gap-3">
                    {schedules.map((schedule) => {
                        const ActionIcon = actionIcons[schedule.action]
                        return (
                            <div key={schedule.id} className="bg-dark-900 border border-dark-700 rounded-lg p-4 flex items-center gap-4 group hover:border-dark-600 transition-colors">
                                <button
                                    onClick={() => updateMutation.mutate({
                                        id: schedule.id,
                                        data: { isActive: !schedule.isActive }
                                    })}
                                    className={`p-2 rounded-lg transition-colors ${schedule.isActive
                                        ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                                        : 'bg-dark-800 text-dark-400 hover:bg-dark-700 hover:text-white'
                                        }`}
                                    title={schedule.isActive ? 'Pause Schedule' : 'Activate Schedule'}
                                >
                                    {schedule.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium text-white truncate text-sm">{schedule.name}</h4>
                                        <span className="px-1.5 py-0.5 rounded bg-dark-800 border border-dark-700 text-[10px] text-dark-300 flex items-center gap-1 uppercase tracking-wider font-medium">
                                            <ActionIcon className="w-3 h-3" />
                                            {actionLabels[schedule.action]}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-dark-400">
                                        <code className="bg-dark-950 px-1.5 py-0.5 rounded text-primary-400 font-mono">{schedule.cron}</code>
                                        {schedule.nextRunAt && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-dark-700" />
                                                <span>Next: {new Date(schedule.nextRunAt).toLocaleString()}</span>
                                            </>
                                        )}
                                    </div>
                                    {schedule.payload && (
                                        <p className="text-xs text-dark-500 mt-1.5 font-mono bg-dark-950/50 px-2 py-1 rounded border border-dark-800/50 inline-block">
                                            {schedule.payload}
                                        </p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => executeMutation.mutate(schedule.id)}
                                        className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                                        title="Run Now"
                                    >
                                        <Play className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => startEdit(schedule)}
                                        className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                                        title="Edit"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (confirm('Delete this schedule?')) {
                                                deleteMutation.mutate(schedule.id)
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

            {/* Create/Edit Modal */}
            {showCreate && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-900 border border-dark-700 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-medium text-white">
                                {editingId ? 'Edit Schedule' : 'Create Schedule'}
                            </h3>
                            <button onClick={resetForm} className="text-dark-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-medium text-dark-400 mb-1.5 uppercase tracking-wider">Name</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Daily Restart"
                                    className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-dark-400 mb-1.5 uppercase tracking-wider">Action</label>
                                <select
                                    value={formData.action}
                                    onChange={(e) => setFormData({ ...formData, action: e.target.value as Schedule['action'] })}
                                    className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                                >
                                    <option value="restart">Restart Server</option>
                                    <option value="backup">Create Backup</option>
                                    <option value="command">Run Command</option>
                                    <option value="power">Power Action</option>
                                </select>
                            </div>

                            {formData.action === 'command' && (
                                <div>
                                    <label className="block text-xs font-medium text-dark-400 mb-1.5 uppercase tracking-wider">Command</label>
                                    <input
                                        type="text"
                                        value={formData.payload}
                                        onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
                                        placeholder="say Server restarting in 5 minutes!"
                                        className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 font-mono"
                                    />
                                </div>
                            )}

                            {formData.action === 'power' && (
                                <div>
                                    <label className="block text-xs font-medium text-dark-400 mb-1.5 uppercase tracking-wider">Power Action</label>
                                    <select
                                        value={formData.payload}
                                        onChange={(e) => setFormData({ ...formData, payload: e.target.value })}
                                        className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
                                    >
                                        <option value="start">Start</option>
                                        <option value="stop">Stop</option>
                                        <option value="restart">Restart</option>
                                        <option value="kill">Kill</option>
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-dark-400 mb-1.5 uppercase tracking-wider">Schedule (Cron)</label>
                                <input
                                    type="text"
                                    value={formData.cron}
                                    onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                                    placeholder="0 0 * * *"
                                    className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 font-mono mb-3"
                                />
                                <div className="flex flex-wrap gap-2">
                                    {cronPresets.map((preset) => (
                                        <button
                                            key={preset.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, cron: preset.value })}
                                            className={`text-[10px] px-2 py-1 rounded border transition-colors ${formData.cron === preset.value
                                                ? 'bg-primary-500/10 border-primary-500/50 text-primary-400'
                                                : 'bg-dark-800 border-dark-700 text-dark-400 hover:text-white hover:border-dark-600'
                                                }`}
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-dark-800">
                            <button onClick={resetForm} className="btn-secondary text-xs">
                                Cancel
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={createMutation.isPending || updateMutation.isPending}
                                className="btn-primary text-xs flex items-center gap-1.5"
                            >
                                <Check className="w-3.5 h-3.5" />
                                {editingId ? 'Save Changes' : 'Create Schedule'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
