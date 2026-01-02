import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Users, Wifi } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface Player {
    name: string;
    raw: any;
}

interface QueryResult {
    name: string;
    map: string;
    maxplayers: number;
    players: Player[];
    ping: number;
    connect: string;
}

export const PlayerStats: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const socket = useSocket();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<QueryResult | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    const fetchStats = async () => {
        if (!id) return;
        setLoading(true);
        try {
            await api.get(`/servers/${id}/query`);
            // Response will come via socket
        } catch (error) {
            console.error('Failed to query server:', error);
            toast.error('Failed to query server');
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!socket) return;

        const handleResponse = (response: { requestId: string; result: QueryResult }) => {
            if (response.requestId.startsWith(id!)) {
                setData(response.result);
                setLastUpdated(new Date());
                setLoading(false);
            }
        };

        const handleError = (response: { requestId: string; error: string }) => {
            if (response.requestId.startsWith(id!)) {
                toast.error(response.error);
                setLoading(false);
            }
        };

        socket.on('server:query:response', handleResponse);
        socket.on('server:query:error', handleError);

        // Initial fetch
        fetchStats();

        // Poll every 30 seconds
        const interval = setInterval(fetchStats, 30000);

        return () => {
            socket.off('server:query:response', handleResponse);
            socket.off('server:query:error', handleError);
            clearInterval(interval);
        };
    }, [socket, id]);

    if (!data && loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold font-display text-white">Player Statistics</h2>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchStats}
                    disabled={loading}
                    className="border-white/10 hover:bg-white/5"
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {data ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Stats Cards */}
                    <Card className="p-6 bg-black/40 border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400">
                                <Users className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-zinc-400">Online Players</p>
                                <p className="text-2xl font-mono text-white">
                                    {data.players.length} <span className="text-zinc-500 text-lg">/ {data.maxplayers}</span>
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-black/40 border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-green-500/10 text-green-400">
                                <Wifi className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-zinc-400">Latency</p>
                                <p className="text-2xl font-mono text-white">{data.ping} ms</p>
                            </div>
                        </div>
                    </Card>

                    <Card className="p-6 bg-black/40 border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-lg bg-purple-500/10 text-purple-400">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm text-zinc-400">Last Updated</p>
                                <p className="text-lg font-mono text-white">
                                    {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Player List */}
                    <Card className="col-span-1 md:col-span-3 bg-black/40 border-white/10 backdrop-blur-sm overflow-hidden">
                        <div className="p-4 border-b border-white/10">
                            <h3 className="font-semibold text-white">Player List</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/5 text-zinc-400 font-medium">
                                    <tr>
                                        <th className="px-6 py-3">Username</th>
                                        <th className="px-6 py-3">Score</th>
                                        <th className="px-6 py-3">Time Online</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.players.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="px-6 py-8 text-center text-zinc-500">
                                                No players online
                                            </td>
                                        </tr>
                                    ) : (
                                        data.players.map((player, i) => (
                                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                                <td className="px-6 py-3 font-medium text-white">{player.name || 'Unknown'}</td>
                                                <td className="px-6 py-3 text-zinc-400">{player.raw?.score || '-'}</td>
                                                <td className="px-6 py-3 text-zinc-400">
                                                    {player.raw?.time ? `${Math.floor(player.raw.time / 60)}m` : '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            ) : (
                <div className="text-center py-12 bg-black/20 rounded-lg border border-white/5">
                    <p className="text-zinc-500">Server is offline or unreachable</p>
                </div>
            )}
        </div>
    );
};
