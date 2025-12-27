import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

// All routes require admin authentication
router.use(authenticate, requireAdmin);

const createMountSchema = z.object({
    name: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    readOnly: z.boolean().default(false),
    nodeId: z.string().uuid(),
});

const attachMountSchema = z.object({
    serverId: z.string().uuid(),
});

// GET /api/mounts - List all mounts
router.get('/', async (req, res, next) => {
    try {
        const mounts = await prisma.mount.findMany({
            include: {
                node: { select: { id: true, name: true } },
                servers: {
                    include: {
                        server: { select: { id: true, name: true } },
                    },
                },
            },
        });
        res.json({ mounts });
    } catch (error) {
        next(error);
    }
});

// POST /api/mounts - Create mount
router.post('/', async (req, res, next) => {
    try {
        const data = createMountSchema.parse(req.body);

        const mount = await prisma.mount.create({
            data,
            include: {
                node: { select: { id: true, name: true } },
            },
        });

        res.status(201).json({ mount });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/mounts/:id - Delete mount
router.delete('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.mount.delete({
            where: { id },
        });

        res.json({ message: 'Mount deleted' });
    } catch (error) {
        next(error);
    }
});

// POST /api/mounts/:id/servers - Attach mount to server
router.post('/:id/servers', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { serverId } = attachMountSchema.parse(req.body);

        const mount = await prisma.mount.findUnique({
            where: { id },
        });

        if (!mount) {
            throw new AppError(404, 'Mount not found');
        }

        const server = await prisma.server.findUnique({
            where: { id: serverId },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Check if server is on the same node as the mount
        if (server.nodeId !== mount.nodeId) {
            throw new AppError(400, 'Server must be on the same node as the mount');
        }

        await prisma.serverMount.create({
            data: {
                mountId: id,
                serverId,
            },
        });

        res.json({ message: 'Mount attached to server' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        // Handle unique constraint violation
        if ((error as any).code === 'P2002') {
            return next(new AppError(409, 'Mount already attached to this server'));
        }
        next(error);
    }
});

// DELETE /api/mounts/:id/servers/:serverId - Detach mount from server
router.delete('/:id/servers/:serverId', async (req, res, next) => {
    try {
        const { id, serverId } = req.params;

        await prisma.serverMount.delete({
            where: {
                serverId_mountId: {
                    serverId,
                    mountId: id,
                },
            },
        });

        res.json({ message: 'Mount detached from server' });
    } catch (error) {
        // Handle record not found
        if ((error as any).code === 'P2025') {
            return next(new AppError(404, 'Mount not attached to this server'));
        }
        next(error);
    }
});

export default router;
