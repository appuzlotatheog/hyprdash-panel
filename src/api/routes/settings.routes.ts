import { Router } from 'express';
import { mailService } from '../../services/mail.service.js';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../../middleware/auth.js';
import { prisma } from '../../lib/prisma.js';

const router = Router();

// Public settings (no auth required)
router.get('/public', async (req, res) => {
    try {
        const settings = await prisma.setting.findMany({
            where: {
                key: { in: ['panel_name'] }
            }
        });

        const config = settings.reduce((acc: Record<string, string>, curr: any) => ({
            ...acc,
            [curr.key]: curr.value
        }), {
            panel_name: 'HyprDash' // Default
        });

        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch public settings' });
    }
});

// Get all settings (Admin only)
router.get('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const settings = await prisma.setting.findMany();
        const config = settings.reduce((acc: Record<string, string>, curr: any) => ({
            ...acc,
            [curr.key]: curr.value
        }), {});
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings (Admin only)
router.post('/', authenticate, requireAdmin, async (req, res) => {
    try {
        const { panel_name } = req.body;

        if (panel_name) {
            await prisma.setting.upsert({
                where: { key: 'panel_name' },
                update: { value: panel_name },
                create: { key: 'panel_name', value: panel_name }
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

const smtpSchema = z.object({
    host: z.string().min(1),
    port: z.number().int().positive(),
    secure: z.boolean(),
    user: z.string().min(1),
    pass: z.string().min(1),
    from: z.string().email(),
});

// Get SMTP settings
router.get('/smtp', authenticate, requireAdmin, async (req, res) => {
    try {
        const config = await mailService.getSmtpConfig();
        if (config) {
            // Mask password
            config.pass = '********';
        }
        res.json({ config });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch SMTP settings' });
    }
});

// Update SMTP settings
router.post('/smtp', authenticate, requireAdmin, async (req, res) => {
    try {
        const data = smtpSchema.parse(req.body);
        await mailService.updateSmtpConfig(data);
        res.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            res.status(400).json({ error: error.errors });
        } else {
            res.status(500).json({ error: 'Failed to update SMTP settings' });
        }
    }
});

// Test SMTP settings
router.post('/smtp/test', authenticate, requireAdmin, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        await mailService.sendMail(
            email,
            'Test Email - Game Panel',
            '<h1>Test Email</h1><p>This is a test email from your Game Panel.</p>'
        );

        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message || 'Failed to send test email' });
    }
});

export default router;
