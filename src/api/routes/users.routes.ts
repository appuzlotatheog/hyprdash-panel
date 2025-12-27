import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../lib/prisma.js';
import { authenticate, requireAdmin, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { AuditService } from '../../services/audit.service.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const updateUserSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
    email: z.string().email().optional(),
    role: z.enum(['ADMIN', 'MODERATOR', 'USER']).optional(),
});

const createUserSchema = z.object({
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.enum(['ADMIN', 'MODERATOR', 'USER']).default('USER'),
});

// GET /api/users - List all users (Admin only)
router.get('/', requireAdmin, async (_req: AuthRequest, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                twoFactorEnabled: true,
                createdAt: true,
                _count: {
                    select: { servers: true, apiKeys: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ users });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/:id - Get user details
router.get('/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        // Non-admins can only view themselves
        if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
            throw new AppError(403, 'Access denied');
        }

        const user = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                twoFactorEnabled: true,
                createdAt: true,
                updatedAt: true,
                servers: {
                    select: { id: true, name: true, status: true },
                },
                apiKeys: {
                    select: { id: true, name: true, lastUsedAt: true, createdAt: true },
                },
            },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        res.json({ user });
    } catch (error) {
        next(error);
    }
});

// POST /api/users - Create user (Admin only)
router.post('/', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const data = createUserSchema.parse(req.body);

        const existing = await prisma.user.findFirst({
            where: {
                OR: [{ email: data.email }, { username: data.username }],
            },
        });

        if (existing) {
            throw new AppError(400, 'User with this email or username already exists');
        }

        const hashedPassword = await bcrypt.hash(data.password, 12);

        const user = await prisma.user.create({
            data: {
                ...data,
                password: hashedPassword,
            },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                createdAt: true,
            },
        });

        // Log action
        await AuditService.log(req.user!.id, 'user.create', {
            userId: user.id,
            username: user.username,
            role: user.role,
        }, req.ip);

        res.status(201).json({ user });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// PATCH /api/users/:id - Update user
router.patch('/:id', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const data = updateUserSchema.parse(req.body);

        // Non-admins can only update themselves and cannot change role
        if (req.user?.role !== 'ADMIN') {
            if (req.user?.id !== id) {
                throw new AppError(403, 'Access denied');
            }
            delete data.role; // Non-admins cannot change their role
        }

        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        const updated = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                twoFactorEnabled: true,
                updatedAt: true,
            },
        });

        // Log action
        await AuditService.log(req.user!.id, 'user.update', {
            userId: id,
            updatedFields: Object.keys(data),
        }, req.ip);

        res.json({ user: updated });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', requireAdmin, async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        if (req.user?.id === id) {
            throw new AppError(400, 'Cannot delete your own account');
        }

        const user = await prisma.user.findUnique({
            where: { id },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        await prisma.user.delete({
            where: { id },
        });

        // Log action
        await AuditService.log(req.user!.id, 'user.delete', {
            userId: id,
            username: user.username,
        }, req.ip);

        res.json({ message: 'User deleted' });
    } catch (error) {
        next(error);
    }
});

// --- API Keys ---

// GET /api/users/:id/api-keys - List user's API keys
router.get('/:id/api-keys', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;

        if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
            throw new AppError(403, 'Access denied');
        }

        const apiKeys = await prisma.apiKey.findMany({
            where: { userId: id },
            select: {
                id: true,
                name: true,
                lastUsedAt: true,
                createdAt: true,
                // Don't expose the actual key
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ apiKeys });
    } catch (error) {
        next(error);
    }
});

// POST /api/users/:id/api-keys - Create API key
router.post('/:id/api-keys', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { name } = z.object({ name: z.string().min(1).max(100) }).parse(req.body);

        if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
            throw new AppError(403, 'Access denied');
        }

        const key = `gp_${uuidv4().replace(/-/g, '')}`;

        const apiKey = await prisma.apiKey.create({
            data: {
                userId: id,
                name,
                key,
            },
        });

        // Only return the key once on creation
        res.status(201).json({
            apiKey: {
                id: apiKey.id,
                name: apiKey.name,
                key, // Only shown once
                createdAt: apiKey.createdAt,
            },
            message: 'Save this key securely. It will not be shown again.',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// DELETE /api/users/:id/api-keys/:keyId - Delete API key
router.delete('/:id/api-keys/:keyId', async (req: AuthRequest, res, next) => {
    try {
        const { id, keyId } = req.params;

        if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
            throw new AppError(403, 'Access denied');
        }

        const apiKey = await prisma.apiKey.findFirst({
            where: { id: keyId, userId: id },
        });

        if (!apiKey) {
            throw new AppError(404, 'API key not found');
        }

        await prisma.apiKey.delete({
            where: { id: keyId },
        });

        res.json({ message: 'API key deleted' });
    } catch (error) {
        next(error);
    }
});

export { router as usersRouter };
