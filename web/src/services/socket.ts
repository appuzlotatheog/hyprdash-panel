import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/auth'

interface FileInfo {
    name: string
    isDirectory: boolean
    size: number
    modifiedAt: string
}

// Simple socket service
class SocketService {
    private socket: Socket | null = null
    private requestId = 0
    private subscribedServers = new Set<string>()
    private subscribedNodes = new Set<string>()

    connect() {
        const token = useAuthStore.getState().token
        if (!token || this.socket?.connected) return

        // Connect to the panel API server
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000'
        console.log('[Socket] Connecting to:', apiUrl)

        this.socket = io(apiUrl, {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: Infinity,
            timeout: 20000,
            transports: ['websocket', 'polling'],
        })

        this.socket.on('connect', () => {
            console.log('[Socket] Connected!')
            // Resubscribe on reconnect
            this.subscribedServers.forEach(id => {
                this.socket?.emit('server:subscribe', { serverId: id })
            })
            this.subscribedNodes.forEach(id => {
                this.socket?.emit('node:subscribe', { nodeId: id })
            })
        })

        this.socket.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason)
        })

        this.socket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message)
        })
    }

    disconnect() {
        this.socket?.disconnect()
        this.socket = null
        this.subscribedServers.clear()
        this.subscribedNodes.clear()
    }

    getSocket() {
        return this.socket
    }

    isConnected(): boolean {
        return this.socket?.connected === true
    }

    private generateRequestId(): string {
        return `req-${Date.now()}-${++this.requestId}`
    }

    // Server subscriptions
    subscribeToServer(serverId: string) {
        this.subscribedServers.add(serverId)
        if (this.socket?.connected) {
            this.socket.emit('server:subscribe', { serverId })
        }
    }

    unsubscribeFromServer(serverId: string) {
        this.subscribedServers.delete(serverId)
        this.socket?.emit('server:unsubscribe', { serverId })
    }

    // Node subscriptions
    subscribeToNode(nodeId: string) {
        this.subscribedNodes.add(nodeId)
        if (this.socket?.connected) {
            this.socket.emit('node:subscribe', { nodeId })
        }
    }

    unsubscribeFromNode(nodeId: string) {
        this.subscribedNodes.delete(nodeId)
        this.socket?.emit('node:unsubscribe', { nodeId })
    }

    // Event listeners
    onServerStatus(callback: (data: { serverId: string; status: string }) => void) {
        this.socket?.on('server:status', callback)
        return () => this.socket?.off('server:status', callback)
    }

    onServerConsole(callback: (data: { serverId: string; line: string }) => void) {
        this.socket?.on('server:console', callback)
        return () => this.socket?.off('server:console', callback)
    }

    onServerStats(callback: (data: { serverId: string; cpu: number; memory: number }) => void) {
        this.socket?.on('server:stats', callback)
        return () => this.socket?.off('server:stats', callback)
    }

    onNodeStats(callback: (data: { nodeId: string; cpu: number; memory: any; disk: any }) => void) {
        this.socket?.on('node:stats', callback)
        return () => this.socket?.off('node:stats', callback)
    }

    onInstallProgress(callback: (data: { serverId: string; progress: number; message: string }) => void) {
        this.socket?.on('server:install:progress', callback)
        return () => this.socket?.off('server:install:progress', callback)
    }

    onInstallComplete(callback: (data: { serverId: string }) => void) {
        this.socket?.on('server:install:complete', callback)
        return () => this.socket?.off('server:install:complete', callback)
    }

    onInstallError(callback: (data: { serverId: string; error: string }) => void) {
        this.socket?.on('server:install:error', callback)
        return () => this.socket?.off('server:install:error', callback)
    }

    // File Operations with proper connection check
    async listFiles(serverId: string, path: string): Promise<FileInfo[]> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'))
                return
            }

            const requestId = this.generateRequestId()
            const timeout = setTimeout(() => {
                this.socket?.off('files:list:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 30000)

            const handleResponse = (data: { requestId: string; files: FileInfo[] }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:list:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve(data.files)
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:list:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket.on('files:list:response', handleResponse)
            this.socket.on('files:error', handleError)
            this.socket.emit('files:list', { serverId, path, requestId })
        })
    }

    async readFile(serverId: string, path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'))
                return
            }

            const requestId = this.generateRequestId()
            const timeout = setTimeout(() => {
                this.socket?.off('files:read:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 30000)

            const handleResponse = (data: { requestId: string; content: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:read:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve(data.content)
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:read:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket.on('files:read:response', handleResponse)
            this.socket.on('files:error', handleError)
            this.socket.emit('files:read', { serverId, path, requestId })
        })
    }

    async writeFile(serverId: string, path: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'))
                return
            }

            const requestId = this.generateRequestId()
            const timeout = setTimeout(() => {
                this.socket?.off('files:write:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 30000)

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket.on('files:write:response', handleResponse)
            this.socket.on('files:error', handleError)
            this.socket.emit('files:write', { serverId, path, content, requestId })
        })
    }

    async writeFileBinary(serverId: string, path: string, base64Content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'))
                return
            }

            const requestId = this.generateRequestId()
            const timeout = setTimeout(() => {
                this.socket?.off('files:write:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 60000)

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket.on('files:write:response', handleResponse)
            this.socket.on('files:error', handleError)
            this.socket.emit('files:write', { serverId, path, content: base64Content, isBinary: true, requestId })
        })
    }

    async createFolder(serverId: string, path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'))
                return
            }

            const requestId = this.generateRequestId()
            const timeout = setTimeout(() => {
                this.socket?.off('files:mkdir:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 10000)

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:mkdir:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:mkdir:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket.on('files:mkdir:response', handleResponse)
            this.socket.on('files:error', handleError)
            this.socket.emit('files:mkdir', { serverId, path, requestId })
        })
    }

    async renameFile(serverId: string, from: string, to: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'))
                return
            }

            const requestId = this.generateRequestId()
            const timeout = setTimeout(() => {
                this.socket?.off('files:rename:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 10000)

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:rename:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:rename:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket.on('files:rename:response', handleResponse)
            this.socket.on('files:error', handleError)
            this.socket.emit('files:rename', { serverId, from, to, requestId })
        })
    }

    async deleteFile(serverId: string, paths: string | string[]): Promise<void> {
        const pathsArray = Array.isArray(paths) ? paths : [paths]
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Socket not connected'))
                return
            }

            const requestId = this.generateRequestId()
            const timeout = setTimeout(() => {
                this.socket?.off('files:delete:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 30000)

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:delete:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    clearTimeout(timeout)
                    this.socket?.off('files:delete:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket.on('files:delete:response', handleResponse)
            this.socket.on('files:error', handleError)
            this.socket.emit('files:delete', { serverId, paths: pathsArray, requestId })
        })
    }

    // Server commands
    sendCommand(serverId: string, command: string) {
        this.socket?.emit('server:command', { serverId, command })
    }
}

export const socketService = new SocketService()

// Standalone export for compatibility
export const getSocket = () => socketService.getSocket()
