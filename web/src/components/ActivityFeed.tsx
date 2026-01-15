import { Link } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import {
    Play,
    Square,
    RotateCcw,
    Plus,
    Trash2,
    User,
    HardDrive,
    Settings,
    Archive,
    Shield,
    Activity,
} from 'lucide-react'

interface ActivityItem {
    id: string
    action: string
    metadata?: any
    user: {
        username: string
    }
    createdAt: string
    ipAddress?: string
}

interface ActivityFeedProps {
    activities?: ActivityItem[]
    limit?: number
    className?: string
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    'server.start': { icon: Play, color: 'text-emerald-500', label: 'started server' },
    'server.stop': { icon: Square, color: 'text-red-400', label: 'stopped server' },
    'server.restart': { icon: RotateCcw, color: 'text-amber-500', label: 'restarted server' },
    'server.create': { icon: Plus, color: 'text-blue-500', label: 'created server' },
    'server.delete': { icon: Trash2, color: 'text-red-500', label: 'deleted server' },
    'user.login': { icon: User, color: 'text-green-500', label: 'logged in' },
    'user.logout': { icon: User, color: 'text-dark-400', label: 'logged out' },
    'user.create': { icon: User, color: 'text-blue-500', label: 'user created' },
    'backup.create': { icon: Archive, color: 'text-purple-500', label: 'created backup' },
    'backup.restore': { icon: Archive, color: 'text-amber-500', label: 'restored backup' },
    'node.create': { icon: HardDrive, color: 'text-blue-500', label: 'added node' },
    'settings.update': { icon: Settings, color: 'text-dark-400', label: 'updated settings' },
    'security.2fa_enabled': { icon: Shield, color: 'text-green-500', label: 'enabled 2FA' },
    'security.2fa_disabled': { icon: Shield, color: 'text-amber-500', label: 'disabled 2FA' },
}

function getActionConfig(action: string) {
    return ACTION_CONFIG[action] || { icon: Activity, color: 'text-dark-400', label: action }
}

export function ActivityFeed({ activities = [], limit = 10, className = '' }: ActivityFeedProps) {
    const displayedActivities = activities.slice(0, limit)

    if (displayedActivities.length === 0) {
        return (
            <div className={`bg-dark-900 border border-dark-700 rounded-sm ${className}`}>
                <div className="px-4 py-3 border-b border-dark-700 bg-black/20">
                    <h3 className="text-xs font-medium text-dark-400 uppercase tracking-wider">Recent Activity</h3>
                </div>
                <div className="p-8 text-center">
                    <Activity className="w-8 h-8 text-dark-600 mx-auto mb-2" />
                    <p className="text-dark-500 text-sm">No recent activity</p>
                </div>
            </div>
        )
    }

    return (
        <div className={`bg-dark-900 border border-dark-700 rounded-sm overflow-hidden ${className}`}>
            <div className="px-4 py-3 border-b border-dark-700 bg-black/20 flex items-center justify-between">
                <h3 className="text-xs font-medium text-dark-400 uppercase tracking-wider">Recent Activity</h3>
                <Link
                    to="/admin/audit-logs"
                    className="text-xs text-accent hover:text-white transition-colors font-mono"
                >
                    VIEW_ALL →
                </Link>
            </div>
            <div className="divide-y divide-dark-800">
                {displayedActivities.map((activity) => {
                    const config = getActionConfig(activity.action)
                    const Icon = config.icon
                    const serverName = activity.metadata?.serverName || 'Unknown'

                    return (
                        <div
                            key={activity.id}
                            className="px-4 py-3 hover:bg-dark-800/50 transition-colors"
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 ${config.color}`}>
                                    <Icon className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-white">
                                        <span className="font-medium text-accent">{activity.user.username}</span>
                                        {' '}
                                        <span className="text-dark-300">{config.label}</span>
                                        {activity.action.startsWith('server.') && activity.metadata?.serverName && (
                                            <>
                                                {' '}
                                                <span className="font-medium text-white">{serverName}</span>
                                            </>
                                        )}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs text-dark-500 font-mono">
                                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                                        </span>
                                        {activity.ipAddress && (
                                            <span className="text-xs text-dark-600 font-mono">
                                                • {activity.ipAddress}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// Compact version for sidebar/widget
export function CompactActivityFeed({ activities = [], limit = 5 }: ActivityFeedProps) {
    const displayedActivities = activities.slice(0, limit)

    return (
        <div className="space-y-2">
            {displayedActivities.map((activity) => {
                const config = getActionConfig(activity.action)
                const Icon = config.icon

                return (
                    <div key={activity.id} className="flex items-center gap-2 text-xs">
                        <Icon className={`w-3 h-3 ${config.color}`} />
                        <span className="text-dark-400 truncate flex-1">
                            <span className="text-white">{activity.user.username}</span> {config.label}
                        </span>
                        <span className="text-dark-600 font-mono shrink-0">
                            {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: false })}
                        </span>
                    </div>
                )
            })}
        </div>
    )
}
