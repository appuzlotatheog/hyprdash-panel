import { prisma } from '../src/lib/prisma.js';

const defaultEggs = [
    {
        name: 'Minecraft: Vanilla',
        description: 'Official Minecraft Java Edition server from Mojang.',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui',
        stopCommand: 'stop',
        configFiles: JSON.stringify({
            'server.properties': {
                parser: 'properties',
                find: {
                    'server-port': '{{SERVER_PORT}}',
                    'server-ip': '{{SERVER_IP}}',
                },
            },
        }),
        scriptInstall: `#!/bin/bash
# Vanilla Minecraft Installation Script
MC_VERSION=\${MC_VERSION:-1.20.4}
JAR_NAME=\${SERVER_JARFILE:-server.jar}

echo "Installing Vanilla Minecraft $MC_VERSION..."

# Get version manifest
MANIFEST=$(curl -s https://piston-meta.mojang.com/mc/game/version_manifest_v2.json)

# Find version URL
if [ "$MC_VERSION" == "latest" ]; then
    MC_VERSION=$(echo $MANIFEST | jq -r '.latest.release')
fi

VERSION_URL=$(echo $MANIFEST | jq -r ".versions[] | select(.id == \\"$MC_VERSION\\") | .url")

if [ -z "$VERSION_URL" ] || [ "$VERSION_URL" == "null" ]; then
    echo "Version $MC_VERSION not found"
    exit 1
fi

# Get server download URL
SERVER_URL=$(curl -s $VERSION_URL | jq -r '.downloads.server.url')

# Download server
curl -o $JAR_NAME $SERVER_URL

# Accept EULA
echo "eula=true" > eula.txt

echo "Installation complete!"
`,
        variables: [
            {
                name: 'Minecraft Version',
                description: 'Version of Minecraft to install (e.g., 1.20.4).',
                envVariable: 'MC_VERSION',
                defaultValue: '1.20.4',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:20',
            },
        ],
    },
    {
        name: 'Minecraft: Paper',
        author: 'parker@pterodactyl.io',
        description: 'High performance Spigot fork that aims to fix gameplay and mechanics inconsistencies.',
        features: JSON.stringify(['eula', 'java_version', 'pid_limit']),
        dockerImages: JSON.stringify({
            'Java 21': 'ghcr.io/pterodactyl/yolks:java_21',
            'Java 17': 'ghcr.io/pterodactyl/yolks:java_17',
            'Java 11': 'ghcr.io/pterodactyl/yolks:java_11',
            'Java 8': 'ghcr.io/pterodactyl/yolks:java_8',
        }),
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}} nogui',
        stopCommand: 'stop',
        configFiles: JSON.stringify({
            'server.properties': {
                parser: 'properties',
                find: {
                    'server-ip': '0.0.0.0',
                    'server-port': '{{SERVER_PORT}}',
                    'query.port': '{{SERVER_PORT}}',
                },
            },
        }),
        configStartup: JSON.stringify({ done: ')! For help, type ' }),
        scriptInstall: `#!/bin/bash
# Paper Installation Script
PROJECT=paper
MINECRAFT_VERSION=\${MC_VERSION:-latest}
BUILD_NUMBER=\${PAPER_BUILD:-latest}

# Get latest version if needed
if [ "$MINECRAFT_VERSION" == "latest" ]; then
    MINECRAFT_VERSION=$(curl -s https://api.papermc.io/v2/projects/paper | jq -r '.versions[-1]')
fi

# Get latest build if needed
if [ "$BUILD_NUMBER" == "latest" ]; then
    BUILD_NUMBER=$(curl -s https://api.papermc.io/v2/projects/paper/versions/$MINECRAFT_VERSION | jq -r '.builds[-1]')
fi

JAR_NAME=paper-$MINECRAFT_VERSION-$BUILD_NUMBER.jar
DOWNLOAD_URL=https://api.papermc.io/v2/projects/paper/versions/$MINECRAFT_VERSION/builds/$BUILD_NUMBER/downloads/$JAR_NAME

echo "Downloading Paper $MINECRAFT_VERSION build $BUILD_NUMBER..."
curl -o \${SERVER_JARFILE:-server.jar} $DOWNLOAD_URL

# Accept EULA
echo "eula=true" > eula.txt

echo "Installation complete!"
`,
        scriptContainer: 'ghcr.io/pterodactyl/installers:alpine',
        variables: [
            {
                name: 'Minecraft Version',
                description: 'The version of minecraft to download. Leave at latest to always get the latest version.',
                envVariable: 'MC_VERSION',
                defaultValue: 'latest',
                userViewable: true,
                userEditable: true,
                rules: 'nullable|string|max:20',
            },
            {
                name: 'Server Jar File',
                description: 'The name of the server jarfile to run the server with.',
                envVariable: 'SERVER_JARFILE',
                defaultValue: 'server.jar',
                userViewable: true,
                userEditable: true,
                rules: 'required|regex:/^([\\w\\d._-]+)(\\.jar)$/',
            },
            {
                name: 'Build Number',
                description: 'The build number for the paper release. Leave at latest to always get the latest version.',
                envVariable: 'PAPER_BUILD',
                defaultValue: 'latest',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:20',
            },
        ],
    },
    {
        name: 'Minecraft: Forge',
        description: 'Minecraft Forge modded server for mod support.',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui',
        stopCommand: 'stop',
        configFiles: JSON.stringify({
            'server.properties': {
                parser: 'properties',
                find: {
                    'server-port': '{{SERVER_PORT}}',
                    'server-ip': '{{SERVER_IP}}',
                },
            },
        }),
        variables: [
            {
                name: 'Forge Version',
                description: 'Full Forge version (e.g., 1.20.4-49.0.0).',
                envVariable: 'FORGE_VERSION',
                defaultValue: '1.20.4-49.0.0',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:30',
            },
        ],
    },
    {
        name: 'Minecraft: Fabric',
        description: 'Lightweight Minecraft modding platform.',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui',
        stopCommand: 'stop',
        configFiles: JSON.stringify({
            'server.properties': {
                parser: 'properties',
                find: {
                    'server-port': '{{SERVER_PORT}}',
                    'server-ip': '{{SERVER_IP}}',
                },
            },
        }),
        scriptInstall: `#!/bin/bash
# Fabric Installation Script
MC_VERSION=\${MC_VERSION:-1.20.4}
FABRIC_VERSION=\${FABRIC_VERSION:-latest}
JAR_NAME=\${SERVER_JARFILE:-server.jar}

echo "Installing Fabric for Minecraft $MC_VERSION..."

# Download Fabric installer
curl -o fabric-installer.jar https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar

# Run installer
java -jar fabric-installer.jar server -mcversion $MC_VERSION -downloadMinecraft

# Rename server jar
mv fabric-server-launch.jar $JAR_NAME

# Accept EULA
echo "eula=true" > eula.txt

# Cleanup
rm fabric-installer.jar

echo "Installation complete!"
`,
        variables: [
            {
                name: 'Minecraft Version',
                description: 'Minecraft version for Fabric.',
                envVariable: 'MC_VERSION',
                defaultValue: '1.20.4',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:20',
            },
            {
                name: 'Fabric Loader Version',
                description: 'Fabric loader version.',
                envVariable: 'FABRIC_VERSION',
                defaultValue: 'latest',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:20',
            },
        ],
    },
    {
        name: 'Minecraft: Purpur',
        description: 'Fork of Paper with extra features and optimizations.',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar server.jar nogui',
        stopCommand: 'stop',
        configFiles: JSON.stringify({
            'server.properties': {
                parser: 'properties',
                find: {
                    'server-port': '{{SERVER_PORT}}',
                    'server-ip': '{{SERVER_IP}}',
                },
            },
        }),
        scriptInstall: `#!/bin/bash
# Purpur Installation Script
MC_VERSION=\${MC_VERSION:-1.20.4}
JAR_NAME=\${SERVER_JARFILE:-server.jar}

echo "Installing Purpur for Minecraft $MC_VERSION..."

# Get latest build for version
BUILD=$(curl -s https://api.purpurmc.org/v2/purpur/$MC_VERSION | jq -r '.builds.latest')

if [ "$BUILD" == "null" ]; then
    echo "Failed to get Purpur build for $MC_VERSION"
    exit 1
fi

# Download Purpur
curl -o $JAR_NAME https://api.purpurmc.org/v2/purpur/$MC_VERSION/$BUILD/download

# Accept EULA
echo "eula=true" > eula.txt

echo "Installation complete!"
`,
        variables: [
            {
                name: 'Minecraft Version',
                description: 'Minecraft version (e.g., 1.20.4).',
                envVariable: 'MC_VERSION',
                defaultValue: '1.20.4',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:20',
            },
        ],
    },
    {
        name: 'Minecraft: Bedrock Edition',
        description: 'Dedicated server for Minecraft Bedrock Edition.',
        startup: './bedrock_server',
        stopCommand: 'stop',
        configFiles: JSON.stringify({
            'server.properties': {
                parser: 'properties',
                find: {
                    'server-port': '{{SERVER_PORT}}',
                    'server-portv6': '{{SERVER_PORT}}',
                },
            },
        }),
        variables: [
            {
                name: 'Bedrock Version',
                description: 'Version of Bedrock server to install.',
                envVariable: 'BEDROCK_VERSION',
                defaultValue: 'latest',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:20',
            },
        ],
    },
    {
        name: 'Terraria',
        description: 'tModLoader and Vanilla Terraria server.',
        startup: './TerrariaServer.bin.x86_64 -config serverconfig.txt -port {{SERVER_PORT}}',
        stopCommand: 'exit',
        configFiles: JSON.stringify({
            'serverconfig.txt': {
                parser: 'file',
                find: {
                    'port': '{{SERVER_PORT}}',
                },
            },
        }),
        variables: [
            {
                name: 'World Name',
                description: 'Name of the world to create or load.',
                envVariable: 'WORLD_NAME',
                defaultValue: 'world',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
            {
                name: 'Max Players',
                description: 'Maximum number of players.',
                envVariable: 'MAX_PLAYERS',
                defaultValue: '8',
                userViewable: true,
                userEditable: true,
                rules: 'required|integer|min:1|max:255',
            },
        ],
    },
    {
        name: 'Counter-Strike 2',
        description: 'Valve Counter-Strike 2 dedicated server.',
        startup: './cs2 -dedicated -port {{SERVER_PORT}} +map {{MAP}} +maxplayers {{MAX_PLAYERS}}',
        stopCommand: 'quit',
        configFiles: null,
        variables: [
            {
                name: 'Map',
                description: 'Default map to load.',
                envVariable: 'MAP',
                defaultValue: 'de_dust2',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
            {
                name: 'Max Players',
                description: 'Maximum number of players.',
                envVariable: 'MAX_PLAYERS',
                defaultValue: '24',
                userViewable: true,
                userEditable: true,
                rules: 'required|integer|min:2|max:64',
            },
            {
                name: 'Game Mode',
                description: 'Game mode (competitive, casual, deathmatch).',
                envVariable: 'GAME_MODE',
                defaultValue: 'casual',
                userViewable: true,
                userEditable: true,
                rules: 'required|string',
            },
        ],
    },
    {
        name: 'Rust',
        description: 'Rust dedicated game server.',
        startup: './RustDedicated -batchmode +server.port {{SERVER_PORT}} +server.hostname "{{SERVER_NAME}}" +server.maxplayers {{MAX_PLAYERS}}',
        stopCommand: 'quit',
        configFiles: null,
        variables: [
            {
                name: 'Server Name',
                description: 'Display name of the server.',
                envVariable: 'SERVER_NAME',
                defaultValue: 'Rust Server',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:100',
            },
            {
                name: 'Max Players',
                description: 'Maximum number of players.',
                envVariable: 'MAX_PLAYERS',
                defaultValue: '50',
                userViewable: true,
                userEditable: true,
                rules: 'required|integer|min:1|max:500',
            },
            {
                name: 'World Size',
                description: 'Size of the procedurally generated map.',
                envVariable: 'WORLD_SIZE',
                defaultValue: '3500',
                userViewable: true,
                userEditable: true,
                rules: 'required|integer|min:1000|max:6000',
            },
        ],
    },
    {
        name: 'ARK: Survival Evolved',
        description: 'ARK: Survival Evolved dedicated server.',
        startup: './ShooterGameServer {{MAP}}?listen?SessionName={{SERVER_NAME}}?Port={{SERVER_PORT}} -server -log',
        stopCommand: 'DoExit',
        configFiles: null,
        variables: [
            {
                name: 'Map',
                description: 'Which map to load.',
                envVariable: 'MAP',
                defaultValue: 'TheIsland',
                userViewable: true,
                userEditable: true,
                rules: 'required|string',
            },
            {
                name: 'Server Name',
                description: 'Display name of the server.',
                envVariable: 'SERVER_NAME',
                defaultValue: 'ARK Server',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:100',
            },
            {
                name: 'Max Players',
                description: 'Maximum number of players.',
                envVariable: 'MAX_PLAYERS',
                defaultValue: '70',
                userViewable: true,
                userEditable: true,
                rules: 'required|integer|min:1|max:127',
            },
        ],
    },
    {
        name: 'Valheim',
        description: 'Valheim dedicated server.',
        startup: './valheim_server.x86_64 -name "{{SERVER_NAME}}" -port {{SERVER_PORT}} -world "{{WORLD_NAME}}" -password "{{SERVER_PASSWORD}}"',
        stopCommand: '',
        configFiles: null,
        variables: [
            {
                name: 'Server Name',
                description: 'Display name of the server.',
                envVariable: 'SERVER_NAME',
                defaultValue: 'Valheim Server',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:100',
            },
            {
                name: 'World Name',
                description: 'Name of the world save.',
                envVariable: 'WORLD_NAME',
                defaultValue: 'Dedicated',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
            {
                name: 'Server Password',
                description: 'Password to join the server (min 5 characters).',
                envVariable: 'SERVER_PASSWORD',
                defaultValue: 'changeme',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|min:5|max:50',
            },
        ],
    },
    {
        name: 'Generic Source Engine',
        description: 'Generic Source engine game server (GMod, TF2, CSS, etc).',
        startup: './srcds_run -game {{GAME}} -port {{SERVER_PORT}} +map {{MAP}} +maxplayers {{MAX_PLAYERS}}',
        stopCommand: 'quit',
        configFiles: null,
        variables: [
            {
                name: 'Game',
                description: 'Source game folder name (garrysmod, tf, cstrike).',
                envVariable: 'GAME',
                defaultValue: 'garrysmod',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:30',
            },
            {
                name: 'Map',
                description: 'Default map to load.',
                envVariable: 'MAP',
                defaultValue: 'gm_flatgrass',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
            {
                name: 'Max Players',
                description: 'Maximum number of players.',
                envVariable: 'MAX_PLAYERS',
                defaultValue: '24',
                userViewable: true,
                userEditable: true,
                rules: 'required|integer|min:2|max:128',
            },
        ],
    },
    // Discord Bot - JavaScript/Node.js
    {
        name: 'Discord Bot: Node.js',
        description: 'Discord bot running on Node.js. Supports Discord.js and other JS frameworks.',
        startup: 'npm install && node {{BOT_FILE}}',
        stopCommand: '^C',
        configFiles: JSON.stringify({}),
        scriptInstall: `#!/bin/bash
# Discord Bot Node.js Installation
BOT_FILE=\${BOT_FILE:-index.js}

echo "Setting up Node.js Discord bot environment..."

# Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "discord-bot",
  "version": "1.0.0",
  "description": "Discord Bot",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "discord.js": "^14.14.1"
  }
}
EOF
fi

# Create example bot file if it doesn't exist
if [ ! -f "$BOT_FILE" ]; then
    cat > $BOT_FILE << 'EOF'
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

client.once('ready', () => {
    console.log(\`Logged in as \${client.user.tag}!\`);
});

client.on('messageCreate', message => {
    if (message.content === '!ping') {
        message.reply('Pong!');
    }
});

// Replace with your bot token
client.login(process.env.BOT_TOKEN);
EOF
fi

npm install

echo "Installation complete! Set your BOT_TOKEN environment variable."
`,
        variables: [
            {
                name: 'Bot File',
                description: 'Main bot file to run.',
                envVariable: 'BOT_FILE',
                defaultValue: 'index.js',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
            {
                name: 'Bot Token',
                description: 'Your Discord bot token.',
                envVariable: 'BOT_TOKEN',
                defaultValue: '',
                userViewable: true,
                userEditable: true,
                rules: 'nullable|string|max:100',
            },
            {
                name: 'Node Environment',
                description: 'Node.js environment (development/production).',
                envVariable: 'NODE_ENV',
                defaultValue: 'production',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|in:development,production',
            },
        ],
    },
    // Discord Bot - Python
    {
        name: 'Discord Bot: Python',
        description: 'Discord bot running on Python. Supports discord.py and Pycord.',
        startup: 'python3 {{BOT_FILE}}',
        stopCommand: '^C',
        configFiles: JSON.stringify({}),
        scriptInstall: `#!/bin/bash
# Discord Bot Python Installation
BOT_FILE=\${BOT_FILE:-bot.py}

echo "Setting up Python Discord bot environment..."

# Create requirements.txt if it doesn't exist
if [ ! -f "requirements.txt" ]; then
    cat > requirements.txt << 'EOF'
discord.py>=2.3.0
python-dotenv>=1.0.0
EOF
fi

# Create example bot file if it doesn't exist
if [ ! -f "$BOT_FILE" ]; then
    cat > $BOT_FILE << 'EOF'
import discord
import os
from discord.ext import commands

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_ready():
    print(f'{bot.user} has connected to Discord!')

@bot.command()
async def ping(ctx):
    await ctx.send('Pong!')

# Replace with your bot token
bot.run(os.environ.get('BOT_TOKEN', 'YOUR_BOT_TOKEN'))
EOF
fi

# Install dependencies
pip3 install -r requirements.txt

echo "Installation complete! Set your BOT_TOKEN environment variable."
`,
        variables: [
            {
                name: 'Bot File',
                description: 'Main bot file to run.',
                envVariable: 'BOT_FILE',
                defaultValue: 'bot.py',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
            {
                name: 'Bot Token',
                description: 'Your Discord bot token.',
                envVariable: 'BOT_TOKEN',
                defaultValue: '',
                userViewable: true,
                userEditable: true,
                rules: 'nullable|string|max:100',
            },
        ],
    },
    // Node.js Application
    {
        name: 'Node.js Application',
        description: 'Generic Node.js application hosting. Perfect for web apps, APIs, and services.',
        startup: 'npm install && npm start',
        stopCommand: '^C',
        configFiles: JSON.stringify({}),
        scriptInstall: `#!/bin/bash
# Node.js Application Installation
MAIN_FILE=\${MAIN_FILE:-index.js}

echo "Setting up Node.js application environment..."

# Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "nodejs-app",
  "version": "1.0.0",
  "description": "Node.js Application",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF
fi

# Create example app if it doesn't exist
if [ ! -f "$MAIN_FILE" ]; then
    cat > $MAIN_FILE << 'EOF'
const express = require('express');
const app = express();
const port = process.env.SERVER_PORT || 3000;

app.get('/', (req, res) => {
    res.send('Hello World! Your Node.js app is running.');
});

app.listen(port, '0.0.0.0', () => {
    console.log(\`App listening at http://0.0.0.0:\${port}\`);
});
EOF
fi

npm install

echo "Installation complete!"
`,
        variables: [
            {
                name: 'Main File',
                description: 'Main application file to run.',
                envVariable: 'MAIN_FILE',
                defaultValue: 'index.js',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
            {
                name: 'Node Environment',
                description: 'Node.js environment (development/production).',
                envVariable: 'NODE_ENV',
                defaultValue: 'production',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|in:development,production',
            },
        ],
    },
    // Python Application
    {
        name: 'Python Application',
        description: 'Generic Python application hosting. Perfect for Flask, FastAPI, Django, and scripts.',
        startup: 'pip3 install -r requirements.txt 2>/dev/null; python3 {{MAIN_FILE}}',
        stopCommand: '^C',
        configFiles: JSON.stringify({}),
        scriptInstall: `#!/bin/bash
# Python Application Installation
MAIN_FILE=\${MAIN_FILE:-app.py}

echo "Setting up Python application environment..."

# Create requirements.txt if it doesn't exist
if [ ! -f "requirements.txt" ]; then
    cat > requirements.txt << 'EOF'
flask>=3.0.0
gunicorn>=21.0.0
EOF
fi

# Create example app if it doesn't exist
if [ ! -f "$MAIN_FILE" ]; then
    cat > $MAIN_FILE << 'EOF'
from flask import Flask
import os

app = Flask(__name__)

@app.route('/')
def hello():
    return 'Hello World! Your Python app is running.'

if __name__ == '__main__':
    port = int(os.environ.get('SERVER_PORT', 5000))
    app.run(host='0.0.0.0', port=port)
EOF
fi

pip3 install -r requirements.txt

echo "Installation complete!"
`,
        variables: [
            {
                name: 'Main File',
                description: 'Main application file to run.',
                envVariable: 'MAIN_FILE',
                defaultValue: 'app.py',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
        ],
    },
    // Generic Application
    {
        name: 'Generic Application',
        description: 'Generic application hosting with custom startup command.',
        startup: '{{STARTUP_CMD}}',
        stopCommand: '^C',
        configFiles: JSON.stringify({}),
        scriptInstall: `#!/bin/bash
echo "Generic application environment ready."
echo "Upload your application files and configure the startup command."
`,
        variables: [
            {
                name: 'Startup Command',
                description: 'Custom startup command to run your application.',
                envVariable: 'STARTUP_CMD',
                defaultValue: 'echo "Configure your startup command"',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:500',
            },
        ],
    },
    // Bun Application
    {
        name: 'Bun Application',
        description: 'Application running on Bun - fast JavaScript runtime.',
        startup: 'bun install && bun run {{MAIN_FILE}}',
        stopCommand: '^C',
        configFiles: JSON.stringify({}),
        scriptInstall: `#!/bin/bash
# Bun Application Installation
MAIN_FILE=\${MAIN_FILE:-index.ts}

echo "Setting up Bun application environment..."

# Install Bun if not present
if ! command -v bun &> /dev/null; then
    curl -fsSL https://bun.sh/install | bash
    export BUN_INSTALL="$HOME/.bun"
    export PATH="$BUN_INSTALL/bin:$PATH"
fi

# Create package.json if it doesn't exist
if [ ! -f "package.json" ]; then
    bun init -y
fi

# Create example app if it doesn't exist
if [ ! -f "$MAIN_FILE" ]; then
    cat > $MAIN_FILE << 'EOF'
const server = Bun.serve({
    port: process.env.SERVER_PORT || 3000,
    fetch(request) {
        return new Response("Hello from Bun!");
    },
});

console.log(\`Listening on localhost:\${server.port}\`);
EOF
fi

bun install

echo "Installation complete!"
`,
        variables: [
            {
                name: 'Main File',
                description: 'Main application file to run.',
                envVariable: 'MAIN_FILE',
                defaultValue: 'index.ts',
                userViewable: true,
                userEditable: true,
                rules: 'required|string|max:50',
            },
        ],
    },
];

async function seed() {
    console.log('🌱 Seeding database...');

    // Create default eggs
    for (const eggData of defaultEggs) {
        const { variables, ...eggInfo } = eggData;

        const existingEgg = await prisma.egg.findFirst({
            where: { name: eggInfo.name },
        });

        if (existingEgg) {
            console.log(`  ⏭️  Egg "${eggInfo.name}" already exists, skipping.`);
            continue;
        }

        const egg = await prisma.egg.create({
            data: {
                ...eggInfo,
                variables: {
                    create: variables,
                },
            },
        });

        console.log(`  ✅ Created egg: ${egg.name}`);
    }

    console.log('✅ Seeding complete!');
}

seed()
    .catch((e) => {
        console.error('Seeding failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
