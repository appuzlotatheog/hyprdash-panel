# 🚀 HyprDash - Game Server Management Panel

A modern, beautiful game server management panel inspired by Pterodactyl. Built with Node.js, React, and TypeScript.

> **Daemon Required**: This panel requires the [HyprDash Daemon](https://github.com/appuzlotatheog/hyprdash-daemon) to manage game servers.

---

## ✨ Features

- 🎮 **Multi-Game Support** - Minecraft, Terraria, CS2, Rust, ARK, Valheim, and more
- 🤖 **AI Assistant** - Natural language server management with Groq AI
- 📁 **File Manager** - Full file browser with code editor
- 💾 **Automatic Backups** - Scheduled backups with one-click restore
- 📊 **Resource Monitoring** - Real-time CPU, RAM, and disk usage
- 👥 **Multi-User** - Role-based permissions and subuser system
- 🔐 **Security** - Two-factor authentication and session management
- 🔌 **Plugin Manager** - Search and install plugins from Modrinth
- 🎨 **Modern UI** - Dark theme with beautiful design

---

## 📋 Requirements

- **Node.js 18+**
- **npm** or **yarn**
- **SQLite** (development) or **PostgreSQL** (production)

---

## 🛠️ Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/appuzlotatheog/hyprdash-panel.git
cd hyprdash-panel
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and configure:
nano .env
```

Required environment variables:
```env
PORT=3000
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-super-secret-jwt-key-change-me"
GROQ_API_KEY="your-groq-api-key"  # Get from https://console.groq.com/
```

### 3. Install Dependencies & Setup Database

```bash
# Install dependencies
npm install

# Create database tables
npx prisma db push

# Seed with default eggs (Minecraft, Terraria, etc.)
npx tsx prisma/seed.ts
```

### 4. Start the Panel

```bash
npm run dev
```

Panel API runs on `http://localhost:3000`

### 5. Start the Web Frontend

```bash
cd web
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## 🌐 Production Deployment

### Option 1: VPS/Dedicated Server

#### 1. Install Dependencies

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx

# Install PM2 globally
sudo npm install -g pm2
```

#### 2. Clone and Build Panel

```bash
cd /var/www
git clone https://github.com/appuzlotatheog/hyprdash-panel.git
cd hyprdash-panel

# Configure environment
cp .env.example .env
nano .env  # Set production values

# Install and build
npm install
npm run build

# Setup database
npx prisma db push
npx tsx prisma/seed.ts

# Start with PM2
pm2 start dist/index.js --name "hyprdash-panel"
pm2 save
pm2 startup
```

#### 3. Build Frontend

```bash
cd web
cp .env.example .env
nano .env  # Set VITE_API_URL to your domain

npm install
npm run build
```

#### 4. Configure NGINX

```nginx
# /etc/nginx/sites-available/hyprdash
server {
    listen 80;
    server_name panel.yourdomain.com;

    # Frontend (static files)
    location / {
        root /var/www/hyprdash-panel/web/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket Proxy
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/hyprdash /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Add SSL
sudo certbot --nginx -d panel.yourdomain.com
```

### Option 2: Docker (Coming Soon)

Docker support will be added in a future release.

---

## 🔧 First Time Setup

1. **Start Panel** - `npm run dev`
2. **Start Frontend** - `cd web && npm run dev`
3. **Create Account** - Visit `http://localhost:5173` and register
4. **Create Node** - Go to Admin → Nodes → Add Node
5. **Copy Node Token** - Save this for the daemon
6. **Setup Daemon** - Follow instructions at [hyprdash-daemon](https://github.com/appuzlotatheog/hyprdash-daemon)
7. **Create Server** - Go to Servers → Create Server

---

## 🎮 Supported Games (Default Eggs)

| Game | Server Types |
|------|--------------|
| Minecraft | Vanilla, Paper, Spigot, Forge, Fabric, Purpur, Bedrock |
| Terraria | tShock |
| Counter-Strike 2 | Dedicated Server |
| Rust | Dedicated Server |
| ARK: Survival Evolved | Dedicated Server |
| Valheim | Dedicated Server |
| Discord Bots | Node.js, Python |
| Generic | Node.js, Python, Bun |

---

## 📁 Project Structure

```
hyprdash-panel/
├── src/                    # Backend source
│   ├── api/routes/         # API endpoints
│   ├── services/           # Business logic
│   ├── middleware/         # Auth, validation
│   └── lib/                # Utilities
├── web/                    # React frontend
│   ├── src/components/     # UI components
│   ├── src/pages/          # Page components
│   └── src/services/       # API clients
├── prisma/                 # Database schema
└── deploy/                 # Deployment files
```

---

## 🔗 Related

- **Daemon**: [https://github.com/appuzlotatheog/hyprdash-daemon](https://github.com/appuzlotatheog/hyprdash-daemon)

---

## 📄 License

MIT License - Feel free to use, modify, and distribute.
