import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, Loader2, Package } from 'lucide-react';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface ModrinthResult {
    project_id: string;
    title: string;
    description: string;
    categories: string[];
    client_side: string;
    server_side: string;
    downloads: number;
    icon_url: string;
    author: string;
    versions: string[];
    latest_version: string;
}

export const PluginManager: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<ModrinthResult[]>([]);
    const [installing, setInstalling] = useState<string | null>(null);
    const [type, setType] = useState<'mod' | 'plugin'>('plugin');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        try {
            const response = await api.get<{ hits: ModrinthResult[] }>(`/plugins/search?query=${encodeURIComponent(query)}&type=${type}`);
            setResults(response.hits || []);
        } catch (error) {
            console.error('Search failed:', error);
            toast.error('Failed to search plugins');
        } finally {
            setLoading(false);
        }
    };

    const handleInstall = async (plugin: ModrinthResult) => {
        setInstalling(plugin.project_id);
        try {
            // Get latest version file URL (simplified - usually needs another API call to get version details)
            // For this demo, we'll assume we can get it or use a placeholder logic
            // In a real app, we'd fetch /project/{id}/version to get the file URL

            // Since we don't have the full version logic here, let's mock the install call 
            // but pointing to the actual endpoint we built

            // Fetch version info first
            const versionRes = await fetch(`https://api.modrinth.com/v2/project/${plugin.project_id}/version`);
            const versions = await versionRes.json();
            const latest = versions[0];
            const file = latest.files[0];

            await api.post(`/servers/${id}/plugins/install`, {
                url: file.url,
                filename: file.filename,
                path: type === 'plugin' ? '/plugins' : '/mods',
            });

            toast.success(`Started installing ${plugin.title}`);
        } catch (error) {
            console.error('Install failed:', error);
            toast.error('Failed to install plugin');
        } finally {
            setInstalling(null);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold font-display text-white">Plugin & Mod Manager</h2>
                <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-lg">
                    <button
                        onClick={() => setType('plugin')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${type === 'plugin'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                            }`}
                    >
                        Plugins
                    </button>
                    <button
                        onClick={() => setType('mod')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${type === 'mod'
                                ? 'bg-purple-600 text-white shadow-md'
                                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                            }`}
                    >
                        Mods
                    </button>
                </div>
            </div>

            <Card className="p-6 bg-black/40 border-white/10 backdrop-blur-sm">
                <form onSubmit={handleSearch} className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={`Search for ${type}s on Modrinth...`}
                            className="pl-10 bg-black/20 border-white/10 text-white"
                        />
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Search'}
                    </Button>
                </form>
            </Card>

            <div className="grid grid-cols-1 gap-4">
                {results.map((plugin) => (
                    <Card key={plugin.project_id} className="p-4 bg-black/40 border-white/10 hover:bg-white/5 transition-colors">
                        <div className="flex gap-4">
                            <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                                {plugin.icon_url ? (
                                    <img src={plugin.icon_url} alt={plugin.title} className="w-full h-full object-cover" />
                                ) : (
                                    <Package className="w-8 h-8 text-zinc-600" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-white text-lg truncate">{plugin.title}</h3>
                                        <p className="text-sm text-zinc-400">by {plugin.author}</p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => handleInstall(plugin)}
                                        disabled={!!installing}
                                    >
                                        {installing === plugin.project_id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Download className="w-4 h-4 mr-2" />
                                                Install
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-zinc-400 text-sm mt-2 line-clamp-2">{plugin.description}</p>
                                <div className="flex gap-2 mt-3">
                                    {plugin.categories.slice(0, 5).map(cat => (
                                        <span key={cat} className="px-2 py-1 rounded bg-white/5 text-xs text-zinc-400 capitalize">
                                            {cat}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}

                {results.length === 0 && !loading && query && (
                    <div className="text-center py-12 text-zinc-500">
                        No results found
                    </div>
                )}
            </div>
        </div>
    );
};
