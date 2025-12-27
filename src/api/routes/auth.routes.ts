import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../../services/auth.service.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
    email: z.string().email(),
    username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/),
    password: z.string().min(8),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
    twoFactorCode: z.string().optional(),
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const data = registerSchema.parse(req.body);
        const result = await AuthService.register(data);
        res.status(201).json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await AuthService.login(data);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    res.json({ user: req.user });
});

// POST /api/auth/2fa/enable
router.post('/2fa/enable', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const result = await AuthService.enable2FA(req.user!.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/2fa/verify
router.post('/2fa/verify', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
        const result = await AuthService.verify2FA(req.user!.id, code);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, 'Invalid code format'));
        }
        next(error);
    }
});

// POST /api/auth/2fa/disable
router.post('/2fa/disable', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
        const result = await AuthService.disable2FA(req.user!.id, code);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, 'Invalid code format'));
        }
        next(error);
    }
});

// POST /api/auth/change-password
router.post('/change-password', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const schema = z.object({
            currentPassword: z.string(),
            newPassword: z.string().min(8),
        });
        const { currentPassword, newPassword } = schema.parse(req.body);
        const result = await AuthService.changePassword(req.user!.id, currentPassword, newPassword);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

export { router as authRouter };
