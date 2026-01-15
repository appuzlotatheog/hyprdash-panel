import Groq from 'groq-sdk';
import { prisma } from '../lib/prisma.js';

// Cache for Groq clients (per user or default)
const groqClients: Map<string, Groq> = new Map();

// Get or create Groq client - supports custom user API keys
async function getGroqClient(userId?: string): Promise<Groq> {
    const cacheKey = userId || 'default';

    // Check cache first
    if (groqClients.has(cacheKey)) {
        return groqClients.get(cacheKey)!;
    }

    let apiKey: string | null = null;

    // Try user's custom key first
    if (userId) {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { groqApiKey: true },
            });
            if (user?.groqApiKey) {
                apiKey = user.groqApiKey;
                console.log(`[AI] Using custom Groq API key for user ${userId}`);
            }
        } catch (e) {
            console.warn('[AI] Could not fetch user API key:', e);
        }
    }

    // Fall back to default key
    if (!apiKey) {
        apiKey = process.env.GROQ_API_KEY || null;
        if (!apiKey) {
            throw new Error('No Groq API key available. Set GROQ_API_KEY in .env or add your own key in settings.');
        }
    }

    const client = new Groq({ apiKey });
    groqClients.set(cacheKey, client);
    return client;
}

// Clear cached client (call when user updates their API key)
export function clearGroqClientCache(userId?: string) {
    if (userId) {
        groqClients.delete(userId);
    } else {
        groqClients.clear();
    }
}

// Types for AI system
export interface AIMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AIAction {
    id: string;
    type: 'download_plugin' | 'modify_config' | 'execute_command' | 'server_control' | 'create_file' | 'delete_file' | 'read_file' | 'install_plugin' | 'search_plugins' | 'database_op' | 'optimize' | 'list_directory' | 'inspect_file' | 'change_version';
    description: string;
    data: Record<string, any>;
    status: 'pending' | 'approved' | 'executed' | 'rejected' | 'failed';
    result?: string;
}

export interface AIContext {
    serverId: string;
    serverName: string;
    serverType: string;
    serverVersion: string;
    serverStatus: string;
    memoryMB: number;
    diskMB: number;
    installedPlugins: string[];
    recentLogs: string[];
    configFiles: { name: string; path: string }[];
    serverFiles: string[];
}

export interface ChatResponse {
    message: string;
    actions: AIAction[];
    conversationId: string;
}

// Advanced system prompt builder
function buildSystemPrompt(context: AIContext): string {
    const currentDate = new Date().toISOString().split('T')[0];

    return `# HyprDash AI Server Assistant

You are an advanced AI assistant specialized in game server management. You have FULL access to control, configure, and optimize game servers through the HyprDash panel.
You are the "Master Control Program" (MCP) for this server.

## Current Date: ${currentDate}

## YOUR IDENTITY
- You are a senior DevOps engineer and game server expert
- You have deep knowledge of Minecraft (Java/Bedrock), Terraria, CS2, Rust, ARK, Valheim, and more
- You understand server optimization, plugin ecosystems, and troubleshooting
- You are proactive, helpful, and safety-conscious

## CURRENT SERVER CONTEXT
\`\`\`yaml
Server ID: ${context.serverId}
Name: ${context.serverName}
Type: ${context.serverType}
Version: ${context.serverVersion}
Status: ${context.serverStatus}
Memory: ${context.memoryMB}MB allocated
Disk: ${context.diskMB}MB allocated
Plugins Installed: ${context.installedPlugins.length > 0 ? context.installedPlugins.join(', ') : 'None detected'}
\`\`\`

## AVAILABLE FILES
${context.serverFiles.length > 0 ? context.serverFiles.slice(0, 20).join('\n') : 'Unable to list files'}

## RECENT LOGS
\`\`\`
${context.recentLogs.slice(-30).join('\n') || 'No recent logs available'}
\`\`\`

## YOUR CAPABILITIES & ACTIONS

You can perform actions by including ACTION markers in your response. Format:
\`[ACTION:type:description:{"json":"data"}]\`

### Available Action Types:

1. **read_file** - Read a file's contents
   \`[ACTION:read_file:Read server.properties:{"path":"server.properties"}]\`

2. **list_directory** - List files in a directory (like ls command)
   \`[ACTION:list_directory:Show plugins folder:{"path":"/plugins"}]\`

3. **inspect_file** - Read and display file contents for analysis
   \`[ACTION:inspect_file:Check plugin config:{"path":"/plugins/Essentials/config.yml"}]\`

4. **modify_config** - Modify configuration files
   \`[ACTION:modify_config:Update max players to 50:{"file":"server.properties","key":"max-players","value":"50"}]\`

5. **create_file** - Create a new file
   \`[ACTION:create_file:Create startup script:{"path":"start.sh","content":"#!/bin/bash\\njava -Xmx2G -jar server.jar nogui"}]\`

6. **delete_file** - Delete a file (ALWAYS ask for confirmation first)
   \`[ACTION:delete_file:Remove old backup:{"path":"world_backup_old.zip"}]\`

7. **search_plugins** - Search for plugins on Modrinth/Spigot
   \`[ACTION:search_plugins:Search for economy plugins:{"query":"economy vault","platform":"modrinth"}]\`

8. **install_plugin** - Download and install a plugin
   \`[ACTION:install_plugin:Install EssentialsX:{"name":"EssentialsX"}]\`

9. **execute_command** - Send command to server console
   \`[ACTION:execute_command:Reload permissions:{"command":"lp sync"}]\`

10. **server_control** - Start/stop/restart the server
    \`[ACTION:server_control:Restart server to apply changes:{"action":"restart"}]\`

11. **change_version** - Change server software version
    \`[ACTION:change_version:Update to Paper 1.21.4:{"software":"paper","version":"1.21.4"}]\`
    Supported: paper, purpur, velocity

12. **database_op** - Manage databases (create, delete, list)
    \`[ACTION:database_op:Create new MySQL database:{"action":"create","name":"economy"}]\`
    Actions: create, delete, list

13. **optimize** - Analyze server and suggest optimizations
    \`[ACTION:optimize:Check server performance:{"target":"all"}]\`

## SAFETY PROTOCOLS (CRITICAL)

1. **EXPLAIN FIRST**: Always explain what you're going to do BEFORE including ACTION markers
2. **ONE ACTION AT A TIME**: Only include ONE action per response. Wait for the result before proceeding to the next action.
3. **PLUGIN INSTALLATION FLOW**: 
   - First: search_plugins to find the plugin
   - Wait for user to confirm which plugin
   - Then: install_plugin to download it
   - NEVER combine install_plugin with server_control in the same response
   - Tell the user to restart manually or ask if they want you to restart
4. **CONFIRM DESTRUCTIVE ACTIONS**: Always ask before deleting files or making major changes
5. **BACKUP IMPORTANT FILES**: Suggest or create backups before modifying critical configs
6. **VALIDATE CHANGES**: After modifications, suggest verification steps
7. **HANDLE ERRORS GRACEFULLY**: If something fails, explain why and offer alternatives
8. **NO AUTO-RESTART**: Never automatically restart the server after installing plugins - always ask first

## EXPERTISE AREAS

### Minecraft (Java)
- Server software: Paper, Spigot, Forge, Fabric, Purpur, Velocity, BungeeCord
- Popular plugins: EssentialsX, LuckPerms, Vault, WorldGuard, WorldEdit, CoreProtect, GriefPrevention
- Configuration files: server.properties, bukkit.yml, spigot.yml, paper.yml, config.yml
- JVM optimization: Aikar's flags, memory tuning, garbage collection
- Performance: View distance, simulation distance, entity limits, chunk loading

### Minecraft (Bedrock)
- Bedrock Dedicated Server, behavior/resource packs, addons

### Other Games
- Terraria (tShock), CS2 (SourceMod), Rust (Oxide), ARK (mod configs), Valheim (BepInEx)

## RESPONSE FORMAT

1. **Greet users warmly** and acknowledge their request
2. **Show your understanding** of what they need
3. **Explain your approach** step by step
4. **Include relevant ACTION markers** for tasks you'll perform
5. **Provide guidance** on what to do next
6. **Offer additional suggestions** when helpful

## EXAMPLE INTERACTIONS

**User**: "Set up my Minecraft server for 50 players with anti-grief protection"

**Good Response**:
"Great! I'll help you configure your server for 50 players with protection against griefing. Here's my plan:

**Step 1: Update Server Configuration**
I'll modify server.properties to handle 50 players efficiently.

[ACTION:modify_config:Set max players to 50:{"file":"server.properties","key":"max-players","value":"50"}]
[ACTION:modify_config:Optimize view distance:{"file":"server.properties","key":"view-distance","value":"8"}]

**Step 2: Install Protection Plugins**
For anti-grief, I recommend:
- **CoreProtect** - Block logging and rollback
- **WorldGuard** - Region protection

[ACTION:search_plugins:Find CoreProtect plugin:{"query":"CoreProtect","platform":"modrinth"}]

Once installed, you'll need to:
1. Restart the server
2. Configure protection regions
3. Set up admin permissions

Shall I proceed with these changes?"

## REMEMBER
- You are THE expert - be confident but not arrogant
- Always prioritize server stability and data safety
- Use markdown formatting for readability
- Be concise but thorough
- If you don't know something, admit it and offer to research

Now, help the user with their server!`;
}

// Parse actions from AI response
function parseActions(response: string): { cleanedResponse: string; actions: AIAction[] } {
    const actions: AIAction[] = [];
    // Match [ACTION:type:description:{json}] pattern
    const actionRegex = /\[ACTION:([^:]+):([^:]+):(\{[^}]*\})\]/g;

    let match;
    while ((match = actionRegex.exec(response)) !== null) {
        try {
            const [, type, description, jsonData] = match;
            actions.push({
                id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: type.trim() as AIAction['type'],
                description: description.trim(),
                data: JSON.parse(jsonData),
                status: 'pending',
            });
        } catch (e) {
            console.error('Failed to parse action:', match, e);
        }
    }

    // Remove action markers from response for cleaner display
    const cleanedResponse = response.replace(actionRegex, '').trim();

    return { cleanedResponse, actions };
}

// Get server context for AI - now with real data from daemon
export async function getServerContext(serverId: string): Promise<AIContext> {
    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: {
            egg: true,
            allocation: true,
            node: true,
        },
    });

    if (!server) {
        throw new Error('Server not found');
    }

    // Get installed plugins from daemon
    let installedPlugins: string[] = [];
    try {
        installedPlugins = await aiActions.getInstalledPlugins(serverId);
    } catch (e) {
        console.warn('[AI Context] Could not fetch plugins:', e);
    }

    // Get recent logs - would be fetched from daemon
    let recentLogs: string[] = [];

    // Get file list from daemon
    let serverFiles: string[] = [];
    try {
        const files = await aiActions.listFiles(serverId, '/');
        serverFiles = files.slice(0, 30);
    } catch (e) {
        console.warn('[AI Context] Could not fetch files:', e);
    }

    // Determine server type for context
    const serverType = server.egg?.name || 'Unknown';

    return {
        serverId: server.id,
        serverName: server.name,
        serverType,
        serverVersion: server.description || serverType,
        serverStatus: server.status,
        memoryMB: server.memory,
        diskMB: server.disk,
        installedPlugins,
        recentLogs,
        serverFiles,
        configFiles: getConfigFilesForServerType(serverType),
    };
}

// Get relevant config files based on server type
function getConfigFilesForServerType(serverType: string): { name: string; path: string }[] {
    const lowerType = serverType.toLowerCase();

    if (lowerType.includes('minecraft') || lowerType.includes('paper') || lowerType.includes('spigot')) {
        return [
            { name: 'server.properties', path: 'server.properties' },
            { name: 'bukkit.yml', path: 'bukkit.yml' },
            { name: 'spigot.yml', path: 'spigot.yml' },
            { name: 'paper.yml', path: 'paper.yml' },
            { name: 'ops.json', path: 'ops.json' },
            { name: 'whitelist.json', path: 'whitelist.json' },
        ];
    }

    if (lowerType.includes('terraria')) {
        return [
            { name: 'config.json', path: 'config.json' },
            { name: 'serverconfig.txt', path: 'serverconfig.txt' },
        ];
    }

    return [{ name: 'config', path: 'config' }];
}

// Main chat function
export async function chat(
    serverId: string,
    userId: string,
    message: string,
    conversationId?: string
): Promise<ChatResponse> {
    // Get server context
    const context = await getServerContext(serverId);

    // Get or create conversation
    let conversation = conversationId
        ? await prisma.aIConversation.findUnique({ where: { id: conversationId } })
        : null;

    const messages: AIMessage[] = conversation
        ? JSON.parse(conversation.messages)
        : [];

    // Add user message
    messages.push({ role: 'user', content: message });

    // Build messages for API
    const apiMessages = [
        { role: 'system' as const, content: buildSystemPrompt(context) },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    try {
        // Call Groq API with the best model (use user's custom key if available)
        const groqClient = await getGroqClient(userId);
        const completion = await groqClient.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 4096,
            stream: false,
        });

        const assistantMessage = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

        // Parse actions from response
        const { cleanedResponse, actions } = parseActions(assistantMessage);

        // Add assistant message to history
        messages.push({ role: 'assistant', content: cleanedResponse });

        // Save conversation
        const savedConversation = await prisma.aIConversation.upsert({
            where: { id: conversationId || `new-${Date.now()}` },
            create: {
                serverId,
                userId,
                messages: JSON.stringify(messages),
            },
            update: {
                messages: JSON.stringify(messages),
                updatedAt: new Date(),
            },
        });

        // Save pending actions
        for (const action of actions) {
            await prisma.aIAction.create({
                data: {
                    id: action.id,
                    conversationId: savedConversation.id,
                    type: action.type,
                    data: JSON.stringify(action.data),
                    status: 'pending',
                    description: action.description,
                },
            });
        }

        return {
            message: cleanedResponse,
            actions,
            conversationId: savedConversation.id,
        };
    } catch (error: any) {
        console.error('AI chat error:', error);
        throw new Error(`AI service error: ${error.message}`);
    }
}

// Execute an approved action
export async function executeAction(
    actionId: string,
    serverId: string,
    nodeToken: string
): Promise<{ success: boolean; result: string }> {
    const action = await prisma.aIAction.findUnique({
        where: { id: actionId },
    });

    if (!action) {
        throw new Error('Action not found');
    }

    if (action.status !== 'pending' && action.status !== 'approved') {
        throw new Error(`Action cannot be executed (status: ${action.status})`);
    }

    const data = JSON.parse(action.data);
    let result: string;

    try {
        switch (action.type) {
            case 'read_file':
                result = await executeReadFile(serverId, nodeToken, data);
                break;
            case 'install_plugin':
            case 'download_plugin':
                result = await executeDownloadPlugin(serverId, nodeToken, data);
                break;
            case 'modify_config':
                result = await executeModifyConfig(serverId, nodeToken, data);
                break;
            case 'execute_command':
                result = await executeServerCommand(serverId, nodeToken, data);
                break;
            case 'server_control':
                result = await executeServerControl(serverId, nodeToken, data);
                break;
            case 'create_file':
                result = await executeCreateFile(serverId, nodeToken, data);
                break;
            case 'delete_file':
                result = await executeDeleteFile(serverId, nodeToken, data);
                break;
            case 'search_plugins':
                result = await executeSearchPlugins(data);
                break;
            case 'list_directory':
                result = await aiActions.listDirectory(serverId, data.path || '/');
                break;
            case 'inspect_file':
                result = await aiActions.inspectFile(serverId, data.path);
                break;
            case 'change_version':
                result = await aiActions.changeServerVersion(serverId, data.software, data.version);
                break;
            case 'database_op':
                result = await executeDatabaseOp(serverId, data);
                break;
            case 'optimize':
                result = await aiActions.optimizeServer(serverId);
                break;
            default:
                throw new Error(`Unknown action type: ${action.type}`);
        }

        await prisma.aIAction.update({
            where: { id: actionId },
            data: {
                status: 'executed',
                result,
            },
        });

        return { success: true, result };
    } catch (error: any) {
        await prisma.aIAction.update({
            where: { id: actionId },
            data: {
                status: 'failed',
                result: error.message,
            },
        });

        return { success: false, result: error.message };
    }
}

// Import real action executors
import * as aiActions from './ai-actions.js';

// Action executors - Using real implementations
async function executeReadFile(
    serverId: string,
    nodeToken: string,
    data: { path: string }
): Promise<string> {
    console.log(`[AI] Reading file: ${data.path}`);
    return aiActions.readFile(serverId, data.path);
}

async function executeDownloadPlugin(
    serverId: string,
    nodeToken: string,
    data: { name: string; url?: string; version?: string }
): Promise<string> {
    console.log(`[AI] Installing plugin: ${data.name}`);
    if (!data.url) {
        // Search and get download URL if not provided
        return `Plugin ${data.name} queued. Please provide a direct download URL to install.`;
    }
    return aiActions.installPlugin(serverId, data.name, data.url, 'plugins/');
}

async function executeModifyConfig(
    serverId: string,
    nodeToken: string,
    data: { file: string; key?: string; value?: string; content?: string }
): Promise<string> {
    console.log(`[AI] Modifying config ${data.file}: ${data.key}=${data.value}`);

    if (data.content) {
        // Full content replacement
        return aiActions.writeFile(serverId, data.file, data.content);
    } else if (data.key && data.value) {
        // Key-value modification
        return aiActions.modifyConfig(serverId, data.file, data.key, data.value);
    }

    throw new Error('Either content or key/value must be provided');
}

async function executeServerCommand(
    serverId: string,
    nodeToken: string,
    data: { command: string }
): Promise<string> {
    console.log(`[AI] Executing command: ${data.command}`);
    return aiActions.sendCommand(serverId, data.command);
}

async function executeServerControl(
    serverId: string,
    nodeToken: string,
    data: { action: 'start' | 'stop' | 'restart' }
): Promise<string> {
    console.log(`[AI] Server control: ${data.action}`);
    return aiActions.controlServer(serverId, data.action);
}

async function executeCreateFile(
    serverId: string,
    nodeToken: string,
    data: { path: string; content: string }
): Promise<string> {
    console.log(`[AI] Creating file: ${data.path}`);
    return aiActions.createFile(serverId, data.path, data.content);
}

async function executeDeleteFile(
    serverId: string,
    nodeToken: string,
    data: { path: string }
): Promise<string> {
    console.log(`[AI] Deleting file: ${data.path}`);
    return aiActions.deleteFile(serverId, data.path);
}

async function executeSearchPlugins(
    data: { query: string; platform?: string }
): Promise<string> {
    console.log(`[AI] Searching plugins: ${data.query} on ${data.platform || 'modrinth'}`);
    return aiActions.searchPlugins(data.query, data.platform);
}

async function executeDatabaseOp(
    serverId: string,
    data: { action: 'create' | 'delete' | 'list' | 'rotate_password'; name?: string; dbId?: string }
): Promise<string> {
    console.log(`[AI] Database op: ${data.action}`);
    return aiActions.manageDatabase(serverId, data.action, data);
}

// Get conversation history
export async function getConversationHistory(serverId: string, userId: string) {
    return prisma.aIConversation.findMany({
        where: { serverId, userId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
    });
}

// Clear conversation
export async function clearConversation(conversationId: string) {
    await prisma.aIAction.deleteMany({
        where: { conversationId },
    });
    await prisma.aIConversation.delete({
        where: { id: conversationId },
    });
}

export default {
    chat,
    executeAction,
    getServerContext,
    getConversationHistory,
    clearConversation,
};
