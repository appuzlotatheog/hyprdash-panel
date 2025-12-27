import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import { rateLimit } from 'express-rate-limit';

import { authRouter } from './api/routes/auth.routes.js';
import { serversRouter } from './api/routes/servers.routes.js';
import { nodesRouter } from './api/routes/nodes.routes.js';
import { usersRouter } from './api/routes/users.routes.js';
import { eggsRouter } from './api/routes/eggs.routes.js';
import { filesRouter } from './api/routes/files.routes.js';
import { backupsRouter } from './api/routes/backups.routes.js';
import { schedulesRouter } from './api/routes/schedules.routes.js';
import { auditRouter } from './api/routes/audit.routes.js';
import settingsRouter from './api/routes/settings.routes.js';
import mountsRouter from './api/routes/mounts.routes.js';
import { invitationsRouter } from './api/routes/invitations.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { setupWebSocket } from './websocket/index.js';
import { prisma } from './lib/prisma.js';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new SocketServer(httpServer, {
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Increased for file operations
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/servers', serversRouter);
app.use('/api/servers', filesRouter);      // File routes under /api/servers/:id/files
app.use('/api/servers', backupsRouter);    // Backup routes under /api/servers/:id/backups
app.use('/api/servers', schedulesRouter);  // Schedule routes under /api/servers/:id/schedules
app.use('/api/nodes', nodesRouter);
app.use('/api/users', usersRouter);
app.use('/api/eggs', eggsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/audit', auditRouter);
app.use('/api/mounts', mountsRouter);
app.use('/api/invitations', invitationsRouter);

// Error handler
app.use(errorHandler);

// WebSocket setup
setupWebSocket(io);

// Graceful shutdown
const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await prisma.$disconnect();
    httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🚀 Panel server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket server ready`);
});

export { io };
