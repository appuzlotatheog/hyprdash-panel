# 🎮 HyprDash Panel

A modern game server management panel with a beautiful web interface. Backend API + React frontend.

## Features

- 🔐 JWT Authentication with 2FA
- 👥 User Management with Roles & Subusers
- 🖥️ Server Management (create, start, stop, restart)
- 📁 File Manager with built-in editor
- 💾 Backup System
- ⏰ Scheduled Tasks
- 📊 Real-time Monitoring
- 🎨 Customizable Branding

## Quick Start

```bash
# Install dependencies
npm install
cd web && npm install && cd ..

# Configure
cp .env.example .env
# Edit .env with your database URL

# Setup database
npm run db:generate
npm run db:push
npm run db:seed

# Development
npm run dev

# Production
npm run build
npm start
```

## Project Structure

```
hyprdash-panel/
├── src/                # Backend API (Express + TypeScript)
│   ├── api/routes/     # REST endpoints
│   ├── services/       # Business logic
│   ├── middleware/     # Auth, error handling
│   └── websocket/      # Socket.IO
├── prisma/             # Database schema
├── web/                # React Frontend
│   └── src/
│       ├── components/
│       ├── pages/
│       └── services/
└── deploy/             # Installation scripts
```

## Environment Variables

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
PORT=3001
```

## Daemon

This panel requires the [HyprDash Daemon](https://github.com/appuzlotatheog/hyprdash-daemon) to be installed on each node.

## License

MIT
