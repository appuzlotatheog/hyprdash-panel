import { Router } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createNodeSchema = z.object({
    name: z.string().min(1).max(100),
    fqdn: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(8080),
    scheme: z.enum(['http', 'https']).default('https'),
    memory: z.number().int().min(128),
    disk: z.number().int().min(100),
});

const updateNodeSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    fqdn: z.string().min(1).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    scheme: z.enum(['http', 'https']).optional(),
    memory: z.number().int().min(128).optional(),
    disk: z.number().int().min(100).optional(),
});

const allocationSchema = z.object({
    ip: z.string().ip(),
    portStart: z.number().int().min(1).max(65535),
    portEnd: z.number().int().min(1).max(65535),
});

// GET /api/nodes - List all nodes
router.get('/', async (_req: AuthRequest, res, next) => {
    try {
        const nodes = await prisma.node.findMany({
            include: {
                _count: {
                    select: { servers: true, allocations: true },
                },
                allocations: {
                    orderBy: { port: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Calculate usage for each node
        const nodesWithUsage = await Promise.all(
            nodes.map(async (node) => {
                const serverStats = await prisma.server.aggregate({
                    where: { nodeId: node.id },
                    _sum: { memory: true, disk: true },
                });

                const allocatedPorts = await prisma.allocation.count({
                    where: { nodeId: node.id, serverId: { not: null } },
                });

                return {
                    ...node,
                    usage: {
                        memory: serverStats._sum.memory || 0,
                        disk: serverStats._sum.disk || 0,
                        allocatedPorts,
                    },
                };
            })
        );

        res.json({ nodes: nodesWithUsage });
    } catch (error) {
        next(error);
    }
});

// GET /api/nodes/:id - Get node details
router.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const node = await prisma.node.findUnique({
            where: { id },
            include: {
                servers: {
                    select: {
                        id: true,
                        name: true,
                        status: true,
                        memory: true,
                        disk: true,
                    },
                },
                allocations: {
                    orderBy: { port: 'asc' },
                },
            },
        });

        if (!node) {
            throw new AppError(404, 'Node not found');
        }

        res.json({ node });
    } catch (error) {
        next(error);
    }
});

// POST /api/nodes - Create node (Admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const data = createNodeSchema.parse(req.body);

        // Generate unique token for daemon authentication
        const token = uuidv4();

        const node = await prisma.node.create({
            data: {
                ...data,
                token,
            },
        });

        res.status(201).json({
            node,
            message: 'Configure your daemon with this token',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// PATCH /api/nodes/:id - Update node (Admin only)
router.patch('/:id', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const data = updateNodeSchema.parse(req.body);

        const node = await prisma.node.findUnique({
            where: { id },
        });

        if (!node) {
            throw new AppError(404, 'Node not found');
        }

        const updated = await prisma.node.update({
            where: { id },
            data,
        });

        res.json({ node: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/nodes/:id - Delete node (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const node = await prisma.node.findUnique({
            where: { id },
            include: { _count: { select: { servers: true } } },
        });

        if (!node) {
            throw new AppError(404, 'Node not found');
        }

        if (node._count.servers > 0) {
            throw new AppError(400, 'Cannot delete node with active servers');
        }

        await prisma.node.delete({
            where: { id },
        });

        res.json({ message: 'Node deleted' });
    } catch (error) {
        next(error);
    }
});

// POST /api/nodes/:id/token/regenerate - Regenerate node token (Admin only)
router.post('/:id/token/regenerate', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const node = await prisma.node.findUnique({
            where: { id },
        });

        if (!node) {
            throw new AppError(404, 'Node not found');
        }

        const newToken = uuidv4();

        await prisma.node.update({
            where: { id },
            data: { token: newToken },
        });

        res.json({
            token: newToken,
            message: 'Token regenerated. Update your daemon configuration.',
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/nodes/:id/allocations - Add allocations (Admin only)
router.post('/:id/allocations', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const data = allocationSchema.parse(req.body);

        const node = await prisma.node.findUnique({
            where: { id },
        });

        if (!node) {
            throw new AppError(404, 'Node not found');
        }

        if (data.portEnd < data.portStart) {
            throw new AppError(400, 'End port must be greater than or equal to start port');
        }

        // Create allocations for port range
        const allocations = [];
        for (let port = data.portStart; port <= data.portEnd; port++) {
            allocations.push({
                nodeId: id,
                ip: data.ip,
                port,
            });
        }

        const created = await prisma.allocation.createMany({
            data: allocations,
        });

        res.status(201).json({
            count: created.count,
            message: `Created ${created.count} allocations`,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/nodes/:id/allocations/:allocationId - Delete allocation (Admin only)
router.delete('/:id/allocations/:allocationId', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id, allocationId } = req.params;

        const allocation = await prisma.allocation.findFirst({
            where: { id: allocationId, nodeId: id },
        });

        if (!allocation) {
            throw new AppError(404, 'Allocation not found');
        }

        if (allocation.serverId) {
            throw new AppError(400, 'Cannot delete allocation assigned to a server');
        }

        await prisma.allocation.delete({
            where: { id: allocationId },
        });

        res.json({ message: 'Allocation deleted' });
    } catch (error) {
        next(error);
    }
});

// GET /api/nodes/:id/stats - Get node statistics
router.get('/:id/stats', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        const node = await prisma.node.findUnique({
            where: { id },
        });

        if (!node) {
            throw new AppError(404, 'Node not found');
        }

        // Aggregate server resource usage
        const serverStats = await prisma.server.aggregate({
            where: { nodeId: id },
            _sum: { memory: true, disk: true, cpu: true },
            _count: true,
        });

        const runningServers = await prisma.server.count({
            where: { nodeId: id, status: 'RUNNING' },
        });

        const allocations = await prisma.allocation.groupBy({
            by: ['serverId'],
            where: { nodeId: id },
            _count: true,
        });

        res.json({
            stats: {
                totalServers: serverStats._count,
                runningServers,
                memoryUsed: serverStats._sum.memory || 0,
                memoryTotal: node.memory,
                diskUsed: serverStats._sum.disk || 0,
                diskTotal: node.disk,
                allocationsUsed: allocations.filter(a => a.serverId !== null).length,
                allocationsTotal: allocations.length,
                isOnline: node.isOnline,
                lastChecked: node.lastChecked,
            },
        });
    } catch (error) {
        next(error);
    }
});

export { router as nodesRouter };
