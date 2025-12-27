import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { io } from '../../index.js';
import { AuditService } from '../../services/audit.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/servers - List servers
router.get('/', async (req: AuthRequest, res, next) => {
    try {
        console.log('[DEBUG] GET /api/servers - User:', req.user?.id, req.user?.username, req.user?.role);

        const where = req.user?.role === 'ADMIN'
            ? {}
            : {
                OR: [
                    { ownerId: req.user!.id },
                    { subusers: { some: { userId: req.user!.id } } }
                ]
            };

        console.log('[DEBUG] GET /api/servers - Where:', JSON.stringify(where));

        const servers = await prisma.server.findMany({
            where,
            include: {
                node: { select: { id: true, name: true, fqdn: true } },
                owner: { select: { id: true, username: true } },
                allocation: { select: { ip: true, port: true } },
                egg: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        console.log(`[DEBUG] Found ${servers.length} servers for user ${req.user?.username}`);

        res.json({ servers });
    } catch (error) {
        next(error);
    }
});

// GET /api/servers/:id - Get server details
router.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        console.log(`[DEBUG] GET /api/servers/${id} - User: ${req.user?.username}`);

        const server = await prisma.server.findUnique({
            where: { id },
            include: {
                node: true,
                owner: { select: { id: true, username: true, email: true } },
                allocation: true,
                egg: true,
                variables: true,
                subusers: {
                    include: {
                        user: { select: { id: true, username: true, email: true } },
                    },
                },
            },
        });

        if (!server) {
            console.log(`[DEBUG] Server ${id} not found in DB`);
            throw new AppError(404, 'Server not found');
        }

        console.log(`[DEBUG] Server owner: ${server.ownerId}, Requester: ${req.user?.id}`);

        // Check access
        const hasAccess =
            req.user?.role === 'ADMIN' ||
            server.ownerId === req.user?.id ||
            server.subusers.some(s => s.userId === req.user?.id);

        if (!hasAccess) {
            console.log(`[DEBUG] Access denied for user ${req.user?.username}`);
            throw new AppError(403, 'Access denied');
        }

        res.json({ server });
    } catch (error) {
        next(error);
    }
});

// Validation schemas
const createServerSchema = z.object({
    nodeId: z.string().uuid(),
    name: z.string().min(1).max(100),
    description: z.string().optional(),
    memory: z.number().int().min(128),
    disk: z.number().int().min(100),
    cpu: z.number().int().min(1).max(1000).default(100),
    startup: z.string(),
    eggId: z.string().uuid().optional(),
    allocationId: z.string().uuid().optional(),
    ownerId: z.string().uuid().optional(), // Optional owner assignment
    variables: z.array(z.object({
        name: z.string(),
        envVariable: z.string(),
        value: z.string(),
    })).optional(),
});

const updateServerSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().optional(),
    memory: z.number().int().min(128).optional(),
    disk: z.number().int().min(100).optional(),
    cpu: z.number().int().min(1).max(1000).optional(),
    startup: z.string().optional(),
});

const powerActionSchema = z.object({
    action: z.enum(['start', 'stop', 'restart', 'kill']),
});

const commandSchema = z.object({
    command: z.string().min(1),
});

// ... (updateServerSchema, powerActionSchema, commandSchema remain same)

// POST /api/servers - Create server
router.post('/', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const data = createServerSchema.parse(req.body);
        console.log('[DEBUG] POST /api/servers - Data:', JSON.stringify(data));

        // Verify node exists
        const node = await prisma.node.findUnique({
            where: { id: data.nodeId },
        });

        if (!node) {
            throw new AppError(404, 'Node not found');
        }

        let ownerId = req.user!.id;

        // Handle owner assignment (Admin only)
        if (data.ownerId) {
            console.log(`[DEBUG] Assigning owner to ${data.ownerId}`);
            if (req.user?.role !== 'ADMIN') {
                throw new AppError(403, 'Only admins can assign server owners');
            }

            const targetUser = await prisma.user.findUnique({
                where: { id: data.ownerId },
            });

            if (!targetUser) {
                throw new AppError(404, 'Target owner not found');
            }
            ownerId = targetUser.id;
        }

        console.log(`[DEBUG] Creating server with ownerId: ${ownerId}`);

        // Create server
        const server = await prisma.server.create({
            data: {
                nodeId: data.nodeId,
                ownerId: ownerId,
                eggId: data.eggId,
                name: data.name,
                description: data.description,
                memory: data.memory,
                disk: data.disk,
                cpu: data.cpu,
                startup: data.startup,
                variables: data.variables ? {
                    create: data.variables,
                } : undefined,
            },
            include: {
                node: { select: { id: true, name: true } },
                allocation: true,
                variables: true,
            },
        });

        // Assign allocation if provided
        if (data.allocationId) {
            await prisma.allocation.update({
                where: { id: data.allocationId },
                data: { serverId: server.id },
            });
        }

        // Notify daemon to prepare server directory
        io.to(`node:${data.nodeId}`).emit('server:create', {
            serverId: server.id,
            config: server,
        });

        // Trigger installation if egg has install script
        if (data.eggId) {
            const egg = await prisma.egg.findUnique({
                where: { id: data.eggId },
            });

            if (egg && (egg.scriptInstall || egg.name.toLowerCase().includes('paper') || egg.name.toLowerCase().includes('vanilla'))) {
                // Prepare variables
                const variables: Record<string, string> = {};
                server.variables?.forEach((v: any) => {
                    variables[v.envVariable] = v.value;
                });

                // Add server allocation info
                if (server.allocation) {
                    variables.SERVER_IP = server.allocation.ip;
                    variables.SERVER_PORT = String(server.allocation.port);
                }
                variables.SERVER_MEMORY = String(server.memory);

                io.to(`node:${data.nodeId}`).emit('server:install', {
                    serverId: server.id,
                    egg: {
                        name: egg.name,
                        startup: egg.startup,
                        scriptInstall: egg.scriptInstall,
                        scriptContainer: egg.scriptContainer,
                    },
                    variables,
                });
            }
        }

        // Log action
        await AuditService.log(req.user!.id, 'server.create', {
            serverId: server.id,
            name: server.name,
            nodeId: server.nodeId,
        }, req.ip);

        res.status(201).json({ server });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// PATCH /api/servers/:id - Update server
router.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const data = updateServerSchema.parse(req.body);

        const server = await prisma.server.findUnique({
            where: { id },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Check ownership or admin
        if (server.ownerId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new AppError(403, 'Access denied');
        }

        const updated = await prisma.server.update({
            where: { id },
            data,
            include: {
                node: { select: { id: true, name: true } },
                allocation: true,
            },
        });

        res.json({ server: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/servers/:id - Delete server
router.delete('/:id', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const server = await prisma.server.findUnique({
            where: { id },
            include: { node: true },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Notify daemon to cleanup
        io.to(`node:${server.nodeId}`).emit('server:delete', {
            serverId: id,
        });

        await prisma.server.delete({
            where: { id },
        });

        // Log action
        await AuditService.log(req.user!.id, 'server.delete', {
            serverId: id,
            name: server.name,
            nodeId: server.nodeId,
        }, req.ip);

        res.json({ message: 'Server deleted' });
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/power - Power actions
router.post('/:id/power', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { action } = powerActionSchema.parse(req.body);

        const server = await prisma.server.findUnique({
            where: { id },
            include: {
                node: true,
                allocation: true,
                variables: true,
            },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Check access
        const hasAccess =
            req.user?.role === 'ADMIN' ||
            server.ownerId === req.user?.id;

        if (!hasAccess) {
            // Check subuser permissions
            const subuser = await prisma.subuser.findUnique({
                where: {
                    serverId_userId: {
                        serverId: id,
                        userId: req.user!.id,
                    },
                },
            });

            if (!subuser) {
                throw new AppError(403, 'Access denied');
            }
            const perms = JSON.parse(subuser.permissions) as string[];
            if (!perms.includes('power')) {
                throw new AppError(403, 'Access denied');
            }
        }

        // Fetch mounts
        const serverMounts = await prisma.serverMount.findMany({
            where: { serverId: id },
            include: { mount: true },
        });

        const mounts = serverMounts.map(sm => ({
            source: sm.mount.source,
            target: sm.mount.target,
            readOnly: sm.mount.readOnly,
        }));

        // Send power action to daemon
        io.to(`node:${server.nodeId}`).emit('server:power', {
            serverId: id,
            action,
            config: {
                startup: server.startup,
                memory: server.memory,
                cpu: server.cpu,
                variables: server.variables,
                allocation: server.allocation,
                mounts,
            },
        });

        // Update status based on action
        const statusMap: Record<string, 'STARTING' | 'STOPPING' | 'OFFLINE'> = {
            start: 'STARTING',
            stop: 'STOPPING',
            restart: 'STARTING',
            kill: 'OFFLINE',
        };

        await prisma.server.update({
            where: { id },
            data: { status: statusMap[action] },
        });

        // Log action
        await AuditService.log(req.user!.id, `server.power.${action}`, {
            serverId: id,
            name: server.name,
            nodeId: server.nodeId,
        }, req.ip);

        res.json({ message: `Power action '${action}' sent` });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, 'Invalid action'));
        }
        next(error);
    }
});

// POST /api/servers/:id/command - Send console command
router.post('/:id/command', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { command } = commandSchema.parse(req.body);

        const server = await prisma.server.findUnique({
            where: { id },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Check access
        const hasAccess =
            req.user?.role === 'ADMIN' ||
            server.ownerId === req.user?.id;

        if (!hasAccess) {
            const subuser = await prisma.subuser.findUnique({
                where: {
                    serverId_userId: {
                        serverId: id,
                        userId: req.user!.id,
                    },
                },
            });

            if (!subuser) {
                throw new AppError(403, 'Access denied');
            }
            const perms = JSON.parse(subuser.permissions) as string[];
            if (!perms.includes('console')) {
                throw new AppError(403, 'Access denied');
            }
        }

        // Send command to daemon
        io.to(`node:${server.nodeId}`).emit('server:command', {
            serverId: id,
            command,
        });

        res.json({ message: 'Command sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, 'Invalid command'));
        }
        next(error);
    }
});

// GET /api/servers/:id/logs - Get recent logs
router.get('/:id/logs', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const lines = parseInt(req.query.lines as string) || 100;

        const server = await prisma.server.findUnique({
            where: { id },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Check access
        const hasAccess =
            req.user?.role === 'ADMIN' ||
            server.ownerId === req.user?.id;

        if (!hasAccess) {
            const subuser = await prisma.subuser.findUnique({
                where: {
                    serverId_userId: {
                        serverId: id,
                        userId: req.user!.id,
                    },
                },
            });

            if (!subuser) {
                throw new AppError(403, 'Access denied');
            }
            const perms = JSON.parse(subuser.permissions) as string[];
            if (!perms.includes('console')) {
                throw new AppError(403, 'Access denied');
            }
        }

        // Request logs from daemon via HTTP or cached
        // For now, return empty - daemon will stream via WebSocket
        res.json({ logs: [], message: 'Connect via WebSocket for real-time logs' });
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/users - Add subuser
router.post('/:id/users', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { email, permissions } = z.object({
            email: z.string().email(),
            permissions: z.string(), // JSON array string
        }).parse(req.body);

        const server = await prisma.server.findUnique({
            where: { id },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Only owner or admin can add subusers
        if (server.ownerId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new AppError(403, 'Access denied');
        }

        const userToAdd = await prisma.user.findUnique({
            where: { email },
        });

        // If user doesn't exist, send invitation email
        if (!userToAdd) {
            // Check if invitation already exists
            const existingInvite = await prisma.invitation.findFirst({
                where: {
                    email,
                    serverId: id,
                },
            });

            if (existingInvite) {
                throw new AppError(409, 'Invitation already sent to this email');
            }

            // Import and use createInvitation
            const { createInvitation } = await import('./invitations.routes.js');

            // Determine panel URL from request
            const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
            const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5173';
            const panelUrl = `${protocol}://${host}`;

            await createInvitation(email, id, permissions, req.user!.id, panelUrl);

            await AuditService.log(req.user!.id, 'server.subuser.invite', {
                serverId: id,
                email,
                permissions,
            }, req.ip);

            return res.status(201).json({
                invited: true,
                message: `Invitation sent to ${email}`,
                email,
            });
        }

        if (userToAdd.id === server.ownerId) {
            throw new AppError(400, 'Cannot add owner as subuser');
        }

        // Check if already a subuser
        const existingSubuser = await prisma.subuser.findUnique({
            where: {
                serverId_userId: {
                    serverId: id,
                    userId: userToAdd.id,
                },
            },
        });

        if (existingSubuser) {
            throw new AppError(409, 'User is already a subuser');
        }

        const subuser = await prisma.subuser.create({
            data: {
                serverId: id,
                userId: userToAdd.id,
                permissions,
            },
            include: {
                user: { select: { id: true, username: true, email: true } },
            },
        });

        await AuditService.log(req.user!.id, 'server.subuser.add', {
            serverId: id,
            targetUserId: userToAdd.id,
            permissions,
        }, req.ip);

        res.status(201).json({ subuser });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        // Handle unique constraint violation
        if ((error as any).code === 'P2002') {
            return next(new AppError(409, 'User is already a subuser'));
        }
        next(error);
    }
});

// DELETE /api/servers/:id/users/:userId - Remove subuser
router.delete('/:id/users/:userId', async (req: AuthRequest, res, next) => {
    try {
        const { id, userId } = req.params;

        const server = await prisma.server.findUnique({
            where: { id },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Only owner or admin can remove subusers
        if (server.ownerId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new AppError(403, 'Access denied');
        }

        await prisma.subuser.delete({
            where: {
                serverId_userId: {
                    serverId: id,
                    userId,
                },
            },
        });

        await AuditService.log(req.user!.id, 'server.subuser.remove', {
            serverId: id,
            targetUserId: userId,
        }, req.ip);

        res.json({ message: 'Subuser removed' });
    } catch (error) {
        if ((error as any).code === 'P2025') {
            return next(new AppError(404, 'Subuser not found'));
        }
        next(error);
    }
});

// PUT /api/servers/:id/users/:userId - Update permissions
router.put('/:id/users/:userId', async (req: AuthRequest, res, next) => {
    try {
        const { id, userId } = req.params;
        const { permissions } = z.object({
            permissions: z.string(),
        }).parse(req.body);

        const server = await prisma.server.findUnique({
            where: { id },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Only owner or admin can update permissions
        if (server.ownerId !== req.user?.id && req.user?.role !== 'ADMIN') {
            throw new AppError(403, 'Access denied');
        }

        const subuser = await prisma.subuser.update({
            where: {
                serverId_userId: {
                    serverId: id,
                    userId,
                },
            },
            data: { permissions },
            include: {
                user: { select: { id: true, username: true, email: true } },
            },
        });

        await AuditService.log(req.user!.id, 'server.subuser.update', {
            serverId: id,
            targetUserId: userId,
            permissions,
        }, req.ip);

        res.json({ subuser });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        if ((error as any).code === 'P2025') {
            return next(new AppError(404, 'Subuser not found'));
        }
        next(error);
    }
});

export { router as serversRouter };
