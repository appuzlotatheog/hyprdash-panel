import { Router, Request, Response } from 'express';
import { authenticate } from '../../middleware/auth.js';
import aiService from '../../services/ai.service.js';
import { prisma } from '../../lib/prisma.js';

export const aiRouter = Router();

// All AI routes require authentication
aiRouter.use(authenticate);

// Helper function to verify server access
async function verifyServerAccess(serverId: string, userId: string): Promise<boolean> {
    const server = await prisma.server.findFirst({
        where: {
            id: serverId,
            OR: [
                { ownerId: userId },
                { subusers: { some: { userId } } },
            ],
        },
    });
    return !!server;
}

// Helper to get user role
async function isAdmin(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
    });
    return user?.role === 'ADMIN';
}

/**
 * POST /api/ai/chat
 * Send a message to the AI assistant
 */
aiRouter.post('/chat', async (req: Request, res: Response) => {
    try {
        const { serverId, message, conversationId } = req.body;
        const userId = (req as any).user.id;

        // Input validation
        if (!serverId || typeof serverId !== 'string') {
            return res.status(400).json({ error: 'serverId is required and must be a string' });
        }
        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'message is required and must be a string' });
        }
        if (message.length > 10000) {
            return res.status(400).json({ error: 'Message is too long (max 10000 characters)' });
        }

        // Verify user has access to this server
        const hasAccess = await verifyServerAccess(serverId, userId) || await isAdmin(userId);
        if (!hasAccess) {
            return res.status(404).json({ error: 'Server not found or access denied' });
        }

        const response = await aiService.chat(serverId, userId, message, conversationId);

        res.json({
            message: response.message,
            actions: response.actions,
            conversationId: response.conversationId,
            requiresApproval: response.actions.length > 0,
        });
    } catch (error: any) {
        console.error('AI chat error:', error);
        res.status(500).json({ error: error.message || 'AI service error' });
    }
});

/**
 * POST /api/ai/execute
 * Execute an approved AI action
 */
aiRouter.post('/execute', async (req: Request, res: Response) => {
    try {
        const { actionId, approved } = req.body;
        const userId = (req as any).user.id;

        // Input validation
        if (!actionId || typeof actionId !== 'string') {
            return res.status(400).json({ error: 'actionId is required' });
        }
        if (typeof approved !== 'boolean') {
            return res.status(400).json({ error: 'approved must be a boolean' });
        }

        // Get action and verify user has access
        const action = await prisma.aIAction.findUnique({
            where: { id: actionId },
            include: {
                conversation: true,
            },
        });

        if (!action) {
            return res.status(404).json({ error: 'Action not found' });
        }

        // Verify the user owns this conversation
        if (action.conversation.userId !== userId) {
            // Check if admin
            const admin = await isAdmin(userId);
            if (!admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        if (!approved) {
            // Reject the action
            await prisma.aIAction.update({
                where: { id: actionId },
                data: { status: 'rejected' },
            });
            return res.json({ success: true, message: 'Action rejected' });
        }

        // Get server and node token for execution
        const server = await prisma.server.findUnique({
            where: { id: action.conversation.serverId },
            include: { node: true },
        });

        if (!server || !server.node) {
            return res.status(404).json({ error: 'Server or node not found' });
        }

        const result = await aiService.executeAction(
            actionId,
            server.id,
            server.node.token
        );

        res.json(result);
    } catch (error: any) {
        console.error('AI execute error:', error);
        res.status(500).json({ error: error.message || 'Execution failed' });
    }
});

/**
 * GET /api/ai/servers/:serverId/context
 * Get server context for AI
 */
aiRouter.get('/servers/:serverId/context', async (req: Request, res: Response) => {
    try {
        const { serverId } = req.params;
        const userId = (req as any).user.id;

        // Verify user has access to this server
        const hasAccess = await verifyServerAccess(serverId, userId) || await isAdmin(userId);
        if (!hasAccess) {
            return res.status(404).json({ error: 'Server not found or access denied' });
        }

        const context = await aiService.getServerContext(serverId);
        res.json(context);
    } catch (error: any) {
        console.error('AI context error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ai/conversations/:serverId
 * Get conversation history for a server
 */
aiRouter.get('/conversations/:serverId', async (req: Request, res: Response) => {
    try {
        const { serverId } = req.params;
        const userId = (req as any).user.id;

        // Verify user has access to this server
        const hasAccess = await verifyServerAccess(serverId, userId) || await isAdmin(userId);
        if (!hasAccess) {
            return res.status(404).json({ error: 'Server not found or access denied' });
        }

        const conversations = await aiService.getConversationHistory(serverId, userId);

        // Parse messages for each conversation
        const parsed = conversations.map(c => ({
            ...c,
            messages: JSON.parse(c.messages),
        }));

        res.json(parsed);
    } catch (error: any) {
        console.error('AI conversations error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/ai/conversations/:id
 * Clear a conversation
 */
aiRouter.delete('/conversations/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const userId = (req as any).user.id;

        // Verify ownership
        const conversation = await prisma.aIConversation.findUnique({
            where: { id },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Check access
        if (conversation.userId !== userId) {
            const admin = await isAdmin(userId);
            if (!admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        await aiService.clearConversation(id);
        res.json({ success: true });
    } catch (error: any) {
        console.error('AI clear conversation error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ai/actions/:conversationId
 * Get pending actions for a conversation
 */
aiRouter.get('/actions/:conversationId', async (req: Request, res: Response) => {
    try {
        const { conversationId } = req.params;
        const userId = (req as any).user.id;

        // Verify ownership
        const conversation = await prisma.aIConversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        // Check access
        if (conversation.userId !== userId) {
            const admin = await isAdmin(userId);
            if (!admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        const actions = await prisma.aIAction.findMany({
            where: { conversationId },
            orderBy: { createdAt: 'asc' },
        });

        // Parse data for each action
        const parsed = actions.map(a => ({
            ...a,
            data: JSON.parse(a.data),
        }));

        res.json(parsed);
    } catch (error: any) {
        console.error('AI actions error:', error);
        res.status(500).json({ error: error.message });
    }
});
