import { useState, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { socketService } from '../services/socket';

export const useSocket = () => {
    const [socket, setSocket] = useState<Socket | null>(socketService.getSocket());

    useEffect(() => {
        // Check immediately
        const s = socketService.getSocket();
        if (s) {
            setSocket(s);
        }

        // Poll for socket availability if not yet connected
        const interval = setInterval(() => {
            const currentSocket = socketService.getSocket();
            if (currentSocket && currentSocket !== socket) {
                setSocket(currentSocket);
            }
        }, 500);

        return () => clearInterval(interval);
    }, [socket]);

    return socket;
};
