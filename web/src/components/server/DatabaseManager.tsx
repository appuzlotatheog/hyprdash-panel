import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Database, Plus, Trash2, RefreshCw, Copy } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

interface DatabaseInfo {
    id: string;
    database: string;
    username: string;
    remote: string;
    host: {
        host: string;
        port: number;
    };
    password?: string; // Only available after rotation or creation if we return it
}

export const DatabaseManager: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [databases, setDatabases] = useState<DatabaseInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [newDbName, setNewDbName] = useState('');
    const [newDbRemote, setNewDbRemote] = useState('%');
    const [creating, setCreating] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});

    const fetchDatabases = async () => {
        try {
            const response = await api.get(`/servers/${id}/databases`);
            setDatabases((response as any).data);
        } catch (error) {
            console.error('Failed to fetch databases:', error);
            toast.error('Failed to fetch databases');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatabases();
    }, [id]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            await api.post(`/servers/${id}/databases`, {
                name: newDbName,
                remote: newDbRemote,
            });
            toast.success('Database created');
            setCreateOpen(false);
            setNewDbName('');
            setNewDbRemote('%');
            fetchDatabases();
        } catch (error: any) {
            console.error('Failed to create database:', error);
            toast.error(error.response?.data?.message || 'Failed to create database');
        } finally {
            setCreating(false);
        }
    };

    const handleDelete = async (dbId: string) => {
        if (!confirm('Are you sure you want to delete this database? This action cannot be undone.')) return;
        try {
            await api.delete(`/servers/${id}/databases/${dbId}`);
            toast.success('Database deleted');
            fetchDatabases();
        } catch (error) {
            console.error('Failed to delete database:', error);
            toast.error('Failed to delete database');
        }
    };

    const handleRotatePassword = async (dbId: string) => {
        if (!confirm('Are you sure you want to rotate the password? The application using this database will need to be updated.')) return;
        try {
            const response = await api.post(`/servers/${id}/databases/${dbId}/rotate-password`);
            toast.success('Password rotated');
            setVisiblePasswords(prev => ({ ...prev, [dbId]: (response as any).data.password }));
        } catch (error) {
            console.error('Failed to rotate password:', error);
            toast.error('Failed to rotate password');
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold font-display text-white">Databases</h2>
                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            New Database
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-zinc-900 border-zinc-800 text-white">
                        <DialogHeader>
                            <DialogTitle>Create New Database</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-zinc-400">Database Name</label>
                                <div className="flex items-center mt-1">
                                    <span className="bg-zinc-800 px-3 py-2 rounded-l-md text-zinc-400 border border-r-0 border-zinc-700 text-sm">
                                        s{id?.split('-')[0]}_
                                    </span>
                                    <Input
                                        value={newDbName}
                                        onChange={(e) => setNewDbName(e.target.value)}
                                        placeholder="my_db"
                                        className="rounded-l-none border-zinc-700 bg-zinc-900 focus:ring-primary"
                                        required
                                        pattern="[a-zA-Z0-9_]+"
                                    />
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">Only alphanumeric characters and underscores.</p>
                            </div>
                            <div>
                                <label className="text-sm font-medium text-zinc-400">Remote Connections</label>
                                <Input
                                    value={newDbRemote}
                                    onChange={(e) => setNewDbRemote(e.target.value)}
                                    placeholder="%"
                                    className="mt-1 border-zinc-700 bg-zinc-900"
                                    required
                                />
                                <p className="text-xs text-zinc-500 mt-1">% allows connections from any IP.</p>
                            </div>
                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={creating}>
                                    {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Create Database'}
                                </Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {databases.map((db) => (
                    <Card key={db.id} className="p-6 bg-black/40 border-white/10 backdrop-blur-sm">
                        <div className="flex flex-col md:flex-row gap-6 justify-between items-start">
                            <div className="flex items-start gap-4">
                                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 mt-1">
                                    <Database className="w-6 h-6" />
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-semibold text-white text-lg">{db.database}</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-zinc-400 mt-2">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-zinc-500 w-20">Endpoint:</span>
                                            <code className="bg-black/30 px-2 py-0.5 rounded select-all cursor-pointer hover:text-white transition-colors" onClick={() => copyToClipboard(`${db.host.host}:${db.host.port}`)}>
                                                {db.host.host}:{db.host.port}
                                            </code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-zinc-500 w-20">Username:</span>
                                            <code className="bg-black/30 px-2 py-0.5 rounded select-all cursor-pointer hover:text-white transition-colors" onClick={() => copyToClipboard(db.username)}>
                                                {db.username}
                                            </code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-zinc-500 w-20">Connections:</span>
                                            <code className="bg-black/30 px-2 py-0.5 rounded">
                                                {db.remote}
                                            </code>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-zinc-500 w-20">Password:</span>
                                            {visiblePasswords[db.id] ? (
                                                <div className="flex items-center gap-2">
                                                    <code className="bg-black/30 px-2 py-0.5 rounded select-all text-emerald-400">
                                                        {visiblePasswords[db.id]}
                                                    </code>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(visiblePasswords[db.id])}>
                                                        <Copy className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-600 italic">Hidden</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2 self-end md:self-start">
                                <Button variant="outline" size="sm" onClick={() => handleRotatePassword(db.id)}>
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Rotate Password
                                </Button>
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(db.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}

                {databases.length === 0 && !loading && (
                    <div className="text-center py-12 bg-black/20 rounded-lg border border-white/5">
                        <p className="text-zinc-500">No databases created yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
