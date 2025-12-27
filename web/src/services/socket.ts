import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../stores/auth'

interface FileInfo {
    name: string
    path: string
    isDirectory: boolean
    size: number
    modified: Date
}

class SocketService {
    private socket: Socket | null = null
    private requestId = 0
    private subscribedServers = new Set<string>()
    private subscribedNodes = new Set<string>()

    connect() {
        const token = useAuthStore.getState().token
        if (!token || this.socket?.connected) return

        this.socket = io('/', {
            auth: { token },
            reconnection: true,
            reconnectionDelay: 1000,
        })

        this.socket.on('connect', () => {
            console.log('WebSocket connected')
            // Resubscribe to everything on reconnect
            this.subscribedServers.forEach(id => {
                console.log(`[Socket] Resubscribing to server ${id}`)
                this.socket?.emit('server:subscribe', { serverId: id })
            })
            this.subscribedNodes.forEach(id => {
                this.socket?.emit('node:subscribe', { nodeId: id })
            })
        })

        this.socket.on('disconnect', () => {
            console.log('WebSocket disconnected')
        })

        this.socket.on('error', (error) => {
            console.error('WebSocket error:', error)
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

    private async waitForConnection(): Promise<void> {
        if (this.socket?.connected) return

        // If no socket, try to connect
        if (!this.socket) this.connect()

        return new Promise((resolve) => {
            if (this.socket?.connected) return resolve()

            const onConnect = () => {
                this.socket?.off('connect', onConnect)
                resolve()
            }
            this.socket?.once('connect', onConnect)

            // Timeout after 5s
            setTimeout(() => {
                this.socket?.off('connect', onConnect)
                resolve() // Resolve anyway to attempt emit
            }, 5000)
        })
    }

    private generateRequestId(): string {
        return `req-${Date.now()}-${++this.requestId}`
    }

    async subscribeToServer(serverId: string) {
        this.subscribedServers.add(serverId)
        await this.waitForConnection()
        console.log(`[Socket] Subscribing to server ${serverId}`)
        this.socket?.emit('server:subscribe', { serverId })
    }

    unsubscribeFromServer(serverId: string) {
        this.subscribedServers.delete(serverId)
        this.socket?.emit('server:unsubscribe', { serverId })
    }

    async subscribeToNode(nodeId: string) {
        this.subscribedNodes.add(nodeId)
        await this.waitForConnection()
        this.socket?.emit('node:subscribe', { nodeId })
    }

    unsubscribeFromNode(nodeId: string) {
        this.subscribedNodes.delete(nodeId)
        this.socket?.emit('node:unsubscribe', { nodeId })
    }

    onServerStatus(callback: (data: { serverId: string; status: string }) => void) {
        this.socket?.on('server:status', (data) => {
            console.log(`[Socket] Received server:status`, data)
            callback(data)
        })
        return () => this.socket?.off('server:status', callback)
    }

    onServerConsole(callback: (data: { serverId: string; line: string }) => void) {
        this.socket?.on('server:console', (data) => {
            console.log(`[Socket] Received server:console`, data.serverId, data.line.substring(0, 50))
            callback(data)
        })
        return () => this.socket?.off('server:console', callback)
    }

    onServerStats(callback: (data: { serverId: string; cpu: number; memory: number }) => void) {
        this.socket?.on('server:stats', (data) => {
            console.log(`[Socket] Received server:stats`, data)
            callback(data)
        })
        return () => this.socket?.off('server:stats', callback)
    }

    onNodeStats(callback: (data: { nodeId: string; cpu: number; memory: any; disk: any }) => void) {
        this.socket?.on('node:stats', callback)
        return () => this.socket?.off('node:stats', callback)
    }

    // Installation progress
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

    // File Operations
    async listFiles(serverId: string, path: string): Promise<FileInfo[]> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; files: FileInfo[] }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:list:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve(data.files)
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:list:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:list:response', handleResponse)
            this.socket?.on('files:error', handleError)
            this.socket?.emit('files:list', { serverId, path, requestId })

            setTimeout(() => {
                this.socket?.off('files:list:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 30000)
        })
    }

    async readFile(serverId: string, path: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; content: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:read:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve(data.content)
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:read:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:read:response', handleResponse)
            this.socket?.on('files:error', handleError)
            this.socket?.emit('files:read', { serverId, path, requestId })

            setTimeout(() => reject(new Error('Request timeout')), 30000)
        })
    }

    async writeFile(serverId: string, path: string, content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:write:response', handleResponse)
            this.socket?.on('files:error', handleError)
            this.socket?.emit('files:write', { serverId, path, content, requestId })

            setTimeout(() => reject(new Error('Request timeout')), 30000)
        })
    }

    async writeFileBinary(serverId: string, path: string, base64Content: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:write:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:write:response', handleResponse)
            this.socket?.on('files:error', handleError)
            // Send with isBinary flag so daemon knows to decode base64
            this.socket?.emit('files:write', { serverId, path, content: base64Content, isBinary: true, requestId })

            // Longer timeout for large files
            setTimeout(() => {
                this.socket?.off('files:write:response', handleResponse)
                this.socket?.off('files:error', handleError)
                reject(new Error('Request timeout'))
            }, 60000)
        })
    }

    async createFolder(serverId: string, path: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:mkdir:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:mkdir:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:mkdir:response', handleResponse)
            this.socket?.on('files:error', handleError)
            this.socket?.emit('files:mkdir', { serverId, path, requestId })

            setTimeout(() => reject(new Error('Request timeout')), 10000)
        })
    }

    async renameFile(serverId: string, from: string, to: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:rename:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:rename:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:rename:response', handleResponse)
            this.socket?.on('files:error', handleError)
            this.socket?.emit('files:rename', { serverId, from, to, requestId })

            setTimeout(() => reject(new Error('Request timeout')), 10000)
        })
    }

    async deleteFile(serverId: string, paths: string | string[]): Promise<void> {
        const pathsArray = Array.isArray(paths) ? paths : [paths]
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:delete:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:delete:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:delete:response', handleResponse)
            this.socket?.on('files:error', handleError)
            this.socket?.emit('files:delete', { serverId, paths: pathsArray, requestId })

            setTimeout(() => reject(new Error('Request timeout')), 10000)
        })
    }

    async copyFile(serverId: string, from: string, to: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const requestId = this.generateRequestId()

            const handleResponse = (data: { requestId: string; success: boolean }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:copy:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    resolve()
                }
            }

            const handleError = (data: { requestId: string; error: string }) => {
                if (data.requestId === requestId) {
                    this.socket?.off('files:copy:response', handleResponse)
                    this.socket?.off('files:error', handleError)
                    reject(new Error(data.error))
                }
            }

            this.socket?.on('files:copy:response', handleResponse)
            this.socket?.on('files:error', handleError)
            this.socket?.emit('files:copy', { serverId, from, to, requestId })

            setTimeout(() => reject(new Error('Request timeout')), 10000)
        })
    }
}

export const socketService = new SocketService()
export const getSocket = () => socketService.getSocket()

