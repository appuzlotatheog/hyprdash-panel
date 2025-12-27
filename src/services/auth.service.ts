import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
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
    ipAddress?: string;
    userAgent?: string;
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_DURATION_DAYS = 7;

// Password strength validation
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export class AuthService {
    /**
     * Validate password strength
     */
    static validatePasswordStrength(password: string): void {
        if (password.length < 8) {
            throw new AppError(400, 'Password must be at least 8 characters');
        }
        if (!/[a-z]/.test(password)) {
            throw new AppError(400, 'Password must contain at least one lowercase letter');
        }
        if (!/[A-Z]/.test(password)) {
            throw new AppError(400, 'Password must contain at least one uppercase letter');
        }
        if (!/\d/.test(password)) {
            throw new AppError(400, 'Password must contain at least one number');
        }
        if (!/[@$!%*?&#^()_+=\-[\]{}|;:,.<>]/.test(password)) {
            throw new AppError(400, 'Password must contain at least one special character');
        }
    }

    /**
     * Check if account is locked
     */
    static async checkAccountLockout(userId: string): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { lockedUntil: true, failedLoginAttempts: true }
        });

        if (user?.lockedUntil && new Date() < user.lockedUntil) {
            const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            throw new AppError(423, `Account is locked. Try again in ${remainingMinutes} minute(s)`);
        }
    }

    /**
     * Record failed login attempt
     */
    static async recordFailedLogin(userId: string): Promise<void> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { failedLoginAttempts: true }
        });

        const newAttempts = (user?.failedLoginAttempts || 0) + 1;
        const shouldLock = newAttempts >= MAX_LOGIN_ATTEMPTS;

        await prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: newAttempts,
                lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null
            }
        });
    }

    /**
     * Record successful login
     */
    static async recordSuccessfulLogin(userId: string, ipAddress?: string): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: {
                failedLoginAttempts: 0,
                lockedUntil: null,
                lastLoginAt: new Date(),
                lastLoginIp: ipAddress || null
            }
        });
    }

    /**
     * Create a new session
     */
    static async createSession(userId: string, ipAddress?: string, userAgent?: string): Promise<string> {
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

        await prisma.session.create({
            data: {
                userId,
                token,
                ipAddress,
                userAgent,
                expiresAt
            }
        });

        // Clean up old sessions for this user (keep last 10)
        const sessions = await prisma.session.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip: 10
        });

        if (sessions.length > 0) {
            await prisma.session.deleteMany({
                where: { id: { in: sessions.map(s => s.id) } }
            });
        }

        return token;
    }

    static async register(input: RegisterInput) {
        const { email, username, password } = input;

        // Validate password strength
        this.validatePasswordStrength(password);

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
            { userId: user.id, email: user.email, tokenVersion: 0 },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
        );

        return { user, token };
    }

    static async login(input: LoginInput) {
        const { email, password, twoFactorCode, ipAddress, userAgent } = input;

        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            throw new AppError(401, 'Invalid credentials');
        }

        // Check if account is locked
        if (user.lockedUntil && new Date() < user.lockedUntil) {
            const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            throw new AppError(423, `Account is locked. Try again in ${remainingMinutes} minute(s)`);
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            // Record failed attempt
            await this.recordFailedLogin(user.id);

            const attemptsLeft = MAX_LOGIN_ATTEMPTS - ((user.failedLoginAttempts || 0) + 1);
            if (attemptsLeft > 0) {
                throw new AppError(401, `Invalid credentials. ${attemptsLeft} attempt(s) remaining`);
            } else {
                throw new AppError(423, 'Account has been locked due to too many failed attempts');
            }
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

        // Record successful login
        await this.recordSuccessfulLogin(user.id, ipAddress);

        // Create session
        const sessionToken = await this.createSession(user.id, ipAddress, userAgent);

        // Generate JWT token with tokenVersion
        const token = jwt.sign(
            { userId: user.id, email: user.email, tokenVersion: user.tokenVersion },
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
            sessionToken,
        };
    }

    static async logout(userId: string, sessionToken?: string) {
        if (sessionToken) {
            await prisma.session.deleteMany({
                where: { userId, token: sessionToken }
            });
        }
        return { message: 'Logged out successfully' };
    }

    static async logoutAllDevices(userId: string) {
        // Delete all sessions
        await prisma.session.deleteMany({
            where: { userId }
        });

        // Increment token version to invalidate all JWTs
        await prisma.user.update({
            where: { id: userId },
            data: { tokenVersion: { increment: 1 } }
        });

        return { message: 'Logged out from all devices' };
    }

    static async getSessions(userId: string) {
        const sessions = await prisma.session.findMany({
            where: { userId, expiresAt: { gt: new Date() } },
            select: {
                id: true,
                userAgent: true,
                ipAddress: true,
                createdAt: true,
                expiresAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return sessions;
    }

    static async revokeSession(userId: string, sessionId: string) {
        await prisma.session.deleteMany({
            where: { id: sessionId, userId }
        });
        return { message: 'Session revoked' };
    }

    static async requestPasswordReset(email: string) {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        // Always return success to prevent email enumeration
        if (!user) {
            return { message: 'If an account exists with this email, a reset link has been sent' };
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete any existing reset tokens for this email
        await prisma.passwordReset.deleteMany({
            where: { email }
        });

        // Create new reset token
        await prisma.passwordReset.create({
            data: {
                email,
                token,
                expiresAt
            }
        });

        // TODO: Send email with reset link
        // For now, return the token (in production, this would be emailed)
        console.log(`Password reset token for ${email}: ${token}`);

        return { message: 'If an account exists with this email, a reset link has been sent' };
    }

    static async resetPassword(token: string, newPassword: string) {
        // Validate password strength
        this.validatePasswordStrength(newPassword);

        // Find the reset token
        const resetRecord = await prisma.passwordReset.findUnique({
            where: { token }
        });

        if (!resetRecord || resetRecord.usedAt || new Date() > resetRecord.expiresAt) {
            throw new AppError(400, 'Invalid or expired reset token');
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password and invalidate all sessions
        await prisma.user.update({
            where: { email: resetRecord.email },
            data: {
                password: hashedPassword,
                tokenVersion: { increment: 1 }
            }
        });

        // Mark token as used
        await prisma.passwordReset.update({
            where: { id: resetRecord.id },
            data: { usedAt: new Date() }
        });

        // Delete all sessions for this user
        const user = await prisma.user.findUnique({
            where: { email: resetRecord.email }
        });
        if (user) {
            await prisma.session.deleteMany({
                where: { userId: user.id }
            });
        }

        return { message: 'Password reset successfully. Please log in with your new password.' };
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
        const otpauth = authenticator.keyuri(user.email, 'HyprDash', secret);
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

        // Validate new password strength
        this.validatePasswordStrength(newPassword);

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: userId },
            data: {
                password: hashedPassword,
                // Optionally invalidate all other sessions
                tokenVersion: { increment: 1 }
            },
        });

        return { message: 'Password changed successfully' };
    }
}
