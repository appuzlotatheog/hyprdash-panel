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
        startup: 'java -Xms128M -XX:MaxRAMPercentage=95.0 -Dterminal.jline=false -Dterminal.ansi=true -jar {{SERVER_JARFILE}}',
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

cd /mnt/server

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
