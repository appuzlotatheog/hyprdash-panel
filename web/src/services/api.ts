import { useAuthStore } from '../stores/auth'

const API_BASE = '/api'

interface RequestOptions extends RequestInit {
    skipAuth?: boolean
}

class ApiClient {
    private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
        const { skipAuth, ...fetchOptions } = options
        const token = useAuthStore.getState().token

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...options.headers,
        }

        if (!skipAuth && token) {
            (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
        }

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...fetchOptions,
            headers,
        })

        if (response.status === 401) {
            useAuthStore.getState().logout()
            window.location.href = '/login'
            throw new Error('Unauthorized')
        }

        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || 'Request failed')
        }

        return data
    }

    get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' })
    }

    post<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        })
    }

    patch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        })
    }

    put<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        })
    }

    delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' })
    }
}

export const api = new ApiClient()

// Auth API
export const authApi = {
    login: (email: string, password: string, twoFactorCode?: string) =>
        api.post<{ user: any; token: string }>('/auth/login', { email, password, twoFactorCode }, { skipAuth: true }),

    register: (email: string, username: string, password: string) =>
        api.post<{ user: any; token: string }>('/auth/register', { email, username, password }, { skipAuth: true }),

    me: () => api.get<{ user: any }>('/auth/me'),

    enable2FA: () => api.post<{ secret: string; qrCode: string }>('/auth/2fa/enable'),

    verify2FA: (code: string) => api.post<{ message: string }>('/auth/2fa/verify', { code }),

    disable2FA: (code: string) => api.post<{ message: string }>('/auth/2fa/disable', { code }),

    changePassword: (currentPassword: string, newPassword: string) =>
        api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),
}

// Servers API
export const serversApi = {
    list: () => api.get<{ servers: any[] }>('/servers'),

    get: (id: string) => api.get<{ server: any }>(`/servers/${id}`),

    create: (data: any) => api.post<{ server: any }>('/servers', data),

    update: (id: string, data: any) => api.patch<{ server: any }>(`/servers/${id}`, data),

    delete: (id: string) => api.delete<{ message: string }>(`/servers/${id}`),

    power: (id: string, action: 'start' | 'stop' | 'restart' | 'kill') =>
        api.post<{ message: string }>(`/servers/${id}/power`, { action }),

    command: (id: string, command: string) =>
        api.post<{ message: string }>(`/servers/${id}/command`, { command }),

    addSubuser: (id: string, email: string, permissions: string) =>
        api.post<{ subuser: any }>(`/servers/${id}/users`, { email, permissions }),

    removeSubuser: (id: string, userId: string) =>
        api.delete<{ message: string }>(`/servers/${id}/users/${userId}`),

    updateSubuser: (id: string, userId: string, permissions: string) =>
        api.put<{ subuser: any }>(`/servers/${id}/users/${userId}`, { permissions }),
}

// Nodes API
export const nodesApi = {
    list: () => api.get<{ nodes: any[] }>('/nodes'),

    get: (id: string) => api.get<{ node: any }>(`/nodes/${id}`),

    create: (data: any) => api.post<{ node: any }>('/nodes', data),

    update: (id: string, data: any) => api.patch<{ node: any }>(`/nodes/${id}`, data),

    delete: (id: string) => api.delete<{ message: string }>(`/nodes/${id}`),

    stats: (id: string) => api.get<{ stats: any }>(`/nodes/${id}/stats`),

    addAllocations: (id: string, data: { ip: string; portStart: number; portEnd: number }) =>
        api.post<{ count: number }>(`/nodes/${id}/allocations`, data),
}

// Users API
export const usersApi = {
    list: () => api.get<{ users: any[] }>('/users'),

    get: (id: string) => api.get<{ user: any }>(`/users/${id}`),

    create: (data: any) => api.post<{ user: any }>('/users', data),

    update: (id: string, data: any) => api.patch<{ user: any }>(`/users/${id}`, data),

    delete: (id: string) => api.delete<{ message: string }>(`/users/${id}`),
}

// Eggs API
export const eggsApi = {
    list: () => api.get<{ eggs: any[] }>('/eggs'),

    get: (id: string) => api.get<{ egg: any }>(`/eggs/${id}`),

    create: (data: any) => api.post<{ egg: any }>('/eggs', data),

    update: (id: string, data: any) => api.patch<{ egg: any }>(`/eggs/${id}`, data),

    delete: (id: string) => api.delete<{ message: string }>(`/eggs/${id}`),

    import: (eggJson: any) => api.post<{ egg: any; message: string }>('/eggs/import', eggJson),

    export: (id: string) => api.get<any>(`/eggs/${id}/export`),

    addVariable: (id: string, data: any) => api.post<{ variable: any }>(`/eggs/${id}/variables`, data),

    updateVariable: (id: string, variableId: string, data: any) =>
        api.patch<{ variable: any }>(`/eggs/${id}/variables/${variableId}`, data),

    deleteVariable: (id: string, variableId: string) =>
        api.delete<{ message: string }>(`/eggs/${id}/variables/${variableId}`),
}

export const settingsApi = {
    getPublic: () => api.get<{ panel_name: string }>('/settings/public', { skipAuth: true }),
    get: () => api.get<{ panel_name: string }>('/settings'),
    update: (data: any) => api.post('/settings', data),
    getSmtp: () => api.get<{ config: any }>('/settings/smtp'),
    updateSmtp: (data: any) => api.post('/settings/smtp', data),
    testSmtp: (email: string) => api.post('/settings/smtp/test', { email }),
}

