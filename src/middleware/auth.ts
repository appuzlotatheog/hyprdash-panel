import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        username: string;
        role: string;
    };
}

export const authenticate = async (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new AppError(401, 'Authentication required');
        }

        const token = authHeader.substring(7);
        const secret = process.env.JWT_SECRET || 'fallback-secret';

        const decoded = jwt.verify(token, secret) as {
            userId: string;
            email: string;
        };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
            },
        });

        if (!user) {
            throw new AppError(401, 'User not found');
        }

        req.user = user;
        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next(new AppError(401, 'Invalid token'));
        } else {
            next(error);
        }
    }
};

export const requireAdmin = (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
) => {
    if (req.user?.role !== 'ADMIN') {
        return next(new AppError(403, 'Admin access required'));
    }
    next();
};

export const requireModerator = (
    req: AuthRequest,
    _res: Response,
    next: NextFunction
) => {
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'MODERATOR') {
        return next(new AppError(403, 'Moderator access required'));
    }
    next();
};
