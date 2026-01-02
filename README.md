# HyprDash - Game Server Management Panel

A modern, beautiful game server management panel inspired by Pterodactyl.

## Quick Start

### Requirements
- Node.js 18+ 
- npm or yarn

### 1. Panel Setup

```bash
cd hyprdash-panel

# Copy environment file
cp .env.example .env

# Edit .env and set:
# - JWT_SECRET (generate a random string)
# - DATABASE_URL (keep as SQLite for development)

# Install dependencies
npm install

# Setup database
npx prisma db push
npx tsx prisma/seed.ts

# Start panel
npm run dev
```

### 2. Web Frontend Setup

```bash
cd hyprdash-panel/web

# Copy environment file
cp .env.example .env

# Edit .env and set VITE_API_URL to your panel URL

# Install dependencies
npm install

# Start frontend
npm run dev
```

### 3. Daemon Setup

```bash
cd hyprdash-daemon

# Copy environment file
cp .env.example .env

# Edit .env and set:
# - PANEL_URL (your panel URL)
# - NODE_TOKEN (get this from panel after creating a node)

# Install dependencies
npm install

# Start daemon
npm run dev
```

## First Time Setup

1. **Start the panel** (`npm run dev` in hyprdash-panel)
2. **Start the web frontend** (`npm run dev` in hyprdash-panel/web)
3. **Create admin account** - Visit http://localhost:5173 and register
4. **Create a Node** - Go to Nodes → Add Node
5. **Copy the Node Token** - You'll need this for the daemon
6. **Configure & start the daemon** with the node token
7. **Create a Server** - Go to Servers → Create Server

## Production Deployment

### Panel
```bash
# Build
npm run build

# Run with PM2
pm2 start dist/index.js --name "hyprdash-panel"
```

### Web Frontend
```bash
# Build
npm run build

# Serve with nginx or any static file server
# Files are in the 'dist' folder
```

### Daemon
```bash
# Build
npm run build

# Run with PM2
pm2 start dist/index.js --name "hyprdash-daemon"
```

## Features

- 🎮 Support for multiple game types (Minecraft, Terraria, CS2, Rust, etc.)
- 🤖 Discord bot hosting (Node.js & Python)
- 📁 File manager with code editor
- 💾 Automatic backups
- 📊 Resource monitoring
- 👥 Multi-user support with permissions
- 🔐 Two-factor authentication
- 🔌 Plugin manager (Modrinth & CurseForge)

## Default Eggs Included

- Minecraft: Vanilla, Paper, Forge, Fabric, Purpur, Bedrock
- Terraria
- Counter-Strike 2
- Rust
- ARK: Survival Evolved
- Valheim
- Generic Source Engine
- Discord Bot: Node.js & Python
- Node.js Application
- Python Application
- Bun Application
- Generic Application

## License

MIT
