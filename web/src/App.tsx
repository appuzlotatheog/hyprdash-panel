import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import AcceptInvitation from './pages/AcceptInvitation'
import Dashboard from './pages/Dashboard'
import Servers from './pages/Servers'
import ServerView from './pages/ServerView'
import CreateServer from './pages/CreateServer'
import Nodes from './pages/Nodes'
import Users from './pages/Users'
import Settings from './pages/admin/Settings'
import Eggs from './pages/Eggs'
import EggEditor from './pages/EggEditor'
import AuditLogs from './pages/admin/AuditLogs'
import Mounts from './pages/admin/Mounts'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/invite/:token" element={<AcceptInvitation />} />
            <Route
                path="/"
                element={
                    <ProtectedRoute>
                        <Layout />
                    </ProtectedRoute>
                }
            >
                <Route index element={<Dashboard />} />
                <Route path="servers" element={<Servers />} />
                <Route path="servers/create" element={<CreateServer />} />
                <Route path="servers/:id" element={<ServerView />} />
                <Route path="nodes" element={<Nodes />} />
                <Route path="users" element={<Users />} />
                <Route path="admin/settings" element={<Settings />} />
                <Route path="admin/eggs" element={<Eggs />} />
                <Route path="admin/eggs/:id" element={<EggEditor />} />
                <Route path="admin/eggs/:id" element={<EggEditor />} />
                <Route path="admin/mounts" element={<Mounts />} />
                <Route path="admin/audit-logs" element={<AuditLogs />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default App

