import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { io } from '../../index.js';
import { AuditService } from '../../services/audit.service.js';

const router = Router();

router.use(authenticate);

// Helper to check server access
async function checkServerAccess(serverId: string, userId: string, permission: string = 'backup') {
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
        server.subusers.some(s => s.permissions.includes(permission));

    if (!hasAccess) {
        throw new AppError(403, 'Access denied');
    }

    return server;
}

// GET /api/servers/:id/backups - List backups
router.get('/:id/backups', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        await checkServerAccess(id, req.user!.id);

        const backups = await prisma.backup.findMany({
            where: { serverId: id },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            backups: backups.map(b => ({
                ...b,
                size: b.size ? b.size.toString() : '0'
            }))
        });
    } catch (error) {
        next(error);
    }
});

// Helper to get S3 config
function getS3Config() {
    if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) {
        return undefined;
    }
    return {
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION || 'us-east-1',
        bucket: process.env.S3_BUCKET,
        accessKeyId: process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
        path: process.env.S3_PATH,
    };
}

// POST /api/servers/:id/backups - Create backup
router.post('/:id/backups', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { name, ignoredFiles } = z.object({
            name: z.string().min(1).max(100).optional(),
            ignoredFiles: z.array(z.string()).optional(),
        }).parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'backup.create');

        // Check backup limit (max 10 per server)
        const backupCount = await prisma.backup.count({
            where: { serverId: id },
        });

        if (backupCount >= 10) {
            throw new AppError(400, 'Maximum backup limit reached (10). Delete old backups first.');
        }

        // Create backup record
        const backup = await prisma.backup.create({
            data: {
                serverId: id,
                name: name || `Backup ${new Date().toISOString()}`,
                status: 'PENDING',
            },
        });

        // Send backup request to daemon
        io.to(`node:${server.nodeId}`).emit('backup:create', {
            serverId: id,
            backupId: backup.id,
            name: backup.name,
            ignoredFiles: ignoredFiles || [],
            s3: getS3Config(),
        });

        // Log action
        await AuditService.log(req.user!.id, 'backup.create', {
            serverId: id,
            backupId: backup.id,
            name: backup.name,
        }, req.ip);

        res.status(201).json({ backup });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/servers/:id/backups/:backupId/restore - Restore backup
router.post('/:id/backups/:backupId/restore', async (req: AuthRequest, res, next) => {
    try {
        const { id, backupId } = req.params;

        const server = await checkServerAccess(id, req.user!.id, 'backup.restore');

        const backup = await prisma.backup.findFirst({
            where: { id: backupId, serverId: id },
        });

        if (!backup) {
            throw new AppError(404, 'Backup not found');
        }

        if (backup.status !== 'COMPLETED') {
            throw new AppError(400, 'Backup is not ready for restore');
        }

        if (server.status === 'RUNNING') {
            throw new AppError(400, 'Stop the server before restoring');
        }

        // Send restore request to daemon
        io.to(`node:${server.nodeId}`).emit('backup:restore', {
            serverId: id,
            backupId: backup.id,
            storagePath: backup.storagePath,
            isS3: !!getS3Config(), // Assuming if S3 is configured, we use it. Ideally, check backup metadata.
            s3: getS3Config(),
        });

        // Log action
        await AuditService.log(req.user!.id, 'backup.restore', {
            serverId: id,
            backupId: backup.id,
        }, req.ip);

        res.json({ message: 'Restore request sent' });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/servers/:id/backups/:backupId - Delete backup
router.delete('/:id/backups/:backupId', async (req: AuthRequest, res, next) => {
    try {
        const { id, backupId } = req.params;

        const server = await checkServerAccess(id, req.user!.id, 'backup.delete');

        const backup = await prisma.backup.findFirst({
            where: { id: backupId, serverId: id },
        });

        if (!backup) {
            throw new AppError(404, 'Backup not found');
        }

        // Send delete request to daemon
        if (backup.storagePath) {
            io.to(`node:${server.nodeId}`).emit('backup:delete', {
                serverId: id,
                backupId: backup.id,
                storagePath: backup.storagePath,
                isS3: !!getS3Config(),
                s3: getS3Config(),
            });
        }

        await prisma.backup.delete({
            where: { id: backupId },
        });

        // Log action
        await AuditService.log(req.user!.id, 'backup.delete', {
            serverId: id,
            backupId: backupId,
        }, req.ip);

        res.json({ message: 'Backup deleted' });
    } catch (error) {
        next(error);
    }
});

// GET /api/servers/:id/backups/:backupId/download - Get download URL
router.get('/:id/backups/:backupId/download', async (req: AuthRequest, res, next) => {
    try {
        const { id, backupId } = req.params;

        await checkServerAccess(id, req.user!.id, 'backup.download');

        const backup = await prisma.backup.findFirst({
            where: { id: backupId, serverId: id },
        });

        if (!backup) {
            throw new AppError(404, 'Backup not found');
        }

        if (backup.status !== 'COMPLETED') {
            throw new AppError(400, 'Backup is not ready for download');
        }

        const downloadToken = Buffer.from(JSON.stringify({
            serverId: id,
            backupId: backup.id,
            userId: req.user!.id,
            expires: Date.now() + 3600000,
        })).toString('base64');

        res.json({
            downloadUrl: `/api/servers/${id}/backups/${backupId}/download-stream?token=${downloadToken}`,
            expiresIn: 3600,
        });
    } catch (error) {
        next(error);
    }
});

export { router as backupsRouter };
