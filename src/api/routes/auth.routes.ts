import { Router } from 'express';
import { z } from 'zod';
import { AuthService } from '../../services/auth.service.js';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { rateLimit } from 'express-rate-limit';

const router = Router();

// Rate limiting for auth endpoints
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { error: 'Too many login attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per hour per IP
    message: { error: 'Too many registration attempts. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 password reset requests per hour
    message: { error: 'Too many password reset requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

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

// Helper to get client IP
const getClientIp = (req: any): string => {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] ||
        req.connection?.remoteAddress ||
        req.ip ||
        'unknown';
};

// POST /api/auth/register
router.post('/register', registerLimiter, async (req, res, next) => {
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
router.post('/login', loginLimiter, async (req, res, next) => {
    try {
        const data = loginSchema.parse(req.body);
        const result = await AuthService.login({
            ...data,
            ipAddress: getClientIp(req),
            userAgent: req.headers['user-agent']
        });
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const sessionToken = req.headers['x-session-token'] as string;
        const result = await AuthService.logout(req.user!.id, sessionToken);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/logout-all
router.post('/logout-all', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const result = await AuthService.logoutAllDevices(req.user!.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res) => {
    res.json({ user: req.user });
});

// GET /api/auth/sessions
router.get('/sessions', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const sessions = await AuthService.getSessions(req.user!.id);
        res.json({ sessions });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/auth/sessions/:id
router.delete('/sessions/:id', authenticate, async (req: AuthRequest, res, next) => {
    try {
        const result = await AuthService.revokeSession(req.user!.id, req.params.id);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', passwordResetLimiter, async (req, res, next) => {
    try {
        const { email } = z.object({ email: z.string().email() }).parse(req.body);
        const result = await AuthService.requestPasswordReset(email);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, 'Invalid email format'));
        }
        next(error);
    }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, password } = z.object({
            token: z.string(),
            password: z.string().min(8)
        }).parse(req.body);
        const result = await AuthService.resetPassword(token, password);
        res.json(result);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
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
