import { api } from './api';

export interface AIMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AIAction {
    id: string;
    type: string;
    description: string;
    data: Record<string, any>;
    status: 'pending' | 'approved' | 'executed' | 'rejected' | 'failed';
    result?: string;
}

export interface ChatResponse {
    message: string;
    actions: AIAction[];
    conversationId: string;
    requiresApproval: boolean;
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
}

// AI API service - Note: api client already has /api base and returns data directly
export const aiApi = {
    // Send a chat message
    async chat(serverId: string, message: string, conversationId?: string): Promise<ChatResponse> {
        // api.post returns data directly, not wrapped in .data
        return api.post<ChatResponse>('/ai/chat', {
            serverId,
            message,
            conversationId,
        });
    },

    // Execute an approved action
    async executeAction(actionId: string, approved: boolean): Promise<{ success: boolean; result: string }> {
        return api.post<{ success: boolean; result: string }>('/ai/execute', {
            actionId,
            approved,
        });
    },

    // Get server context
    async getContext(serverId: string): Promise<AIContext> {
        return api.get<AIContext>(`/ai/servers/${serverId}/context`);
    },

    // Get conversation history
    async getConversations(serverId: string): Promise<any[]> {
        return api.get<any[]>(`/ai/conversations/${serverId}`);
    },

    // Clear a conversation
    async clearConversation(conversationId: string): Promise<void> {
        await api.delete(`/ai/conversations/${conversationId}`);
    },

    // Get pending actions for a conversation
    async getActions(conversationId: string): Promise<AIAction[]> {
        return api.get<AIAction[]>(`/ai/actions/${conversationId}`);
    },
};
