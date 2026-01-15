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
    ChevronRight,
    Activity,
    Webhook
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../stores/auth'
import { socketService } from '../services/socket'
import { settingsApi } from '../services/api'
import { ThemeToggle } from './ThemeProvider'

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Servers', href: '/servers', icon: Server },
    { name: 'Nodes', href: '/nodes', icon: HardDrive },
    { name: 'Users', href: '/users', icon: Users },
    { name: 'Eggs', href: '/admin/eggs', icon: Box, adminOnly: true },
    { name: 'Node Health', href: '/admin/node-health', icon: Activity, adminOnly: true },
    { name: 'Webhooks', href: '/admin/webhooks', icon: Webhook, adminOnly: true },
    { name: 'Audit Logs', href: '/admin/audit-logs', icon: Shield, adminOnly: true },
    { name: 'Mounts', href: '/admin/mounts', icon: FolderGit2, adminOnly: true },
    { name: 'Settings', href: '/admin/settings', icon: Settings, adminOnly: true },
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
        <div className="min-h-screen flex relative overflow-hidden">
            {/* Background Mesh (Global overlap handled in App.tsx but good to ensure here too if needed) */}

            {/* Mobile sidebar backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={() => setSidebarOpen(false)}
            />

            {/* Floating Sidebar */}
            <aside className={`
                fixed top-4 bottom-4 left-4 z-50 rounded-2xl glass-panel flex flex-col group transition-all duration-300 ease-out border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.3)]
                ${sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-[calc(100%+1rem)] lg:translate-x-0 lg:w-20 lg:hover:w-64'}
            `}>
                {/* Logo */}
                <div className="h-24 flex items-center justify-center lg:justify-start lg:px-5 border-b border-white/5 relative overflow-hidden">
                    {/* Glow effect behind logo */}
                    <div className="absolute top-1/2 left-10 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-blue-500/20 blur-3xl rounded-full pointer-events-none" />

                    <div className="flex items-center gap-4 min-w-max relative z-10">
                        {/* Unique "Real Finish" Icon */}
                        <div className="w-10 h-10 relative flex items-center justify-center">
                            <div className="absolute inset-0 bg-blue-600 rounded-xl rotate-3 opacity-50 blur-[1px]"></div>
                            <div className="absolute inset-0 bg-indigo-600 rounded-xl -rotate-3 opacity-50 blur-[1px]"></div>
                            <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white shadow-glow-md border border-white/20">
                                <Gamepad2 className="w-5 h-5 drop-shadow-[0_2px_3px_rgba(0,0,0,0.3)]" />
                            </div>
                        </div>

                        <div className="flex flex-col opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 lg:hidden lg:group-hover:flex">
                            <span className="font-bold text-lg text-transparent bg-clip-text bg-gradient-to-r from-white to-blue-200 tracking-wide whitespace-nowrap leading-none">
                                {panelName}
                            </span>
                            <span className="text-[10px] text-blue-400 font-mono tracking-widest uppercase mt-0.5">Control Panel</span>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-thin">
                    {navigation
                        .filter(item => !item.adminOnly || user?.role === 'ADMIN')
                        .map((item) => (
                            <NavLink
                                key={item.name}
                                to={item.href}
                                className={({ isActive }) => `
                                    flex items-center gap-4 px-3 py-3 rounded-xl transition-all duration-300 min-w-max group/item relative overflow-hidden
                                    ${isActive
                                        ? 'bg-gradient-to-r from-blue-600/20 to-blue-600/5 text-white shadow-glow-sm border border-blue-500/10'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5 hover:border-white/5 border border-transparent'
                                    }
                                `}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" />
                                        )}
                                        <item.icon className={`w-5 h-5 min-w-[20px] transition-colors duration-300 ${isActive ? 'text-blue-400' : 'text-gray-400 group-hover/item:text-white'}`} />
                                        <span className="font-medium text-sm opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 lg:hidden lg:group-hover:block whitespace-nowrap">
                                            {item.name}
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        ))}
                </nav>

                {/* User section */}
                <div className="p-4 border-t border-white/5 bg-black/20 rounded-b-2xl backdrop-blur-sm">
                    <div className="flex items-center gap-4 min-w-max">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-white font-bold border border-white/10 shadow-inner relative overflow-hidden group/user">
                            <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/user:opacity-100 transition-opacity" />
                            {user?.username?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 opacity-0 lg:group-hover:opacity-100 transition-opacity duration-300 lg:hidden lg:group-hover:block">
                            <p className="text-sm font-semibold text-white truncate">{user?.username}</p>
                            <p className="text-xs text-gray-500 truncate font-mono">{user?.email}</p>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 opacity-0 lg:group-hover:opacity-100 lg:hidden lg:group-hover:block border border-transparent hover:border-red-500/20"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 lg:ml-28 transition-all duration-300 min-h-screen flex flex-col mr-4 my-4">
                {/* Top bar (Floating Glass) */}
                <header className="h-16 rounded-2xl glass-panel mb-6 flex items-center justify-between px-6 sticky top-4 z-30 transition-all duration-300">
                    <div className="flex items-center gap-4">
                        <button
                            className="lg:hidden p-2 -ml-2 text-gray-400 hover:text-white"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </button>

                        {/* Breadcrumbs */}
                        <div className="flex items-center gap-3 text-sm">
                            <span className="text-gray-400 hover:text-white cursor-pointer transition-colors font-medium">{panelName}</span>
                            {location.pathname !== '/' && (
                                <>
                                    <ChevronRight className="w-4 h-4 text-gray-600" />
                                    <span className="text-white font-semibold capitalize bg-white/5 px-2 py-1 rounded-md border border-white/5">
                                        {location.pathname.split('/')[1] || 'Dashboard'}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right side actions */}
                    <div className="flex items-center gap-4">
                        <ThemeToggle />
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border ${user?.role === 'ADMIN'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]'
                            : 'bg-gray-800/50 text-gray-400 border-white/5'
                            }`}>
                            <Sparkles className="w-3.5 h-3.5" />
                            <span className="font-semibold tracking-wide">{user?.role}</span>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 relative">
                    <div className="animate-fade-in-up">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    )
}
