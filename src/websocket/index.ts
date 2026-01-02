import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    nodeId?: string;
    nodeToken?: string;
}

export function setupWebSocket(io: SocketServer) {
    // Authentication middleware
    io.use(async (socket: AuthenticatedSocket, next) => {
        try {
            const token = socket.handshake.auth.token;
            const nodeToken = socket.handshake.auth.nodeToken;

            // Check if this is a daemon connection
            if (nodeToken) {
                const node = await prisma.node.findUnique({
                    where: { token: nodeToken },
                });

                if (!node) {
                    return next(new Error('Invalid node token'));
                }

                socket.nodeId = node.id;
                socket.nodeToken = nodeToken;
                return next();
            }

            // Check if this is a user connection
            if (token) {
                const secret = process.env.JWT_SECRET || 'fallback-secret';
                const decoded = jwt.verify(token, secret) as { userId: string };

                const user = await prisma.user.findUnique({
                    where: { id: decoded.userId },
                });

                if (!user) {
                    return next(new Error('User not found'));
                }

                socket.userId = user.id;
                return next();
            }

            next(new Error('Authentication required'));
        } catch (error) {
            next(new Error('Invalid authentication'));
        }
    });

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`Client connected: ${socket.id}`);

        // Handle daemon connections
        if (socket.nodeId) {
            handleDaemonConnection(io, socket);
        }
        // Handle user connections
        else if (socket.userId) {
            handleUserConnection(io, socket);
        }

        socket.on('disconnect', () => {
            console.log(`Client disconnected: ${socket.id}`);

            // Mark node as offline if daemon disconnects
            if (socket.nodeId) {
                prisma.node.update({
                    where: { id: socket.nodeId },
                    data: { isOnline: false, lastChecked: new Date() },
                }).catch(console.error);
            }
        });
    });
}

function handleDaemonConnection(io: SocketServer, socket: AuthenticatedSocket) {
    console.log(`Daemon connected: Node ${socket.nodeId}`);

    // Join node-specific room
    socket.join(`node:${socket.nodeId}`);

    // Mark node as online
    prisma.node.update({
        where: { id: socket.nodeId },
        data: { isOnline: true, lastChecked: new Date() },
    }).catch(console.error);

    // Handle server status updates from daemon
    socket.on('server:status', async (data: { serverId: string; status: string }) => {
        const { serverId, status } = data;

        try {
            await prisma.server.update({
                where: { id: serverId },
                data: { status: status as any },
            });

            // Notify all users watching this server
            io.to(`server:${serverId}`).emit('server:status', { serverId, status });
        } catch (error) {
            console.error('Error updating server status:', error);
        }
    });

    // Handle console output from daemon
    socket.on('server:console', (data: { serverId: string; line: string }) => {
        io.to(`server:${data.serverId}`).emit('server:console', data);
    });

    // Handle resource stats from daemon
    socket.on('server:stats', (data: { serverId: string; cpu: number; memory: number; disk: number }) => {
        io.to(`server:${data.serverId}`).emit('server:stats', data);
    });

    // Handle node stats
    socket.on('node:stats', async (data: { cpu: number; memory: number; disk: number; uptime: number }) => {
        // Broadcast to subscribers
        io.to(`node:${socket.nodeId}:stats`).emit('node:stats', {
            nodeId: socket.nodeId,
            ...data,
        });

        // Update node status in DB
        try {
            await prisma.node.update({
                where: { id: socket.nodeId },
                data: {
                    isOnline: true,
                    lastChecked: new Date(),
                    // We could store stats history here if needed
                },
            });
        } catch (error: any) {
            // Handle case where node was deleted but daemon is still connected
            if (error?.code === 'P2025') {
                console.warn(`Node ${socket.nodeId} not found in DB, disconnecting socket.`);
                socket.disconnect(true);
                return;
            }
            console.error('Error updating node status:', error);
        }
    });

    // Handle daemon errors
    socket.on('server:error', (data: { serverId: string; error: string }) => {
        io.to(`server:${data.serverId}`).emit('server:error', data);
    });

    // Handle installation progress
    socket.on('server:install:progress', (data: { serverId: string; progress: number; message: string }) => {
        io.to(`server:${data.serverId}`).emit('server:install:progress', data);
    });

    // Handle installation complete
    socket.on('server:install:complete', async (data: { serverId: string }) => {
        try {
            await prisma.server.update({
                where: { id: data.serverId },
                data: { installed: true },
            });
            io.to(`server:${data.serverId}`).emit('server:install:complete', data);
        } catch (error) {
            console.error('Error marking server as installed:', error);
        }
    });

    // Handle installation error
    socket.on('server:install:error', (data: { serverId: string; error: string }) => {
        io.to(`server:${data.serverId}`).emit('server:install:error', data);
    });

    // Handle backup status updates
    socket.on('backup:status', async (data: { backupId: string; status: string }) => {
        try {
            await prisma.backup.update({
                where: { id: data.backupId },
                data: { status: data.status as any },
            });
        } catch (error) {
            console.error('Error updating backup status:', error);
        }
    });

    // Handle backup completion
    socket.on('backup:complete', async (data: { backupId: string; size: number; storagePath: string; isS3?: boolean }) => {
        try {
            await prisma.backup.update({
                where: { id: data.backupId },
                data: {
                    status: 'COMPLETED',
                    size: BigInt(data.size),
                    storagePath: data.storagePath,
                    completedAt: new Date(),
                },
            });
        } catch (error) {
            console.error('Error completing backup:', error);
        }
    });

    // Handle backup error
    socket.on('backup:error', async (data: { backupId: string; error: string }) => {
        try {
            await prisma.backup.update({
                where: { id: data.backupId },
                data: { status: 'FAILED' },
            });
        } catch (error) {
            console.error('Error failing backup:', error);
        }
    });

    // Handle backup restore completion
    socket.on('backup:restore:complete', (data: { backupId: string }) => {
        // Optionally notify users
    });

    // Handle backup restore error
    socket.on('backup:restore:error', (data: { backupId: string; error: string }) => {
        // Optionally notify users
    });

    // Handle file operation responses from daemon - broadcast to all clients
    socket.on('files:list:response', (data: any) => {
        io.emit('files:list:response', data);
    });

    socket.on('files:read:response', (data: any) => {
        io.emit('files:read:response', data);
    });

    socket.on('files:write:response', (data: any) => {
        io.emit('files:write:response', data);
    });

    socket.on('files:mkdir:response', (data: any) => {
        io.emit('files:mkdir:response', data);
    });

    socket.on('files:delete:response', (data: any) => {
        io.emit('files:delete:response', data);
    });

    socket.on('files:rename:response', (data: any) => {
        io.emit('files:rename:response', data);
    });

    socket.on('files:copy:response', (data: any) => {
        io.emit('files:copy:response', data);
    });

    socket.on('files:error', (data: any) => {
        io.emit('files:error', data);
    });

    // Handle server query response
    socket.on('server:query:response', (data: any) => {
        io.emit('server:query:response', data);
    });

    socket.on('server:query:error', (data: any) => {
        io.emit('server:query:error', data);
    });
}

async function handleUserConnection(io: SocketServer, socket: AuthenticatedSocket) {
    console.log(`User connected: ${socket.userId}`);

    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Subscribe to a server's updates
    socket.on('server:subscribe', async (data: { serverId: string }) => {
        const { serverId } = data;

        try {
            // Check if user has access to this server
            const server = await prisma.server.findUnique({
                where: { id: serverId },
                include: {
                    subusers: { where: { userId: socket.userId } },
                },
            });

            if (!server) {
                return socket.emit('error', { message: 'Server not found' });
            }

            const user = await prisma.user.findUnique({
                where: { id: socket.userId },
            });

            const hasAccess =
                user?.role === 'ADMIN' ||
                server.ownerId === socket.userId ||
                server.subusers.length > 0;

            if (!hasAccess) {
                return socket.emit('error', { message: 'Access denied' });
            }

            socket.join(`server:${serverId}`);
            socket.emit('server:subscribed', { serverId });

            // Send current server status
            socket.emit('server:status', { serverId, status: server.status });
        } catch (error) {
            console.error('Error subscribing to server:', error);
            socket.emit('error', { message: 'Failed to subscribe' });
        }
    });

    // Unsubscribe from a server
    socket.on('server:unsubscribe', (data: { serverId: string }) => {
        socket.leave(`server:${data.serverId}`);
        socket.emit('server:unsubscribed', { serverId: data.serverId });
    });

    // Subscribe to node stats (admin only)
    socket.on('node:subscribe', async (data: { nodeId: string }) => {
        const user = await prisma.user.findUnique({
            where: { id: socket.userId },
        });

        if (user?.role !== 'ADMIN') {
            return socket.emit('error', { message: 'Admin access required' });
        }

        socket.join(`node:${data.nodeId}:stats`);
        socket.emit('node:subscribed', { nodeId: data.nodeId });
    });

    // Unsubscribe from node
    socket.on('node:unsubscribe', (data: { nodeId: string }) => {
        socket.leave(`node:${data.nodeId}:stats`);
        socket.emit('node:unsubscribed', { nodeId: data.nodeId });
    });

    // File operations - forward to daemon
    socket.on('files:list', async (data: { serverId: string; path: string; requestId: string }) => {
        try {
            const server = await prisma.server.findUnique({
                where: { id: data.serverId },
            });
            if (!server) {
                return socket.emit('files:error', { requestId: data.requestId, error: 'Server not found' });
            }

            // Forward to daemon
            io.to(`node:${server.nodeId}`).emit('files:list', data);
        } catch (error) {
            socket.emit('files:error', { requestId: data.requestId, error: 'Failed to list files' });
        }
    });

    socket.on('files:read', async (data: { serverId: string; path: string; requestId: string }) => {
        try {
            const server = await prisma.server.findUnique({
                where: { id: data.serverId },
            });
            if (!server) {
                return socket.emit('files:error', { requestId: data.requestId, error: 'Server not found' });
            }
            io.to(`node:${server.nodeId}`).emit('files:read', data);
        } catch (error) {
            socket.emit('files:error', { requestId: data.requestId, error: 'Failed to read file' });
        }
    });

    socket.on('files:write', async (data: { serverId: string; path: string; content: string; requestId: string }) => {
        try {
            const server = await prisma.server.findUnique({
                where: { id: data.serverId },
            });
            if (!server) {
                return socket.emit('files:error', { requestId: data.requestId, error: 'Server not found' });
            }
            io.to(`node:${server.nodeId}`).emit('files:write', data);
        } catch (error) {
            socket.emit('files:error', { requestId: data.requestId, error: 'Failed to write file' });
        }
    });

    socket.on('files:mkdir', async (data: { serverId: string; path: string; requestId: string }) => {
        try {
            const server = await prisma.server.findUnique({
                where: { id: data.serverId },
            });
            if (!server) {
                return socket.emit('files:error', { requestId: data.requestId, error: 'Server not found' });
            }
            io.to(`node:${server.nodeId}`).emit('files:mkdir', data);
        } catch (error) {
            socket.emit('files:error', { requestId: data.requestId, error: 'Failed to create folder' });
        }
    });

    socket.on('files:delete', async (data: { serverId: string; paths: string[]; requestId: string }) => {
        try {
            const server = await prisma.server.findUnique({
                where: { id: data.serverId },
            });
            if (!server) {
                return socket.emit('files:error', { requestId: data.requestId, error: 'Server not found' });
            }
            io.to(`node:${server.nodeId}`).emit('files:delete', data);
        } catch (error) {
            socket.emit('files:error', { requestId: data.requestId, error: 'Failed to delete files' });
        }
    });

    socket.on('files:rename', async (data: { serverId: string; oldPath: string; newPath: string; requestId: string }) => {
        try {
            const server = await prisma.server.findUnique({
                where: { id: data.serverId },
            });
            if (!server) {
                return socket.emit('files:error', { requestId: data.requestId, error: 'Server not found' });
            }
            io.to(`node:${server.nodeId}`).emit('files:rename', data);
        } catch (error) {
            socket.emit('files:error', { requestId: data.requestId, error: 'Failed to rename file' });
        }
    });

    socket.on('files:copy', async (data: { serverId: string; sourcePath: string; destPath: string; requestId: string }) => {
        try {
            const server = await prisma.server.findUnique({
                where: { id: data.serverId },
            });
            if (!server) {
                return socket.emit('files:error', { requestId: data.requestId, error: 'Server not found' });
            }
            io.to(`node:${server.nodeId}`).emit('files:copy', data);
        } catch (error) {
            socket.emit('files:error', { requestId: data.requestId, error: 'Failed to copy file' });
        }
    });
}
