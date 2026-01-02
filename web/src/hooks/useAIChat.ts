import { useState, useCallback } from 'react';
import { aiApi, AIMessage, AIAction } from '../services/ai';
import { toast } from 'sonner';

interface UseAIChatOptions {
    serverId: string;
    onAction?: (action: AIAction) => void;
}

interface UseAIChatReturn {
    messages: AIMessage[];
    actions: AIAction[];
    isLoading: boolean;
    error: string | null;
    conversationId: string | null;
    sendMessage: (message: string) => Promise<void>;
    approveAction: (actionId: string) => Promise<void>;
    rejectAction: (actionId: string) => Promise<void>;
    clearChat: () => void;
}

export function useAIChat({ serverId, onAction }: UseAIChatOptions): UseAIChatReturn {
    const [messages, setMessages] = useState<AIMessage[]>([]);
    const [actions, setActions] = useState<AIAction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);

    // Send a message to the AI
    const sendMessage = useCallback(async (message: string) => {
        if (!message.trim()) return;

        setIsLoading(true);
        setError(null);

        // Add user message immediately
        const userMessage: AIMessage = { role: 'user', content: message };
        setMessages(prev => [...prev, userMessage]);

        try {
            const response = await aiApi.chat(serverId, message, conversationId || undefined);

            // Safety check for response
            if (!response) {
                throw new Error('Empty response from AI service');
            }

            // Add AI response
            const aiMessage: AIMessage = { role: 'assistant', content: response.message || 'No response generated' };
            setMessages(prev => [...prev, aiMessage]);

            // Update conversation ID
            if (response.conversationId) {
                setConversationId(response.conversationId);
            }

            // Add any new actions
            if (response.actions && response.actions.length > 0) {
                setActions(prev => [...prev, ...response.actions]);

                // Notify about pending actions
                toast.info(`AI has ${response.actions.length} action(s) pending your approval`);

                // Callback for each action
                response.actions.forEach(action => onAction?.(action));
            }
        } catch (err: any) {
            const errorMessage = err?.response?.data?.error || err?.message || 'Failed to get AI response';
            setError(errorMessage);
            toast.error(errorMessage);

            // Remove the user message on error
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    }, [serverId, conversationId, onAction]);

    // Approve an action
    const approveAction = useCallback(async (actionId: string) => {
        try {
            const result = await aiApi.executeAction(actionId, true);

            // Update action status
            setActions(prev => prev.map(a =>
                a.id === actionId
                    ? { ...a, status: result.success ? 'executed' : 'failed', result: result.result }
                    : a
            ));

            if (result.success) {
                toast.success('Action executed successfully');
            } else {
                toast.error(`Action failed: ${result.result}`);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to execute action');
        }
    }, []);

    // Reject an action
    const rejectAction = useCallback(async (actionId: string) => {
        try {
            await aiApi.executeAction(actionId, false);

            // Update action status
            setActions(prev => prev.map(a =>
                a.id === actionId
                    ? { ...a, status: 'rejected' }
                    : a
            ));

            toast.info('Action rejected');
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Failed to reject action');
        }
    }, []);

    // Clear chat history
    const clearChat = useCallback(() => {
        if (conversationId) {
            aiApi.clearConversation(conversationId).catch(console.error);
        }
        setMessages([]);
        setActions([]);
        setConversationId(null);
        setError(null);
    }, [conversationId]);

    return {
        messages,
        actions,
        isLoading,
        error,
        conversationId,
        sendMessage,
        approveAction,
        rejectAction,
        clearChat,
    };
}
