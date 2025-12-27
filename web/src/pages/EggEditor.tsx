import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
    ArrowLeft,
    Save,
    Trash2,
    Plus,
    Download,
    Upload,
    Terminal,
    Variable,
    Box,
    Settings,
    FileCode,
    Play
} from 'lucide-react'
import { toast } from 'sonner'
import { eggsApi } from '../services/api'
import { useAuthStore } from '../stores/auth'

interface EggVariable {
    id: string
    name: string
    description?: string
    envVariable: string
    defaultValue?: string
    userViewable: boolean
    userEditable: boolean
    rules?: string
    fieldType: string
}

interface Egg {
    id: string
    name: string
    author?: string
    description?: string
    features?: string
    dockerImages?: string
    startup: string
    configFiles?: string
    configStartup?: string
    stopCommand: string
    scriptInstall?: string
    scriptContainer?: string
    fileDenylist?: string
    variables: EggVariable[]
}

export default function EggEditor() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const user = useAuthStore((state) => state.user)
    const isAdmin = user?.role === 'ADMIN'
    const isNew = id === 'new'

    const [activeTab, setActiveTab] = useState<'basic' | 'startup' | 'variables' | 'install' | 'docker'>('basic')
    const [formData, setFormData] = useState<Partial<Egg>>({
        name: '',
        author: '',
        description: '',
        startup: 'java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}',
        stopCommand: 'stop',
        dockerImages: JSON.stringify({ 'Java 21': 'ghcr.io/pterodactyl/yolks:java_21' }, null, 2),
        scriptInstall: '#!/bin/bash\necho "Installing server..."\n',
        scriptContainer: 'ghcr.io/pterodactyl/installers:alpine',
    })
    const [newVariable, setNewVariable] = useState({
        name: '',
        envVariable: '',
        defaultValue: '',
        description: '',
        userViewable: true,
        userEditable: true,
        rules: 'required|string',
        fieldType: 'text',
    })
    const [showImport, setShowImport] = useState(false)
    const [importJson, setImportJson] = useState('')

    const { data, isLoading } = useQuery({
        queryKey: ['egg', id],
        queryFn: () => eggsApi.get(id!),
        enabled: !isNew && !!id,
    })

    useEffect(() => {
        if ((data as any)?.egg) {
            setFormData((data as any).egg)
        }
    }, [data])

    const egg = (data as any)?.egg as Egg | undefined

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            if (isNew) {
                return eggsApi.create(data)
            } else {
                return eggsApi.update(id!, data)
            }
        },
        onSuccess: (res: any) => {
            toast.success(isNew ? 'Egg created!' : 'Egg saved!')
            queryClient.invalidateQueries({ queryKey: ['eggs'] })
            if (isNew && res.egg?.id) {
                navigate(`/admin/eggs/${res.egg.id}`)
            }
        },
        onError: (err: any) => toast.error(err.message || 'Failed to save'),
    })

    const deleteMutation = useMutation({
        mutationFn: () => eggsApi.delete(id!),
        onSuccess: () => {
            toast.success('Egg deleted')
            queryClient.invalidateQueries({ queryKey: ['eggs'] })
            navigate('/admin/eggs')
        },
        onError: (err: any) => toast.error(err.message || 'Failed to delete'),
    })

    const addVariableMutation = useMutation({
        mutationFn: (data: any) => eggsApi.addVariable(id!, data),
        onSuccess: () => {
            toast.success('Variable added')
            queryClient.invalidateQueries({ queryKey: ['egg', id] })
            setNewVariable({
                name: '',
                envVariable: '',
                defaultValue: '',
                description: '',
                userViewable: true,
                userEditable: true,
                rules: 'required|string',
                fieldType: 'text',
            })
        },
        onError: (err: any) => toast.error(err.message || 'Failed to add variable'),
    })

    const deleteVariableMutation = useMutation({
        mutationFn: (variableId: string) => eggsApi.deleteVariable(id!, variableId),
        onSuccess: () => {
            toast.success('Variable deleted')
            queryClient.invalidateQueries({ queryKey: ['egg', id] })
        },
        onError: (err: any) => toast.error(err.message || 'Failed to delete variable'),
    })

    const handleSave = () => {
        const saveData: any = { ...formData }
        // Parse JSON fields
        if (typeof saveData.dockerImages === 'string') {
            try { saveData.dockerImages = JSON.parse(saveData.dockerImages) } catch { }
        }
        if (typeof saveData.features === 'string') {
            try { saveData.features = JSON.parse(saveData.features) } catch { saveData.features = [] }
        }
        saveMutation.mutate(saveData)
    }

    const handleImport = async () => {
        try {
            const eggData = JSON.parse(importJson)
            const res = await fetch('/api/eggs/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify(eggData),
            })
            const data = await res.json()
            if (res.ok) {
                toast.success(data.message || 'Egg imported!')
                queryClient.invalidateQueries({ queryKey: ['eggs'] })
                setShowImport(false)
                setImportJson('')
                if (data.egg?.id) {
                    navigate(`/admin/eggs/${data.egg.id}`)
                }
            } else {
                toast.error(data.error || 'Import failed')
            }
        } catch (e: any) {
            toast.error('Invalid JSON format')
        }
    }

    const handleExport = async () => {
        if (!id || isNew) return
        const token = localStorage.getItem('token')
        const res = await fetch(`/api/eggs/${id}/export`, {
            headers: { 'Authorization': `Bearer ${token}` },
        })
        const data = await res.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `egg-${formData.name?.toLowerCase().replace(/\s+/g, '-')}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success('Egg exported!')
    }

    if (!isAdmin) {
        return (
            <div className="card text-center py-16">
                <Settings className="w-16 h-16 mx-auto text-dark-500 mb-4" />
                <h2 className="text-xl font-semibold text-white mb-2">Access Denied</h2>
                <p className="text-dark-400">Only administrators can edit eggs.</p>
            </div>
        )
    }

    if (isLoading && !isNew) {
        return <div className="card p-8 text-center text-dark-400">Loading egg...</div>
    }

    const tabs = [
        { id: 'basic', label: 'Basic Info', icon: Settings },
        { id: 'startup', label: 'Startup', icon: Play },
        { id: 'variables', label: 'Variables', icon: Variable },
        { id: 'install', label: 'Install Script', icon: Terminal },
        { id: 'docker', label: 'Docker', icon: Box },
    ]

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/eggs')} className="btn-secondary p-2">
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {isNew ? 'Create Egg' : `Edit: ${egg?.name || formData.name}`}
                        </h1>
                        <p className="text-dark-400">
                            {isNew ? 'Create a new game template' : 'Modify egg configuration'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Import
                    </button>
                    {!isNew && (
                        <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saveMutation.isPending}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saveMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-dark-700 pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 rounded-t-lg flex items-center gap-2 transition-colors ${activeTab === tab.id
                            ? 'bg-dark-800 text-white border-b-2 border-primary-500'
                            : 'text-dark-400 hover:text-white'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="card">
                {activeTab === 'basic' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Name</label>
                                <input
                                    type="text"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="Paper"
                                    className="input w-full"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-dark-400 mb-1">Author</label>
                                <input
                                    type="text"
                                    value={formData.author || ''}
                                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                    placeholder="admin@panel.local"
                                    className="input w-full"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Description</label>
                            <textarea
                                value={formData.description || ''}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="High performance Minecraft server..."
                                className="input w-full h-24 resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Stop Command</label>
                            <input
                                type="text"
                                value={formData.stopCommand || ''}
                                onChange={(e) => setFormData({ ...formData, stopCommand: e.target.value })}
                                placeholder="stop"
                                className="input w-full"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'startup' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Startup Configuration</h3>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Startup Command</label>
                            <p className="text-xs text-dark-500 mb-2">
                                Use {'{{VARIABLE}}'} syntax for variable substitution
                            </p>
                            <textarea
                                value={formData.startup || ''}
                                onChange={(e) => setFormData({ ...formData, startup: e.target.value })}
                                placeholder="java -Xms128M -Xmx{{SERVER_MEMORY}}M -jar {{SERVER_JARFILE}}"
                                className="input w-full h-24 font-mono text-sm resize-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Config Files (JSON)</label>
                            <textarea
                                value={formData.configFiles || '{}'}
                                onChange={(e) => setFormData({ ...formData, configFiles: e.target.value })}
                                placeholder='{"server.properties": {"parser": "properties", "find": {...}}}'
                                className="input w-full h-32 font-mono text-sm resize-none"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'variables' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Environment Variables</h3>

                        {/* Existing variables */}
                        {(egg?.variables || []).length > 0 && (
                            <div className="space-y-2 mb-6">
                                {egg?.variables.map((v) => (
                                    <div key={v.id} className="flex items-center gap-4 p-3 bg-dark-800/50 rounded-lg">
                                        <div className="flex-1">
                                            <p className="text-white font-medium">{v.name}</p>
                                            <p className="text-sm text-dark-400">{v.envVariable} = {v.defaultValue || '(empty)'}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-dark-500">
                                            {v.userViewable && <span className="px-2 py-1 bg-dark-700 rounded">Viewable</span>}
                                            {v.userEditable && <span className="px-2 py-1 bg-dark-700 rounded">Editable</span>}
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (confirm('Delete this variable?')) {
                                                    deleteVariableMutation.mutate(v.id)
                                                }
                                            }}
                                            className="text-red-400 hover:text-red-300 p-1"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Add new variable */}
                        {!isNew && (
                            <div className="p-4 border border-dark-700 rounded-lg space-y-4">
                                <h4 className="text-white font-medium">Add Variable</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm text-dark-400 mb-1">Name</label>
                                        <input
                                            type="text"
                                            value={newVariable.name}
                                            onChange={(e) => setNewVariable({ ...newVariable, name: e.target.value })}
                                            placeholder="Server Jar File"
                                            className="input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-dark-400 mb-1">Environment Variable</label>
                                        <input
                                            type="text"
                                            value={newVariable.envVariable}
                                            onChange={(e) => setNewVariable({ ...newVariable, envVariable: e.target.value })}
                                            placeholder="SERVER_JARFILE"
                                            className="input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-dark-400 mb-1">Default Value</label>
                                        <input
                                            type="text"
                                            value={newVariable.defaultValue}
                                            onChange={(e) => setNewVariable({ ...newVariable, defaultValue: e.target.value })}
                                            placeholder="server.jar"
                                            className="input w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-dark-400 mb-1">Rules</label>
                                        <input
                                            type="text"
                                            value={newVariable.rules}
                                            onChange={(e) => setNewVariable({ ...newVariable, rules: e.target.value })}
                                            placeholder="required|string|max:50"
                                            className="input w-full"
                                        />
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-sm text-dark-400">
                                        <input
                                            type="checkbox"
                                            checked={newVariable.userViewable}
                                            onChange={(e) => setNewVariable({ ...newVariable, userViewable: e.target.checked })}
                                        />
                                        User can view
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-dark-400">
                                        <input
                                            type="checkbox"
                                            checked={newVariable.userEditable}
                                            onChange={(e) => setNewVariable({ ...newVariable, userEditable: e.target.checked })}
                                        />
                                        User can edit
                                    </label>
                                </div>
                                <button
                                    onClick={() => addVariableMutation.mutate(newVariable)}
                                    disabled={!newVariable.name || !newVariable.envVariable}
                                    className="btn-primary flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Variable
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'install' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Installation Script</h3>
                        <p className="text-sm text-dark-400">
                            This script runs when a server is created to download and set up the game files.
                        </p>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Script Container</label>
                            <input
                                type="text"
                                value={formData.scriptContainer || ''}
                                onChange={(e) => setFormData({ ...formData, scriptContainer: e.target.value })}
                                placeholder="ghcr.io/pterodactyl/installers:alpine"
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Installation Script</label>
                            <textarea
                                value={formData.scriptInstall || ''}
                                onChange={(e) => setFormData({ ...formData, scriptInstall: e.target.value })}
                                placeholder="#!/bin/bash&#10;echo 'Installing...'"
                                className="input w-full h-80 font-mono text-sm resize-none"
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'docker' && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Docker Images</h3>
                        <p className="text-sm text-dark-400 mb-4">
                            Define available Docker images. Users can select which version to use.
                        </p>
                        <div>
                            <label className="block text-sm text-dark-400 mb-1">Docker Images (JSON)</label>
                            <textarea
                                value={formData.dockerImages || '{}'}
                                onChange={(e) => setFormData({ ...formData, dockerImages: e.target.value })}
                                placeholder='{"Java 21": "ghcr.io/pterodactyl/yolks:java_21"}'
                                className="input w-full h-48 font-mono text-sm resize-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Delete button */}
            {!isNew && (
                <div className="card border-red-500/30 bg-red-500/5">
                    <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
                    <p className="text-sm text-dark-400 mb-4">
                        Deleting an egg will prevent any associated servers from starting properly.
                    </p>
                    <button
                        onClick={() => {
                            if (confirm('Are you sure you want to delete this egg?')) {
                                deleteMutation.mutate()
                            }
                        }}
                        disabled={deleteMutation.isPending}
                        className="btn-danger flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete Egg'}
                    </button>
                </div>
            )}

            {/* Import Modal */}
            {showImport && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="card max-w-2xl w-full max-h-[80vh] overflow-auto">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <FileCode className="w-5 h-5" />
                            Import Pterodactyl Egg
                        </h3>
                        <p className="text-sm text-dark-400 mb-4">
                            Paste the contents of a Pterodactyl egg JSON file below.
                        </p>
                        <textarea
                            value={importJson}
                            onChange={(e) => setImportJson(e.target.value)}
                            placeholder="Paste egg JSON here..."
                            className="input w-full h-64 font-mono text-sm mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowImport(false)} className="btn-secondary">
                                Cancel
                            </button>
                            <button onClick={handleImport} className="btn-primary flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
