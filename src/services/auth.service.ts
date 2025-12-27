import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';

export interface RegisterInput {
    email: string;
    username: string;
    password: string;
}

export interface LoginInput {
    email: string;
    password: string;
    twoFactorCode?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
    static async register(input: RegisterInput) {
        const { email, username, password } = input;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { username }],
            },
        });

        if (existingUser) {
            throw new AppError(400, 'User with this email or username already exists');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        // Check if this is the first user (make them admin)
        const userCount = await prisma.user.count();
        const role = userCount === 0 ? 'ADMIN' : 'USER';

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                username,
                password: hashedPassword,
                role,
            },
            select: {
                id: true,
                email: true,
                username: true,
                role: true,
                createdAt: true,
            },
        });

        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
        );

        return { user, token };
    }

    static async login(input: LoginInput) {
        const { email, password, twoFactorCode } = input;

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new AppError(401, 'Invalid credentials');
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            throw new AppError(401, 'Invalid credentials');
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled) {
            if (!twoFactorCode) {
                throw new AppError(400, '2FA code required', true);
            }

            const isValidCode = authenticator.verify({
                token: twoFactorCode,
                secret: user.twoFactorSecret!,
            });

            if (!isValidCode) {
                throw new AppError(401, 'Invalid 2FA code');
            }
        }

        // Generate token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
        );

        return {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
                twoFactorEnabled: user.twoFactorEnabled,
            },
            token,
        };
    }

    static async enable2FA(userId: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        if (user.twoFactorEnabled) {
            throw new AppError(400, '2FA is already enabled');
        }

        // Generate secret
        const secret = authenticator.generateSecret();

        // Generate QR code
        const otpauth = authenticator.keyuri(user.email, 'GamePanel', secret);
        const qrCode = await QRCode.toDataURL(otpauth);

        // Store secret temporarily (not enabled yet)
        await prisma.user.update({
            where: { id: userId },
            data: { twoFactorSecret: secret },
        });

        return { secret, qrCode };
    }

    static async verify2FA(userId: string, code: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || !user.twoFactorSecret) {
            throw new AppError(400, '2FA setup not initiated');
        }

        const isValid = authenticator.verify({
            token: code,
            secret: user.twoFactorSecret,
        });

        if (!isValid) {
            throw new AppError(401, 'Invalid verification code');
        }

        // Enable 2FA
        await prisma.user.update({
            where: { id: userId },
            data: { twoFactorEnabled: true },
        });

        return { message: '2FA enabled successfully' };
    }

    static async disable2FA(userId: string, code: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user || !user.twoFactorEnabled) {
            throw new AppError(400, '2FA is not enabled');
        }

        const isValid = authenticator.verify({
            token: code,
            secret: user.twoFactorSecret!,
        });

        if (!isValid) {
            throw new AppError(401, 'Invalid verification code');
        }

        await prisma.user.update({
            where: { id: userId },
            data: {
                twoFactorEnabled: false,
                twoFactorSecret: null,
            },
        });

        return { message: '2FA disabled successfully' };
    }

    static async changePassword(userId: string, currentPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) {
            throw new AppError(401, 'Current password is incorrect');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });

        return { message: 'Password changed successfully' };
    }
}
