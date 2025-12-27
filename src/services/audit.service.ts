import { prisma } from '../lib/prisma.js';

export class AuditService {
    static async log(userId: string, action: string, metadata?: any, ipAddress?: string) {
        try {
            await prisma.auditLog.create({
                data: {
                    userId,
                    action,
                    metadata: metadata ? JSON.stringify(metadata) : null,
                    ipAddress,
                },
            });
        } catch (error) {
            console.error('Failed to create audit log:', error);
        }
    }

    static async getLogs(page: number = 1, limit: number = 20, userId?: string) {
        const skip = (page - 1) * limit;
        const where = userId ? { userId } : {};

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            username: true,
                            email: true,
                        },
                    },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip,
                take: limit,
            }),
            prisma.auditLog.count({ where }),
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
