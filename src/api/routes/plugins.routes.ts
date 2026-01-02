import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { prisma } from '../../lib/prisma.js';
import { Server as SocketServer } from 'socket.io';

const router = Router();

router.use(authenticate);

// Helper to search Modrinth
async function searchModrinth(query: string, type: 'mod' | 'plugin' = 'mod') {
    // For plugins (Bukkit/Spigot/Paper) - use server_side filter
    // For mods (Fabric/Forge) - use loader categories
    let facets: string;

    if (type === 'plugin') {
        // Search for server-side plugins (Bukkit, Spigot, Paper, Purpur)
        facets = '[["server_side:required","server_side:optional"]]';
    } else {
        // Search for client/server mods (Fabric, Forge, Quilt)
        facets = '[["categories:fabric","categories:forge","categories:quilt","categories:neoforge"]]';
    }

    const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&limit=50&facets=${encodeURIComponent(facets)}`;
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'HyprDash/1.0.0 (contact@hyprdash.com)'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('Modrinth API error:', errorText);
        return { hits: [], total_hits: 0 };
    }
    return await response.json();
}

// Helper to search CurseForge
const CURSEFORGE_API_KEY = process.env.CURSEFORGE_API_KEY || '$2a$10$dCiL/2VeAOXYZHhUd0nr/OhtHo.P9h5pIYNhl9zlIRa0yZVMSuX3i';

async function searchCurseForge(query: string, type: 'mod' | 'plugin' = 'mod') {
    // Game ID: 432 = Minecraft
    // Class ID: 6 = Mods, 5 = Bukkit Plugins
    const classId = type === 'plugin' ? 5 : 6;
    const gameId = 432;

    try {
        const url = `https://api.curseforge.com/v1/mods/search?gameId=${gameId}&classId=${classId}&searchFilter=${encodeURIComponent(query)}&pageSize=50`;
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'x-api-key': CURSEFORGE_API_KEY
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('CurseForge API error:', errorText);
            return { hits: [], total_hits: 0 };
        }

        const data = await response.json();

        // Transform CurseForge response to match Modrinth format
        const hits = (data.data || []).map((mod: any) => ({
            project_id: `cf-${mod.id}`,
            title: mod.name,
            description: mod.summary,
            categories: mod.categories?.map((c: any) => c.name) || [],
            downloads: mod.downloadCount,
            icon_url: mod.logo?.thumbnailUrl || null,
            author: mod.authors?.[0]?.name || 'Unknown',
            versions: mod.latestFilesIndexes?.map((f: any) => f.gameVersion) || [],
            source: 'curseforge',
            curseforge_id: mod.id,
            latest_file: mod.latestFiles?.[0] || null
        }));

        return { hits, total_hits: data.pagination?.totalCount || hits.length };
    } catch (error) {
        console.error('CurseForge search error:', error);
        return { hits: [], total_hits: 0 };
    }
}

// GET /api/plugins/search
router.get('/search', async (req: AuthRequest, res, next) => {
    try {
        const { query, type } = z.object({
            query: z.string(),
            type: z.enum(['mod', 'plugin']).default('plugin'),
        }).parse(req.query);

        // Try Modrinth first
        let results: { hits: any[]; total_hits: number } = await searchModrinth(query, type as 'mod' | 'plugin');

        // If no results from Modrinth, try CurseForge
        if (!results.hits || results.hits.length === 0) {
            console.log('Modrinth returned no results, trying CurseForge...');
            results = await searchCurseForge(query, type as 'mod' | 'plugin');
        }

        return res.json(results);
    } catch (error) {
        console.error('Plugin search error:', error);
        next(error);
    }
});

// POST /api/servers/:id/plugins/install (mounted under /api/servers)
router.post('/:id/plugins/install', async (req: AuthRequest, res, next) => {
    try {
        const { id } = req.params;
        const { url, filename, path } = z.object({
            url: z.string().url(),
            filename: z.string(),
            path: z.string().default('/plugins'),
        }).parse(req.body);

        const server = await prisma.server.findUnique({
            where: { id },
            include: { subusers: true },
        });

        if (!server) {
            throw new AppError(404, 'Server not found');
        }

        // Check permissions
        const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
        const hasAccess =
            user?.role === 'ADMIN' ||
            server.ownerId === req.user!.id ||
            server.subusers.some(s => {
                const perms = JSON.parse(s.permissions) as string[];
                return perms.includes('files.write') || perms.includes('files');
            });

        if (!hasAccess) {
            throw new AppError(403, 'Access denied');
        }

        // Send download task to daemon
        const io = req.app.get('io') as SocketServer;
        io.to(`node:${server.nodeId}`).emit('files:download', {
            serverId: id,
            url,
            path: `${path}/${filename}`,
            requestId: `${id}-${Date.now()}`,
        });

        res.json({ message: 'Download started' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return next(new AppError(400, error.errors[0].message));
        }
        next(error);
    }
});

export { router as pluginsRouter };
