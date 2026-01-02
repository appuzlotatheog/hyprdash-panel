import { Server as SocketServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import axios from 'axios';

// Singleton for socket server reference
let io: SocketServer | null = null;

export function setSocketServer(socketServer: SocketServer) {
    io = socketServer;
}

// Get daemon socket for a server's node
async function getDaemonSocket(serverId: string) {
    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: { node: true },
    });

    if (!server || !server.node) {
        throw new Error('Server or node not found');
    }

    if (!io) {
        throw new Error('Socket server not initialized');
    }

    // Get all sockets in the node's room
    const room = `node:${server.nodeId}`;
    const sockets = await io.in(room).fetchSockets();

    if (sockets.length === 0) {
        throw new Error('Daemon is not connected. Please ensure the daemon is running.');
    }

    return { socket: sockets[0], server, node: server.node };
}

// Helper to emit and wait for response with better error handling
function emitWithResponse(socket: any, event: string, data: any, timeout = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
        const requestId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const timer = setTimeout(() => {
            socket.off(`${event}:response`, responseHandler);
            socket.off(`${event}:error`, errorHandler);
            reject(new Error(`Request timeout for ${event}`));
        }, timeout);

        const responseHandler = (response: any) => {
            if (response.requestId === requestId) {
                clearTimeout(timer);
                socket.off(`${event}:response`, responseHandler);
                socket.off(`${event}:error`, errorHandler);
                resolve(response);
            }
        };

        const errorHandler = (error: any) => {
            if (error.requestId === requestId) {
                clearTimeout(timer);
                socket.off(`${event}:response`, responseHandler);
                socket.off(`${event}:error`, errorHandler);
                reject(new Error(error.error || 'Unknown error'));
            }
        };

        socket.on(`${event}:response`, responseHandler);
        socket.on(`${event}:error`, errorHandler);

        socket.emit(event, { ...data, requestId });
    });
}

// Read a file from the server
export async function readFile(serverId: string, filePath: string): Promise<string> {
    const { socket } = await getDaemonSocket(serverId);

    try {
        const response = await emitWithResponse(socket, 'files:read', {
            serverId,
            path: filePath,
        });
        return response.content;
    } catch (error: any) {
        throw new Error(`Cannot read file ${filePath}: ${error.message}`);
    }
}

// Write/modify a file on the server
export async function writeFile(serverId: string, filePath: string, content: string): Promise<string> {
    const { socket } = await getDaemonSocket(serverId);

    try {
        await emitWithResponse(socket, 'files:write', {
            serverId,
            path: filePath,
            content,
        });
        return `Successfully wrote to ${filePath}`;
    } catch (error: any) {
        throw new Error(`Cannot write file ${filePath}: ${error.message}`);
    }
}

// Modify a config file (key-value)
export async function modifyConfig(
    serverId: string,
    file: string,
    key: string,
    value: string
): Promise<string> {
    let content: string;
    try {
        content = await readFile(serverId, file);
    } catch {
        // File doesn't exist, create it
        content = '';
    }

    const lines = content.split('\n');
    let found = false;
    const newLines = lines.map(line => {
        // Handle properties format (key=value)
        if (line.trim().startsWith(`${key}=`) || line.trim().startsWith(`${key} =`)) {
            found = true;
            return `${key}=${value}`;
        }
        // Handle YAML format (key: value)
        if (line.trim().startsWith(`${key}:`) || line.trim().startsWith(`${key} :`)) {
            found = true;
            const indent = line.match(/^(\s*)/)?.[1] || '';
            return `${indent}${key}: ${value}`;
        }
        return line;
    });

    if (!found) {
        if (file.endsWith('.properties') || file === 'server.properties') {
            newLines.push(`${key}=${value}`);
        } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
            newLines.push(`${key}: ${value}`);
        } else {
            newLines.push(`${key}=${value}`);
        }
    }

    const newContent = newLines.join('\n');
    await writeFile(serverId, file, newContent);

    return `Updated ${key} to ${value} in ${file}`;
}

// Create a file
export async function createFile(serverId: string, filePath: string, content: string): Promise<string> {
    return writeFile(serverId, filePath, content);
}

// Delete a file
export async function deleteFile(serverId: string, filePath: string): Promise<string> {
    const { socket } = await getDaemonSocket(serverId);

    await emitWithResponse(socket, 'files:delete', {
        serverId,
        paths: [filePath],
    });

    return `Deleted ${filePath}`;
}

// Send command to server console
export async function sendCommand(serverId: string, command: string): Promise<string> {
    const { socket } = await getDaemonSocket(serverId);

    socket.emit('server:command', { serverId, command });

    return `Sent command: ${command}`;
}

// Control server (start/stop/restart)
export async function controlServer(serverId: string, action: 'start' | 'stop' | 'restart' | 'kill'): Promise<string> {
    const { socket } = await getDaemonSocket(serverId);

    // Get full server config for power action (needed for start/restart)
    const server = await prisma.server.findUnique({
        where: { id: serverId },
        include: {
            allocation: true,
            variables: true,
        },
    });

    if (!server) {
        throw new Error('Server not found');
    }

    // Get server mounts
    const serverMounts = await prisma.serverMount.findMany({
        where: { serverId },
        include: { mount: true },
    });

    const mounts = serverMounts.map(sm => ({
        source: sm.mount.source,
        target: sm.mount.target,
        readOnly: sm.mount.readOnly,
    }));

    // Send power action with full config (matches panel format)
    socket.emit('server:power', {
        serverId,
        action,
        config: {
            startup: server.startup,
            memory: server.memory,
            cpu: server.cpu,
            variables: server.variables,
            allocation: server.allocation,
            mounts,
        },
    });

    const statusMap: Record<string, string> = {
        start: 'STARTING',
        stop: 'STOPPING',
        restart: 'STARTING',
        kill: 'OFFLINE',
    };

    await prisma.server.update({
        where: { id: serverId },
        data: { status: statusMap[action] || 'OFFLINE' },
    });

    return `Server ${action} initiated`;
}

// Smart restart helper - starts if offline, restarts if running
export async function smartRestart(serverId: string): Promise<string> {
    const server = await prisma.server.findUnique({
        where: { id: serverId },
    });

    if (!server) {
        return 'Server not found';
    }

    if (server.status === 'OFFLINE') {
        await controlServer(serverId, 'start');
        return 'Server was offline, starting now...';
    } else if (server.status === 'RUNNING') {
        await controlServer(serverId, 'restart');
        return 'Server is running, restarting to apply changes...';
    } else {
        return `Server is currently ${server.status}. Please wait and try again.`;
    }
}

// Search for plugins on Modrinth
async function searchModrinth(query: string): Promise<any[]> {
    try {
        const response = await axios.get('https://api.modrinth.com/v2/search', {
            params: {
                query,
                facets: '[["project_type:plugin"]]',
                limit: 10,
            },
            headers: {
                'User-Agent': 'HyprDash/1.0 (contact@hyprdash.app)',
            },
            timeout: 10000,
        });
        return response.data.hits || [];
    } catch (error) {
        console.error('[AI] Modrinth search error:', error);
        return [];
    }
}

// Get download URL from Modrinth for a specific project
async function getModrinthDownloadUrl(projectSlug: string, minecraftVersion?: string): Promise<{ url: string; filename: string } | null> {
    try {
        console.log(`[AI] Fetching versions for project: ${projectSlug}`);

        const response = await axios.get(`https://api.modrinth.com/v2/project/${projectSlug}/version`, {
            headers: {
                'User-Agent': 'HyprDash/1.0 (contact@hyprdash.app)',
            },
            timeout: 15000,
        });

        const versions = response.data;
        console.log(`[AI] Found ${versions?.length || 0} versions`);

        if (!versions || versions.length === 0) {
            console.log('[AI] No versions found for project');
            return null;
        }

        // Find the best version (prefer stable, with Bukkit/Spigot/Paper support)
        let selectedVersion = versions[0];

        // Try to find a release version with common loaders
        for (const v of versions) {
            const loaders = v.loaders || [];
            const isBukkitCompatible = loaders.some((l: string) =>
                ['bukkit', 'spigot', 'paper', 'purpur', 'folia'].includes(l.toLowerCase())
            );

            if (isBukkitCompatible && v.version_type === 'release') {
                selectedVersion = v;
                break;
            }
        }

        console.log(`[AI] Selected version: ${selectedVersion.version_number} (${selectedVersion.version_type})`);

        const file = selectedVersion.files?.find((f: any) => f.primary) || selectedVersion.files?.[0];
        if (!file) {
            console.log('[AI] No files found in version');
            return null;
        }

        console.log(`[AI] File URL: ${file.url}`);
        console.log(`[AI] Filename: ${file.filename}`);

        // Verify it's a CDN URL, not a webpage
        if (!file.url.includes('cdn.modrinth.com')) {
            console.warn(`[AI] Warning: URL doesn't appear to be a CDN link: ${file.url}`);
        }

        return {
            url: file.url,
            filename: file.filename,
        };
    } catch (error: any) {
        console.error('[AI] Modrinth version fetch error:', error.message);
        return null;
    }
}

// Search for plugins (combined search)
export async function searchPlugins(query: string, platform: string = 'modrinth'): Promise<string> {
    try {
        const plugins = await searchModrinth(query);

        if (plugins.length === 0) {
            return `No plugins found matching "${query}" on Modrinth. Try a different search term.`;
        }

        const results = plugins.slice(0, 5).map((p: any, i: number) => {
            const downloads = p.downloads?.toLocaleString() || 'N/A';
            return `${i + 1}. **${p.title}** (${p.slug})\n   ${p.description?.slice(0, 80) || 'No description'}...\n   Downloads: ${downloads} | [View on Modrinth](https://modrinth.com/plugin/${p.slug})`;
        }).join('\n\n');

        return `Found ${plugins.length} plugins on Modrinth:\n\n${results}\n\n**To install**, tell me which plugin you want and I'll download it for you.`;
    } catch (error: any) {
        return `Plugin search failed: ${error.message}`;
    }
}

// Download and install a plugin
export async function installPlugin(
    serverId: string,
    name: string,
    url?: string,
    destination: string = 'plugins/'
): Promise<string> {
    const { socket, server } = await getDaemonSocket(serverId);

    let downloadUrl = url;
    let filename = `${name.replace(/[^a-zA-Z0-9]/g, '')}.jar`;

    // Filter out obviously fake/placeholder URLs - always search Modrinth for real URLs
    const isValidUrl = downloadUrl &&
        downloadUrl.startsWith('https://') &&
        !downloadUrl.includes('example.com') &&
        !downloadUrl.includes('placeholder') &&
        (downloadUrl.includes('cdn.modrinth.com') ||
            downloadUrl.includes('curseforge.com') ||
            downloadUrl.includes('github.com') ||
            downloadUrl.includes('spigotmc.org'));

    // Always search Modrinth if URL is invalid or not a known CDN
    if (!isValidUrl) {
        console.log(`[AI] Searching Modrinth for "${name}"... (provided URL was invalid or missing)`);
        const plugins = await searchModrinth(name);

        if (plugins.length === 0) {
            return `Could not find plugin "${name}" on Modrinth. Try searching for plugins first, then install by name.`;
        }

        // Get the best match - prefer exact name match
        const bestMatch = plugins.find(p =>
            p.title.toLowerCase() === name.toLowerCase() ||
            p.slug.toLowerCase() === name.toLowerCase()
        ) || plugins.find(p =>
            p.title.toLowerCase().includes(name.toLowerCase()) ||
            p.slug.toLowerCase().includes(name.toLowerCase())
        ) || plugins[0];

        console.log(`[AI] Found plugin: ${bestMatch.title} (slug: ${bestMatch.slug}, id: ${bestMatch.project_id})`);

        // Get download URL using slug
        const downloadInfo = await getModrinthDownloadUrl(bestMatch.slug || bestMatch.project_id);
        if (!downloadInfo) {
            return `Found plugin "${bestMatch.title}" but couldn't get download URL. The plugin may not have Bukkit/Paper releases.`;
        }

        downloadUrl = downloadInfo.url;
        filename = downloadInfo.filename;
        console.log(`[AI] Got CDN download URL: ${downloadUrl}`);
    } else {
        console.log(`[AI] Using provided URL: ${downloadUrl}`);
    }

    // Validate URL - should always have a URL at this point
    if (!downloadUrl || !downloadUrl.startsWith('https://')) {
        throw new Error('Failed to get a valid download URL. Only HTTPS URLs are allowed.');
    }

    // Emit download request to daemon
    socket.emit('ai:download-file', {
        serverId,
        url: downloadUrl,
        destination: `${destination}${filename}`,
        name,
    });

    // Also try the standard file download mechanism
    try {
        // Download the file ourselves and send to daemon
        console.log(`[AI] Downloading ${downloadUrl}...`);
        const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'HyprDash/1.0 (contact@hyprdash.app)',
            },
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024, // 50MB max
        });

        const base64Content = Buffer.from(response.data).toString('base64');

        // Use files:write with isBinary flag (daemon already supports this)
        socket.emit('files:write', {
            serverId,
            path: `${destination}${filename}`,
            content: base64Content,
            isBinary: true,
            requestId: `ai-upload-${Date.now()}`,
        });

        console.log(`[AI] Uploaded ${filename} to ${destination}`);
        return `✅ Downloaded and installed **${name}** (${filename}) to ${destination}\n\nRestart the server to load the plugin.`;
    } catch (downloadError: any) {
        console.error('[AI] Direct download failed:', downloadError.message);
        return `Found plugin "${name}" but download failed: ${downloadError.message}\n\nThe daemon may still be downloading it in the background.`;
    }
}

// Get file list for context
export async function listFiles(serverId: string, path: string = '/'): Promise<string[]> {
    try {
        const { socket } = await getDaemonSocket(serverId);
        const response = await emitWithResponse(socket, 'files:list', { serverId, path });
        return response.files?.map((f: any) => f.name) || [];
    } catch {
        return [];
    }
}

// Get recent logs
export async function getRecentLogs(serverId: string, lines: number = 50): Promise<string[]> {
    try {
        const { socket } = await getDaemonSocket(serverId);
        const response = await emitWithResponse(socket, 'server:logs', { serverId, lines });
        return response.logs || [];
    } catch {
        return [];
    }
}

// List directory contents (like ls command)
export async function listDirectory(serverId: string, path: string = '/'): Promise<string> {
    try {
        const { socket } = await getDaemonSocket(serverId);
        const response = await emitWithResponse(socket, 'files:list', { serverId, path });
        const files = response.files || [];

        if (files.length === 0) {
            return `Directory '${path}' is empty or does not exist.`;
        }

        const formatBytes = (bytes: number): string => {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        };

        const formatted = files.map((f: any) => {
            const icon = f.isDirectory ? '📁' : '📄';
            const size = f.isDirectory ? '' : ` (${formatBytes(f.size)})`;
            return `${icon} ${f.name}${size}`;
        }).join('\n');

        return `Contents of '${path}':\n${formatted}`;
    } catch (error: any) {
        return `Failed to list directory: ${error.message}`;
    }
}

// Inspect/read a file's contents
export async function inspectFile(serverId: string, path: string): Promise<string> {
    try {
        const content = await readFile(serverId, path);
        if (!content) {
            return `File '${path}' is empty or could not be read.`;
        }

        // Limit content length for context
        const maxLength = 5000;
        if (content.length > maxLength) {
            return `File '${path}' (showing first ${maxLength} chars):\n\`\`\`\n${content.substring(0, maxLength)}\n...\n[truncated]\n\`\`\``;
        }

        return `File '${path}':\n\`\`\`\n${content}\n\`\`\``;
    } catch (error: any) {
        return `Failed to read file: ${error.message}`;
    }
}

// Get list of installed plugins
export async function getInstalledPlugins(serverId: string): Promise<string[]> {
    try {
        const files = await listFiles(serverId, '/plugins');
        return files.filter(f => f.endsWith('.jar')).map(f => f.replace('.jar', ''));
    } catch {
        return [];
    }
}

// Change server version/software
export async function changeServerVersion(
    serverId: string,
    software: string,
    version: string
): Promise<string> {
    try {
        // Determine download URL based on software type
        let downloadUrl = '';
        let filename = 'server.jar';

        const softwareLower = software.toLowerCase();

        if (softwareLower === 'paper') {
            // Paper API
            const buildsRes = await axios.get(
                `https://api.papermc.io/v2/projects/paper/versions/${version}/builds`,
                { headers: { 'User-Agent': 'HyprDash-Panel/1.0' } }
            );
            const builds = buildsRes.data.builds;
            if (!builds || builds.length === 0) {
                return `No Paper builds found for version ${version}`;
            }
            const latestBuild = builds[builds.length - 1];
            const buildNum = latestBuild.build;
            const jarName = latestBuild.downloads?.application?.name || `paper-${version}-${buildNum}.jar`;
            downloadUrl = `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${buildNum}/downloads/${jarName}`;
            filename = jarName;
        } else if (softwareLower === 'purpur') {
            downloadUrl = `https://api.purpurmc.org/v2/purpur/${version}/latest/download`;
            filename = `purpur-${version}.jar`;
        } else if (softwareLower === 'velocity') {
            const buildsRes = await axios.get(
                `https://api.papermc.io/v2/projects/velocity/versions/${version}/builds`,
                { headers: { 'User-Agent': 'HyprDash-Panel/1.0' } }
            );
            const builds = buildsRes.data.builds;
            if (!builds || builds.length === 0) {
                return `No Velocity builds found for version ${version}`;
            }
            const latestBuild = builds[builds.length - 1];
            const jarName = latestBuild.downloads?.application?.name || `velocity-${version}.jar`;
            downloadUrl = `https://api.papermc.io/v2/projects/velocity/versions/${version}/builds/${latestBuild.build}/downloads/${jarName}`;
            filename = jarName;
        } else {
            return `Unsupported software: ${software}. Supported: paper, purpur, velocity`;
        }

        console.log(`[AI] Downloading ${software} ${version} from ${downloadUrl}`);

        // Download the JAR
        const { socket } = await getDaemonSocket(serverId);
        const response = await axios.get(downloadUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'HyprDash-Panel/1.0' },
            timeout: 120000,
            maxContentLength: 200 * 1024 * 1024, // 200MB max
        });

        const base64Content = Buffer.from(response.data).toString('base64');

        // Upload as server.jar (overwriting existing)
        socket.emit('files:write', {
            serverId,
            path: '/server.jar',
            content: base64Content,
            isBinary: true,
            requestId: `version-change-${Date.now()}`,
        });

        // Update database
        await prisma.server.update({
            where: { id: serverId },
            data: { description: `${software} ${version}` },
        });

        return `✅ Successfully downloaded and installed **${software} ${version}**!\n\nThe server JAR has been updated. Please restart the server to apply changes.`;
    } catch (error: any) {
        console.error('[AI] Version change failed:', error);
        return `Failed to change version: ${error.message}`;
    }
}

export default {
    readFile,
    writeFile,
    modifyConfig,
    createFile,
    deleteFile,
    sendCommand,
    controlServer,
    smartRestart,
    installPlugin,
    searchPlugins,
    listDirectory,
    inspectFile,
    getInstalledPlugins,
    changeServerVersion,
    listFiles,
    getRecentLogs,
    setSocketServer,
};
