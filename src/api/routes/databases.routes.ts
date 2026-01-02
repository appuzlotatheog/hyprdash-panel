import { Router } from 'express';
import { z } from 'zod';
import mysql from 'mysql2/promise';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { prisma } from '../../lib/prisma.js';
import crypto from 'crypto';

const router = Router();

router.use(authenticate);

// Helper to check server access
async function checkServerAccess(serverId: string, userId: string, permission: string = 'database.read') {
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
            return perms.includes(permission) || perms.includes('database');
        });

    if (!hasAccess) {
        throw new AppError(403, 'Access denied');
    }

    return server;
}

// GET /api/servers/:id/databases - List databases
router.get('/:id/databases', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        await checkServerAccess(id, req.user!.id);

        const databases = await prisma.database.findMany({
            where: { serverId: id },
            include: { host: true },
        });

        res.json(databases);
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/databases - Create database
router.post('/:id/databases', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { name, remote } = z.object({
            name: z.string().min(1).max(32).regex(/^[a-zA-Z0-9_]+$/),
            remote: z.string().default('%'),
        }).parse(req.body);

        await checkServerAccess(id, req.user!.id, 'database.create');

        // Find a suitable database host
        // For now, just pick the first one or one assigned to the node
        // Ideally, we should check capacity and node assignment
        const host = await prisma.databaseHost.findFirst();

        if (!host) {
            throw new AppError(500, 'No database host available');
        }

        // Generate credentials
        const dbName = `s${id.split('-')[0]}_${name}`;
        const username = `u${id.split('-')[0]}_${crypto.randomBytes(3).toString('hex')}`;
        const password = crypto.randomBytes(16).toString('base64');

        // Create on remote host
        const connection = await mysql.createConnection({
            host: host.host,
            port: host.port,
            user: host.username,
            password: host.password,
        });

        try {
            await connection.execute(`CREATE USER ?@? IDENTIFIED BY ?`, [username, remote, password]);
            await connection.execute(`CREATE DATABASE \`${dbName}\``);
            await connection.execute(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ?@?`, [username, remote]);
            await connection.execute('FLUSH PRIVILEGES');
        } catch (err) {
            console.error('Failed to create database on host:', err);
            throw new AppError(500, 'Failed to create database on host');
        } finally {
            await connection.end();
        }

        // Store in DB
        const database = await prisma.database.create({
            data: {
                serverId: id,
                hostId: host.id,
                database: dbName,
                username,
                password,
                remote,
            },
        });

        res.status(201).json(database);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/servers/:id/databases/:dbId - Delete database
router.delete('/:id/databases/:dbId', async (req: AuthRequest, res, next) => {
    try {
        const { id, dbId } = req.params;
        await checkServerAccess(id, req.user!.id, 'database.delete');

        const database = await prisma.database.findUnique({
            where: { id: dbId },
            include: { host: true },
        });

        if (!database || database.serverId !== id) {
            throw new AppError(404, 'Database not found');
        }

        // Delete from remote host
        const connection = await mysql.createConnection({
            host: database.host.host,
            port: database.host.port,
            user: database.host.username,
            password: database.host.password,
        });

        try {
            await connection.execute(`DROP DATABASE IF EXISTS \`${database.database}\``);
            await connection.execute(`DROP USER IF EXISTS ?@?`, [database.username, database.remote]);
        } catch (err) {
            console.error('Failed to delete database on host:', err);
            // Continue to delete from local DB even if remote fails (orphaned)
        } finally {
            await connection.end();
        }

        await prisma.database.delete({
            where: { id: dbId },
        });

        res.json({ message: 'Database deleted' });
    } catch (error) {
        next(error);
    }
});

// POST /api/servers/:id/databases/:dbId/rotate-password - Rotate password
router.post('/:id/databases/:dbId/rotate-password', async (req: AuthRequest, res, next) => {
    try {
        const { id, dbId } = req.params;
        await checkServerAccess(id, req.user!.id, 'database.update');

        const database = await prisma.database.findUnique({
            where: { id: dbId },
            include: { host: true },
        });

        if (!database || database.serverId !== id) {
            throw new AppError(404, 'Database not found');
        }

        const newPassword = crypto.randomBytes(16).toString('base64');

        // Update on remote host
        const connection = await mysql.createConnection({
            host: database.host.host,
            port: database.host.port,
            user: database.host.username,
            password: database.host.password,
        });

        try {
            await connection.execute(`ALTER USER ?@? IDENTIFIED BY ?`, [database.username, database.remote, newPassword]);
        } catch (err) {
            console.error('Failed to rotate password on host:', err);
            throw new AppError(500, 'Failed to rotate password on host');
        } finally {
            await connection.end();
        }

        await prisma.database.update({
            where: { id: dbId },
            data: { password: newPassword },
        });

        res.json({ message: 'Password rotated', password: newPassword });
    } catch (error) {
        next(error);
    }
});

export { router as databasesRouter };
