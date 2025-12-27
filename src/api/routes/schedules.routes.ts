import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);

// Validation schemas
const createScheduleSchema = z.object({
    name: z.string().min(1).max(100),
    cron: z.string().min(1), // e.g., "0 0 * * *" for daily at midnight
    action: z.enum(['restart', 'backup', 'command', 'power']),
    payload: z.string().optional(), // Command to run or power action
});

const updateScheduleSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    cron: z.string().min(1).optional(),
    action: z.enum(['restart', 'backup', 'command', 'power']).optional(),
    payload: z.string().optional(),
    isActive: z.boolean().optional(),
});

// Helper to check server access
async function checkServerAccess(serverId: string, userId: string) {
    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: {
            subusers: { where: { userId } },
        },
    });

    if (!server) {
        throw new AppError(404, 'Server not found');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const hasAccess =
        user?.role === 'ADMIN' ||
        server.ownerId === userId ||
        server.subusers.some(s => s.permissions.includes('schedule'));

    if (!hasAccess) {
        throw new AppError(403, 'Access denied');
    }

    return server;
}

// Helper to calculate next run time from cron
function getNextRunTime(cron: string): Date {
    // Simple implementation - in production use a proper cron parser like 'cron-parser'
    const now = new Date();
    const parts = cron.split(' ');

    if (parts.length !== 5) {
        return new Date(now.getTime() + 3600000); // Default to 1 hour from now
    }

    // For simplicity, just add 24 hours for daily crons
    return new Date(now.getTime() + 86400000);
}

// GET /api/servers/:id/schedules - List schedules
router.get('/:id/schedules', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        await checkServerAccess(id, req.user!.id);

        const schedules = await prisma.schedule.findMany({
            where: { serverId: id },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ schedules });
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/schedules - Create schedule
router.post('/:id/schedules', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const data = createScheduleSchema.parse(req.body);

        await checkServerAccess(id, req.user!.id);

        const schedule = await prisma.schedule.create({
            data: {
                serverId: id,
                name: data.name,
                cron: data.cron,
                action: data.action,
                payload: data.payload,
                nextRunAt: getNextRunTime(data.cron),
            },
        });

        res.status(201).json({ schedule });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// PATCH /api/servers/:id/schedules/:scheduleId - Update schedule
router.patch('/:id/schedules/:scheduleId', async (req: AuthRequest, res, next) => {
    try {
        const { id, scheduleId } = req.params;
        const data = updateScheduleSchema.parse(req.body);

        await checkServerAccess(id, req.user!.id);

        const schedule = await prisma.schedule.findFirst({
            where: { id: scheduleId, serverId: id },
        });

        if (!schedule) {
            throw new AppError(404, 'Schedule not found');
        }

        const updateData: any = { ...data };
        if (data.cron) {
            updateData.nextRunAt = getNextRunTime(data.cron);
        }

        const updated = await prisma.schedule.update({
            where: { id: scheduleId },
            data: updateData,
        });

        res.json({ schedule: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/servers/:id/schedules/:scheduleId - Delete schedule
router.delete('/:id/schedules/:scheduleId', async (req: AuthRequest, res, next) => {
    try {
        const { id, scheduleId } = req.params;

        await checkServerAccess(id, req.user!.id);

        const schedule = await prisma.schedule.findFirst({
            where: { id: scheduleId, serverId: id },
        });

        if (!schedule) {
            throw new AppError(404, 'Schedule not found');
        }

        await prisma.schedule.delete({
            where: { id: scheduleId },
        });

        res.json({ message: 'Schedule deleted' });
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/schedules/:scheduleId/execute - Execute schedule now
router.post('/:id/schedules/:scheduleId/execute', async (req: AuthRequest, res, next) => {
    try {
        const { id, scheduleId } = req.params;

        const server = await checkServerAccess(id, req.user!.id);

        const schedule = await prisma.schedule.findFirst({
            where: { id: scheduleId, serverId: id },
        });

        if (!schedule) {
            throw new AppError(404, 'Schedule not found');
        }

        // Import io dynamically to avoid circular dependency
        const { io } = await import('../../index.js');

        // Execute the scheduled action
        switch (schedule.action) {
            case 'restart':
                io.to(`node:${server.nodeId}`).emit('server:power', {
                    serverId: id,
                    action: 'restart',
                });
                break;
            case 'backup':
                io.to(`node:${server.nodeId}`).emit('backup:create', {
                    serverId: id,
                    name: `Scheduled: ${schedule.name}`,
                });
                break;
            case 'command':
                if (schedule.payload) {
                    io.to(`node:${server.nodeId}`).emit('server:command', {
                        serverId: id,
                        command: schedule.payload,
                    });
                }
                break;
            case 'power':
                if (schedule.payload) {
                    io.to(`node:${server.nodeId}`).emit('server:power', {
                        serverId: id,
                        action: schedule.payload,
                    });
                }
                break;
        }

        // Update last run time
        await prisma.schedule.update({
            where: { id: scheduleId },
            data: {
                lastRunAt: new Date(),
                nextRunAt: getNextRunTime(schedule.cron),
            },
        });

        res.json({ message: 'Schedule executed' });
    } catch (error) {
        next(error);
    }
});

export { router as schedulesRouter };
