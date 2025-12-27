import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
    LayoutDashboard,
    Server,
    HardDrive,
    Users,
    Settings,
    LogOut,
    Menu,
    Gamepad2,
    Box,
    Sparkles,
    Shield,
    FolderGit2,
    ChevronRight
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth'
import { socketService } from '../services/socket'
import { settingsApi } from '../services/api'

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Servers', href: '/servers', icon: Server },
    { name: 'Nodes', href: '/nodes', icon: HardDrive },
    { name: 'Eggs', href: '/admin/eggs', icon: Box, adminOnly: true },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield, adminOnly: true },
    { name: 'Mounts', href: '/admin/mounts', icon: FolderGit2, adminOnly: true },
    { name: 'Settings', href: '/admin/settings', icon: Settings, adminOnly: true },
    { name: 'Users', href: '/users', icon: Users },
]

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const { user, logout } = useAuthStore()
    const navigate = useNavigate()
    const location = useLocation()

    const { data: settings } = useQuery({
        queryKey: ['settings', 'public'],
        queryFn: settingsApi.getPublic,
        staleTime: 1000 * 60 * 5, // 5 minutes
    })

    const panelName = settings?.panel_name || 'HyprDash'

    useEffect(() => {
        socketService.connect()
        return () => socketService.disconnect()
    }, [])

    // Close sidebar on route change (mobile)
    useEffect(() => {
        setSidebarOpen(false)
    }, [location])

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <div className="min-h-screen bg-dark-950 flex">
            {/* Mobile sidebar backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar */}
            <aside className={`
                fixed top-0 left-0 z-50 h-full w-64 lg:w-14 lg:hover:w-64 transform transition-all duration-300 ease-in-out
                bg-black border-r border-dark-700 flex flex-col group
                lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Logo */}
                <div className="h-14 flex items-center px-3.5 border-b border-dark-700">
                    <div className="flex items-center gap-3 min-w-max">
                        <div className="w-7 h-7 rounded-sm bg-white flex items-center justify-center text-black">
                            <Gamepad2 className="w-4 h-4" />
                        </div>
                        <span className="font-semibold text-white text-sm opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 lg:hidden lg:group-hover:block tracking-tight">
                            {panelName}
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto overflow-x-hidden">
                    {navigation
                        .filter(item => !item.adminOnly || user?.role === 'ADMIN')
                        .map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={({ isActive }) => `
                                    flex items-center gap-3 px-3.5 py-2 mx-2 rounded-sm transition-all duration-200 min-w-max group/item
                                    ${isActive
                                        ? 'bg-dark-900 text-white border border-dark-700'
                                        : 'text-dark-400 hover:text-white hover:bg-dark-900 border border-transparent'
                                    }
                                `}
                            >
                                <item.icon className="w-5 h-5 min-w-[20px]" />
                                <span className="font-medium text-sm opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 lg:hidden lg:group-hover:block">
                                    {item.name}
                                </span>
                            </NavLink>
                        ))}
                </nav>

                {/* User section */}
                <div className="p-3 border-t border-dark-700 bg-black">
                    <div className="flex items-center gap-3 min-w-max">
                        <div className="w-8 h-8 rounded-sm bg-dark-900 flex items-center justify-center text-white font-medium border border-dark-700">
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 lg:hidden lg:group-hover:block">
                            <p className="text-sm font-medium text-white truncate">{user?.username}</p>
                            <p className="text-xs text-dark-400 truncate font-mono">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 rounded-sm text-dark-400 hover:text-red-500 hover:bg-red-500/10 transition-colors opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 lg:hidden lg:group-hover:block"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 lg:pl-14 min-h-screen flex flex-col transition-all duration-300 bg-black">
                {/* Top bar */}
                <header className="h-14 border-b border-dark-700 bg-black/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-30">
                    <div className="flex items-center gap-4">
                        <button
                            className="lg:hidden p-2 -ml-2 text-dark-400 hover:text-white"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-2 text-sm font-medium text-dark-400">
                            <span className="hover:text-white cursor-pointer transition-colors">{panelName}</span>
                            {location.pathname !== '/' && (
                                <>
                                    <ChevronRight className="w-4 h-4 text-dark-600" />
                                    <span className="text-white capitalize">
                                        {location.pathname.split('/')[1] || 'Dashboard'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-sm text-xs font-mono border ${user?.role === 'ADMIN'
                            ? 'bg-dark-900 text-white border-dark-700'
                            : 'bg-dark-900 text-dark-400 border-dark-700'
                            }`}>
                            <Sparkles className="w-3 h-3" />
                            {user?.role}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 p-6 overflow-x-hidden">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
