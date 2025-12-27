import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../services/api'
import {
    Shield,
    Search,
    ChevronLeft,
    ChevronRight,
    User,
    Calendar,
    Code
} from 'lucide-react'

interface AuditLog {
    id: string
    userId: string
    action: string
    metadata: string | null
    ipAddress: string | null
    createdAt: string
    user: {
        username: string
        email: string
    }
}

interface AuditResponse {
    logs: AuditLog[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

export default function AuditLogs() {
    const [page, setPage] = useState(1)
    const [userId, setUserId] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['audit-logs', page, userId],
        queryFn: () => api.get<AuditResponse>(`/audit-logs?page=${page}&limit=20${userId ? `&userId=${userId}` : ''}`),
    })

    const logs = data?.logs || []
    const pagination = data?.pagination

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Audit Logs</h1>
                    <p className="text-dark-400">Track all system activities and user actions.</p>
                </div>
                <div className="p-3 bg-primary-500/10 rounded-xl">
                    <Shield className="w-8 h-8 text-primary-400" />
                </div>
            </div>

            {/* Filters */}
            <div className="card">
                <div className="flex gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                        <input
                            type="text"
                            placeholder="Filter by User ID..."
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            className="input pl-10 w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-dark-800/50 border-b border-white/5">
                                <th className="p-4 text-xs font-medium text-dark-400 uppercase">User</th>
                                <th className="p-4 text-xs font-medium text-dark-400 uppercase">Action</th>
                                <th className="p-4 text-xs font-medium text-dark-400 uppercase">IP Address</th>
                                <th className="p-4 text-xs font-medium text-dark-400 uppercase">Date</th>
                                <th className="p-4 text-xs font-medium text-dark-400 uppercase">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-dark-400">
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-dark-400">
                                        No audit logs found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center">
                                                    <User className="w-4 h-4 text-dark-300" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{log.user.username}</p>
                                                    <p className="text-xs text-dark-400">{log.user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <code className="px-2 py-1 bg-dark-800 rounded text-xs text-primary-400 font-mono">
                                                {log.action}
                                            </code>
                                        </td>
                                        <td className="p-4 text-sm text-dark-300">
                                            {log.ipAddress || '—'}
                                        </td>
                                        <td className="p-4 text-sm text-dark-300">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-3 h-3 text-dark-400" />
                                                {new Date(log.createdAt).toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {log.metadata ? (
                                                <div className="group relative">
                                                    <Code className="w-4 h-4 text-dark-400 cursor-help" />
                                                    <div className="absolute right-0 bottom-full mb-2 w-64 p-3 bg-dark-900 border border-white/10 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                                        <pre className="text-xs text-dark-300 overflow-x-auto">
                                                            {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                                                        </pre>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-dark-500">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between">
                        <p className="text-sm text-dark-400">
                            Page {pagination.page} of {pagination.totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="btn-secondary p-2 disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                disabled={page === pagination.totalPages}
                                className="btn-secondary p-2 disabled:opacity-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
