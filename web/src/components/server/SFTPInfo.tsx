import { useState } from 'react'
import { Copy, Check, Server, Key, Globe, Lock } from 'lucide-react'
import { toast } from 'sonner'

interface SFTPInfoProps {
    server: {
        id: string
        name: string
        node?: {
            fqdn: string
        }
        allocation?: {
            ip: string
            port: number
        }
    }
    user?: {
        username: string
    }
}

export function SFTPInfo({ server, user }: SFTPInfoProps) {
    const [copied, setCopied] = useState<string | null>(null)

    const sftpHost = server.node?.fqdn || server.allocation?.ip || 'localhost'
    const sftpPort = 2022 // Standard SFTP port for panel
    const sftpUsername = `${user?.username || 'user'}.${server.id.split('-')[0]}`
    const sftpPath = `/servers/${server.id}`

    const copyToClipboard = async (value: string, field: string) => {
        try {
            await navigator.clipboard.writeText(value)
            setCopied(field)
            toast.success('Copied to clipboard')
            setTimeout(() => setCopied(null), 2000)
        } catch (err) {
            toast.error('Failed to copy')
        }
    }

    const connectionString = `sftp://${sftpUsername}@${sftpHost}:${sftpPort}${sftpPath}`

    const fields = [
        { label: 'Host', value: sftpHost, icon: Globe, field: 'host' },
        { label: 'Port', value: sftpPort.toString(), icon: Server, field: 'port' },
        { label: 'Username', value: sftpUsername, icon: Key, field: 'username' },
        { label: 'Password', value: 'Use your panel password', icon: Lock, field: 'password', copyable: false },
    ]

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Server className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-medium text-white">SFTP Connection</h3>
            </div>

            <p className="text-sm text-dark-400 mb-4">
                Use these credentials to connect to your server files via SFTP. Most FTP clients like FileZilla, WinSCP, or Cyberduck support SFTP.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fields.map(({ label, value, icon: Icon, field, copyable = true }) => (
                    <div key={field} className="bg-dark-800 border border-dark-700 rounded-sm p-3">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <Icon className="w-3 h-3 text-dark-500" />
                                <span className="text-xs text-dark-400 uppercase tracking-wider">{label}</span>
                            </div>
                            {copyable && (
                                <button
                                    onClick={() => copyToClipboard(value, field)}
                                    className="text-dark-500 hover:text-white transition-colors p-1"
                                    title="Copy to clipboard"
                                >
                                    {copied === field ? (
                                        <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                        <Copy className="w-3 h-3" />
                                    )}
                                </button>
                            )}
                        </div>
                        <p className={`font-mono text-sm ${copyable ? 'text-white' : 'text-dark-500 italic'}`}>
                            {value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Quick Connection String */}
            <div className="bg-black border border-dark-700 rounded-sm p-4 mt-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-dark-400 uppercase tracking-wider">Connection URL</span>
                    <button
                        onClick={() => copyToClipboard(connectionString, 'url')}
                        className="text-dark-500 hover:text-white transition-colors p-1 flex items-center gap-1 text-xs"
                    >
                        {copied === 'url' ? (
                            <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                Copied
                            </>
                        ) : (
                            <>
                                <Copy className="w-3 h-3" />
                                Copy
                            </>
                        )}
                    </button>
                </div>
                <code className="text-accent text-sm font-mono break-all select-all">
                    {connectionString}
                </code>
            </div>

            {/* Help Text */}
            <div className="bg-dark-900 border border-dark-700 rounded-sm p-4 text-xs text-dark-400">
                <p className="font-medium text-white mb-2">Quick Start:</p>
                <ol className="list-decimal list-inside space-y-1">
                    <li>Download an SFTP client (FileZilla, WinSCP, Cyberduck)</li>
                    <li>Create a new connection with the details above</li>
                    <li>Use your panel account password to authenticate</li>
                    <li>Navigate to your server files and start editing</li>
                </ol>
            </div>
        </div>
    )
}
