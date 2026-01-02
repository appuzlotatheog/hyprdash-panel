import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { Server as SocketServer } from 'socket.io';

const router = Router();

router.use(authenticate);

// GET /api/servers/:id/query
router.get('/:id/query', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const type = req.query.type as string || 'minecraft';

        const server = await prisma.server.findUnique({
            where: { id },
            include: {
                allocation: true,
                node: true,
            },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Check permissions (read access is enough)
        // We can reuse checkServerAccess helper or just check here
        // For query, even public status pages might need it, but let's require auth for now

        const allocation = server.allocation;
        if (!allocation) {
            throw new AppError(400, 'Server has no allocation');
        }

        // Send query request to daemon
        const io = req.app.get('io') as SocketServer;
        io.to(`node:${server.nodeId}`).emit('server:query', {
            serverId: id,
            type: type,
            host: allocation.ip,
            port: allocation.port,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Query request sent to daemon' });
    } catch (error) {
        next(error);
    }
});

export { router as queryRouter };
