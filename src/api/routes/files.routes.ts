import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { prisma } from '../../lib/prisma.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { io } from '../../index.js';

const router = Router();

// Configure multer for memory storage (files stored in memory as Buffer)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB max file size
    },
});

router.use(authenticate);

// Helper to check server access
async function checkServerAccess(serverId: string, userId: string, permission: string = 'files') {
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
        server.subusers.some(s => {
            const perms = JSON.parse(s.permissions) as string[];
            return perms.includes(permission) ||
                (permission.startsWith('files.') && perms.includes('files'));
        });

    if (!hasAccess) {
        throw new AppError(403, 'Access denied');
    }

    return server;
}

// GET /api/servers/:id/files/list - List files in directory
router.get('/:id/files/list', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const path = (req.query.path as string) || '/';

        const server = await checkServerAccess(id, req.user!.id);

        // Request file list from daemon via WebSocket
        io.to(`node:${server.nodeId}`).emit('files:list', {
            serverId: id,
            path,
            requestId: `${id}-${Date.now()}`,
        });

        // For now, return a pending response - real implementation would use callbacks
        res.json({
            message: 'File list request sent to daemon',
            tip: 'Subscribe to WebSocket for real-time response'
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/servers/:id/files/contents - Get file contents
router.get('/:id/files/contents', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const filePath = req.query.file as string;

        if (!filePath) {
            throw new AppError(400, 'File path required');
        }

        const server = await checkServerAccess(id, req.user!.id);

        io.to(`node:${server.nodeId}`).emit('files:read', {
            serverId: id,
            path: filePath,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'File read request sent to daemon' });
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/files/write - Write file contents
router.post('/:id/files/write', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            path: z.string().min(1),
            content: z.string(),
        });
        const { path, content } = schema.parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'files.write');

        io.to(`node:${server.nodeId}`).emit('files:write', {
            serverId: id,
            path,
            content,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'File write request sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/servers/:id/files/create-directory - Create directory
router.post('/:id/files/create-directory', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { path } = z.object({ path: z.string().min(1) }).parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'files.write');

        io.to(`node:${server.nodeId}`).emit('files:mkdir', {
            serverId: id,
            path,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Directory creation request sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/servers/:id/files/rename - Rename file/directory
router.post('/:id/files/rename', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            from: z.string().min(1),
            to: z.string().min(1),
        });
        const { from, to } = schema.parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'files.write');

        io.to(`node:${server.nodeId}`).emit('files:rename', {
            serverId: id,
            from,
            to,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Rename request sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/servers/:id/files/copy - Copy file/directory
router.post('/:id/files/copy', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            from: z.string().min(1),
            to: z.string().min(1),
        });
        const { from, to } = schema.parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'files.write');

        io.to(`node:${server.nodeId}`).emit('files:copy', {
            serverId: id,
            from,
            to,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Copy request sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/servers/:id/files/delete - Delete file/directory
router.delete('/:id/files/delete', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { paths } = z.object({
            paths: z.array(z.string().min(1)).min(1)
        }).parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'files.delete');

        io.to(`node:${server.nodeId}`).emit('files:delete', {
            serverId: id,
            paths,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Delete request sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/servers/:id/files/compress - Create archive
router.post('/:id/files/compress', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            paths: z.array(z.string().min(1)).min(1),
            destination: z.string().min(1),
        });
        const { paths, destination } = schema.parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'files.archive');

        io.to(`node:${server.nodeId}`).emit('files:compress', {
            serverId: id,
            paths,
            destination,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Compression request sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/servers/:id/files/decompress - Extract archive
router.post('/:id/files/decompress', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const schema = z.object({
            file: z.string().min(1),
            destination: z.string().min(1),
        });
        const { file, destination } = schema.parse(req.body);

        const server = await checkServerAccess(id, req.user!.id, 'files.archive');

        io.to(`node:${server.nodeId}`).emit('files:decompress', {
            serverId: id,
            file,
            destination,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Decompression request sent' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// GET /api/servers/:id/files/download - Get download URL
router.get('/:id/files/download', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const filePath = req.query.file as string;

        if (!filePath) {
            throw new AppError(400, 'File path required');
        }

        const server = await checkServerAccess(id, req.user!.id);

        // Generate a signed download URL or token
        const downloadToken = Buffer.from(JSON.stringify({
            serverId: id,
            path: filePath,
            userId: req.user!.id,
            expires: Date.now() + 3600000, // 1 hour
        })).toString('base64');

        res.json({
            downloadUrl: `/api/servers/${id}/files/download-stream?token=${downloadToken}`,
            expiresIn: 3600,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/files/upload - Upload file via HTTP multipart
router.post('/:id/files/upload', upload.single('file'), async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const destinationPath = req.body.path || '/';

        if (!req.file) {
            throw new AppError(400, 'No file provided');
        }

        const server = await checkServerAccess(id, req.user!.id, 'files.write');

        // Convert file buffer to base64
        const base64Content = req.file.buffer.toString('base64');
        const fileName = req.file.originalname;
        const fullPath = destinationPath.endsWith('/')
            ? `${destinationPath}${fileName}`
            : `${destinationPath}/${fileName}`;

        const requestId = `upload-${id}-${Date.now()}`;

        console.log(`[Upload] HTTP upload: ${fileName} (${req.file.size} bytes) to ${fullPath}`);

        // Send to daemon (fire and forget - daemon will process async)
        io.to(`node:${server.nodeId}`).emit('files:write', {
            serverId: id,
            path: fullPath,
            content: base64Content,
            isBinary: true,
            requestId,
        });

        // Return success immediately - file write happens async on daemon
        res.json({
            success: true,
            message: `File upload initiated: ${fileName}`,
            path: fullPath,
            size: req.file.size,
        });
    } catch (error: any) {
        console.error('[Upload] HTTP upload error:', error);
        if (error instanceof AppError) {
            return next(error);
        }
        next(new AppError(500, error.message || 'Upload failed'));
    }
});

export { router as filesRouter };
