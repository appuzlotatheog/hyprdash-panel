import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

router.use(authenticate);

// Middleware to check admin role
const requireAdmin = (req: AuthRequest, res: any, next: any) => {
    if (req.user?.role !== 'ADMIN') {
        return next(new AppError(403, 'Admin access required'));
    }
    next();
};

// GET /api/database-hosts - List all database hosts
router.get('/', requireAdmin, async (req, res, next) => {
    try {
        const hosts = await prisma.databaseHost.findMany({
            include: {
                node: true,
                _count: {
                    select: { databases: true }
                }
            }
        });
        res.json(hosts);
    } catch (error) {
        next(error);
    }
});

// POST /api/database-hosts - Create database host
router.post('/', requireAdmin, async (req, res, next) => {
    try {
        const schema = z.object({
            name: z.string().min(1),
            host: z.string().min(1),
            port: z.number().int().positive(),
            username: z.string().min(1),
            password: z.string().min(1),
            nodeId: z.string().optional(),
        });

        const data = schema.parse(req.body);

        const host = await prisma.databaseHost.create({
            data,
        });

        res.status(201).json(host);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/database-hosts/:id - Delete database host
router.delete('/:id', requireAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;

        await prisma.databaseHost.delete({
            where: { id },
        });

        res.json({ message: 'Database host deleted' });
    } catch (error) {
        next(error);
    }
});

export { router as databaseHostsRouter };
