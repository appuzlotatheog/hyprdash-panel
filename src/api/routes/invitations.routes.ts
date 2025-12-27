import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../middleware/errorHandler.js';
import { mailService } from '../../services/mail.service.js';

const router = Router();

// Accept invitation and create account
router.post('/accept', async (req, res, next) => {
    try {
        const schema = z.object({
            token: z.string().min(1),
            username: z.string().min(3).max(50),
            password: z.string().min(8),
        });

        const { token, username, password } = schema.parse(req.body);

        // Find invitation
        const invitation = await prisma.invitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            throw new AppError(404, 'Invitation not found or already used');
        }

        // Check expiration
        if (new Date() > invitation.expiresAt) {
            await prisma.invitation.delete({ where: { id: invitation.id } });
            throw new AppError(400, 'Invitation has expired');
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: invitation.email },
        });

        if (existingUser) {
            // User registered elsewhere - just add as subuser
            await prisma.subuser.create({
                data: {
                    serverId: invitation.serverId,
                    userId: existingUser.id,
                    permissions: invitation.permissions,
                },
            });

            await prisma.invitation.delete({ where: { id: invitation.id } });

            return res.json({
                message: 'You already have an account. Subuser access granted.',
                redirect: '/login',
            });
        }

        // Check username availability
        const usernameExists = await prisma.user.findUnique({
            where: { username },
        });

        if (usernameExists) {
            throw new AppError(400, 'Username already taken');
        }

        // Create user
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                email: invitation.email,
                username,
                password: hashedPassword,
                role: 'USER',
            },
        });

        // Create subuser relationship
        await prisma.subuser.create({
            data: {
                serverId: invitation.serverId,
                userId: newUser.id,
                permissions: invitation.permissions,
            },
        });

        // Delete invitation
        await prisma.invitation.delete({ where: { id: invitation.id } });

        res.json({
            message: 'Account created successfully! You can now login.',
            redirect: '/login',
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

// Get invitation details (for the setup page)
router.get('/:token', async (req, res, next) => {
    try {
        const { token } = req.params;

        const invitation = await prisma.invitation.findUnique({
            where: { token },
        });

        if (!invitation) {
            throw new AppError(404, 'Invitation not found');
        }

        if (new Date() > invitation.expiresAt) {
            await prisma.invitation.delete({ where: { id: invitation.id } });
            throw new AppError(400, 'Invitation has expired');
        }

        // Get server name
        const server = await prisma.server.findUnique({
            where: { id: invitation.serverId },
            select: { name: true },
        });

        // Get inviter name
        const inviter = await prisma.user.findUnique({
            where: { id: invitation.invitedBy },
            select: { username: true },
        });

        res.json({
            email: invitation.email,
            serverName: server?.name || 'Unknown Server',
            invitedBy: inviter?.username || 'Unknown User',
            permissions: JSON.parse(invitation.permissions),
            expiresAt: invitation.expiresAt,
        });
    } catch (error) {
        next(error);
    }
});

// Helper function to create and send invitation
export async function createInvitation(
    email: string,
    serverId: string,
    permissions: string,
    invitedById: string,
    panelUrl: string
): Promise<void> {
    // Generate secure token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Create invitation record
    await prisma.invitation.create({
        data: {
            email,
            token,
            serverId,
            permissions,
            invitedBy: invitedById,
            expiresAt,
        },
    });

    // Get server and inviter details for email
    const server = await prisma.server.findUnique({
        where: { id: serverId },
        select: { name: true },
    });

    const inviter = await prisma.user.findUnique({
        where: { id: invitedById },
        select: { username: true },
    });

    // Get panel name
    const panelNameSetting = await prisma.setting.findUnique({
        where: { key: 'panel_name' },
    });
    const panelName = panelNameSetting?.value || 'HyprDash';

    const inviteUrl = `${panelUrl}/invite/${token}`;

    // Send invitation email
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0a0a0a; color: #e5e5e5; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: #111111; border-radius: 8px; overflow: hidden; border: 1px solid #262626; }
                .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 30px; text-align: center; }
                .header h1 { color: white; margin: 0; font-size: 24px; }
                .content { padding: 30px; }
                .content h2 { color: #3b82f6; margin-top: 0; }
                .info-box { background: #1a1a1a; border: 1px solid #262626; border-radius: 6px; padding: 15px; margin: 20px 0; }
                .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #262626; }
                .info-item:last-child { border-bottom: none; }
                .info-label { color: #888; }
                .info-value { color: #fff; font-weight: 500; }
                .btn { display: inline-block; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; border-top: 1px solid #262626; }
                .permissions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
                .perm-tag { background: #3b82f6; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; text-transform: uppercase; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎮 ${panelName}</h1>
                </div>
                <div class="content">
                    <h2>You've been invited!</h2>
                    <p><strong>${inviter?.username || 'Someone'}</strong> has invited you to access their game server on ${panelName}.</p>
                    
                    <div class="info-box">
                        <div class="info-item">
                            <span class="info-label">Server</span>
                            <span class="info-value">${server?.name || 'Game Server'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Your Email</span>
                            <span class="info-value">${email}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Expires</span>
                            <span class="info-value">${expiresAt.toLocaleDateString()}</span>
                        </div>
                    </div>

                    <p>Permissions granted:</p>
                    <div class="permissions">
                        ${JSON.parse(permissions).map((p: string) => `<span class="perm-tag">${p}</span>`).join('')}
                    </div>

                    <center>
                        <a href="${inviteUrl}" class="btn">Accept Invitation</a>
                    </center>

                    <p style="color: #888; font-size: 14px;">If the button doesn't work, copy this link:<br/><code style="color: #3b82f6;">${inviteUrl}</code></p>
                </div>
                <div class="footer">
                    This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
                </div>
            </div>
        </body>
        </html>
    `;

    await mailService.sendMail(
        email,
        `You've been invited to ${panelName}`,
        htmlContent
    );
}

export { router as invitationsRouter };
