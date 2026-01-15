import { useState, useEffect, useRef, useCallback } from 'react'
import {
    Folder,
    File,
    FileText,
    Image as ImageIcon,
    Archive,
    ArrowLeft,
    Plus,
    Upload,
    Trash2,
    Edit,
    Copy,
    Move,
    FolderPlus,
    RefreshCw,
    MoreVertical,
    X,
    Save,
    AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { socketService } from '../services/socket'
import { useAuthStore } from '../stores/auth'

interface FileInfo {
    name: string
    path?: string
    isDirectory: boolean
    size: number
    modifiedAt: Date
}

interface FileManagerProps {
    serverId: string
}

// File icon helper
function getFileIcon(file: FileInfo) {
    if (file.isDirectory) return <Folder className="w-4 h-4 text-blue-400 fill-blue-400/20" />
    const ext = file.name.split('.').pop()?.toLowerCase()
    switch (ext) {
        case 'txt':
        case 'log':
        case 'json':
        case 'yml':
        case 'yaml':
        case 'properties':
        case 'cfg':
        case 'conf':
            return <FileText className="w-4 h-4 text-dark-300" />
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
            return <ImageIcon className="w-4 h-4 text-purple-400" />
        case 'zip':
        case 'tar':
        case 'gz':
        case 'rar':
        case '7z':
            return <Archive className="w-4 h-4 text-amber-400" />
        default:
            return <File className="w-4 h-4 text-dark-400" />
    }
}

// Format file size
function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export default function FileManager({ serverId }: FileManagerProps) {
    const [currentPath, setCurrentPath] = useState('/')
    const [files, setFiles] = useState<FileInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selected, setSelected] = useState<string[]>([])
    const [editingFile, setEditingFile] = useState<string | null>(null)
    const [fileContent, setFileContent] = useState('')
    const [savingFile, setSavingFile] = useState(false)
    const [showNewFolder, setShowNewFolder] = useState(false)
    const [newFolderName, setNewFolderName] = useState('')
    const [showNewFile, setShowNewFile] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileInfo } | null>(null)
    const [renamingFile, setRenamingFile] = useState<string | null>(null)
    const [newName, setNewName] = useState('')
    const [clipboard, setClipboard] = useState<{ files: string[]; action: 'copy' | 'cut' } | null>(null)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0, fileName: '' })
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Load files from daemon via WebSocket
    const loadFiles = useCallback(async () => {
        if (!serverId) {
            setError('No server ID provided')
            setLoading(false)
            return
        }

        setLoading(true)
        setError(null)
        setSelected([])

        try {
            const fileList = await socketService.listFiles(serverId, currentPath)
            setFiles(fileList.map((f: any) => ({
                ...f,
                modifiedAt: new Date(f.modifiedAt || f.modified || Date.now())
            })))
        } catch (err: any) {
            setError(err.message || 'Failed to load files')
            toast.error(err.message || 'Failed to load files')
        } finally {
            setLoading(false)
        }
    }, [serverId, currentPath])

    useEffect(() => {
        if (serverId) {
            loadFiles()
        }
    }, [loadFiles, serverId])

    // Close context menu on click outside
    useEffect(() => {
        const handleClick = () => setContextMenu(null)
        document.addEventListener('click', handleClick)
        return () => document.removeEventListener('click', handleClick)
    }, [])

    const navigateTo = (folder: string) => {
        if (folder === '..') {
            const parts = currentPath.split('/').filter(Boolean)
            parts.pop()
            setCurrentPath('/' + parts.join('/'))
        } else {
            setCurrentPath(currentPath === '/' ? `/${folder}` : `${currentPath}/${folder}`)
        }
    }

    const toggleSelect = (name: string) => {
        setSelected(prev =>
            prev.includes(name)
                ? prev.filter(n => n !== name)
                : [...prev, name]
        )
    }

    const getFullPath = (filename: string) => {
        return currentPath === '/' ? `/${filename}` : `${currentPath}/${filename}`
    }

    const openFile = async (file: FileInfo) => {
        if (file.isDirectory) {
            navigateTo(file.name)
        } else {
            const ext = file.name.split('.').pop()?.toLowerCase()
            const editableExts = ['txt', 'log', 'json', 'yml', 'yaml', 'properties', 'cfg', 'conf', 'sh', 'bat', 'xml', 'html', 'css', 'js', 'toml']

            if (editableExts.includes(ext || '')) {
                setEditingFile(file.name)
                setFileContent('Loading...')
                try {
                    const content = await socketService.readFile(serverId, getFullPath(file.name))
                    setFileContent(content)
                } catch (err: any) {
                    toast.error(err.message || 'Failed to read file')
                    setEditingFile(null)
                }
            } else {
                toast.info('This file type cannot be edited in the browser')
            }
        }
    }

    const saveFile = async () => {
        if (!editingFile) return
        setSavingFile(true)
        try {
            await socketService.writeFile(serverId, getFullPath(editingFile), fileContent)
            toast.success('File saved successfully')
            setEditingFile(null)
        } catch (err: any) {
            toast.error(err.message || 'Failed to save file')
        } finally {
            setSavingFile(false)
        }
    }

    const createFolder = async () => {
        if (!newFolderName.trim()) return
        try {
            await socketService.createFolder(serverId, getFullPath(newFolderName.trim()))
            toast.success(`Created folder: ${newFolderName}`)
            setShowNewFolder(false)
            setNewFolderName('')
            loadFiles()
        } catch (err: any) {
            toast.error(err.message || 'Failed to create folder')
        }
    }

    const createFile = async () => {
        if (!newFileName.trim()) return
        try {
            await socketService.writeFile(serverId, getFullPath(newFileName.trim()), '')
            toast.success(`Created file: ${newFileName}`)
            setShowNewFile(false)
            setNewFileName('')
            loadFiles()
        } catch (err: any) {
            toast.error(err.message || 'Failed to create file')
        }
    }

    // Handle file upload via HTTP multipart (more reliable than WebSocket)
    const handleFileUpload = async (fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return

        setUploading(true)
        setUploadProgress({ current: 0, total: fileList.length, fileName: '' })
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        // Get auth token from zustand store
        const token = useAuthStore.getState().token

        for (let i = 0; i < fileList.length; i++) {
            const file = fileList[i]
            setUploadProgress({ current: i + 1, total: fileList.length, fileName: file.name })
            console.log(`[Upload] Starting HTTP upload of ${file.name} (${file.size} bytes)`)

            try {
                // Create FormData for multipart upload
                const formData = new FormData()
                formData.append('file', file)
                formData.append('path', currentPath)

                // Send HTTP POST request
                const response = await fetch(`/api/servers/${serverId}/files/upload`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    body: formData,
                })

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ message: 'Upload failed' }))
                    throw new Error(errorData.message || `HTTP ${response.status}`)
                }

                const result = await response.json()
                console.log(`[Upload] Success: ${file.name}`, result)
                successCount++
            } catch (err: any) {
                const errorMsg = err.message || 'Unknown error'
                console.error(`[Upload] Failed to upload ${file.name}:`, errorMsg)
                errors.push(`${file.name}: ${errorMsg}`)
                errorCount++
            }
        }

        setUploading(false)
        setUploadProgress({ current: 0, total: 0, fileName: '' })

        if (successCount > 0) {
            toast.success(`Uploaded ${successCount} file(s)`)
            loadFiles()
        }
        if (errorCount > 0) {
            toast.error(`Failed to upload ${errorCount} file(s): ${errors.slice(0, 2).join(', ')}${errors.length > 2 ? '...' : ''}`)
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const deleteSelected = async () => {
        if (selected.length === 0) return
        if (!confirm(`Delete ${selected.length} item(s)?`)) return

        try {
            const paths = selected.map(name => getFullPath(name))
            await socketService.deleteFile(serverId, paths)
            toast.success(`Deleted ${selected.length} item(s)`)
            setSelected([])
            loadFiles()
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete files')
        }
    }

    const handleContextMenu = (e: React.MouseEvent, file: FileInfo) => {
        e.preventDefault()
        e.stopPropagation()
        setContextMenu({ x: e.clientX, y: e.clientY, file })
    }

    const startRename = (file: FileInfo) => {
        setRenamingFile(file.name)
        setNewName(file.name)
        setContextMenu(null)
    }

    const confirmRename = async () => {
        if (!newName.trim() || newName === renamingFile) {
            setRenamingFile(null)
            return
        }
        try {
            await socketService.renameFile(
                serverId,
                getFullPath(renamingFile!),
                getFullPath(newName.trim())
            )
            toast.success(`Renamed to ${newName}`)
            setRenamingFile(null)
            setNewName('')
            loadFiles()
        } catch (err: any) {
            toast.error(err.message || 'Failed to rename')
        }
    }

    const copyFiles = (action: 'copy' | 'cut') => {
        const filesToCopy = contextMenu ? [contextMenu.file.name] : selected
        const paths = filesToCopy.map(name => getFullPath(name))
        setClipboard({ files: paths, action })
        toast.success(`${filesToCopy.length} file(s) ${action === 'copy' ? 'copied' : 'cut'}`)
        setContextMenu(null)
    }

    const pasteFiles = async () => {
        if (!clipboard) return
        try {
            for (const sourcePath of clipboard.files) {
                const filename = sourcePath.split('/').pop() || 'file'
                const destPath = getFullPath(clipboard.action === 'copy' ? `Copy of ${filename}` : filename)
                // Use renameFile endpoint for move, for copy we'd need a dedicated endpoint
                if (clipboard.action === 'cut') {
                    await socketService.renameFile(serverId, sourcePath, destPath)
                } else {
                    // For copy, we'll just show an info message since copy isn't implemented
                    toast.info('Copy file feature coming soon')
                }
            }
            if (clipboard.action === 'cut') {
                toast.success(`Moved ${clipboard.files.length} file(s)`)
            }
            setClipboard(null)
            loadFiles()
        } catch (err: any) {
            toast.error(err.message || 'Failed to paste files')
        }
    }

    const deleteFile = async (file: FileInfo) => {
        if (!confirm(`Delete "${file.name}"?`)) return
        try {
            await socketService.deleteFile(serverId, getFullPath(file.name))
            toast.success(`Deleted ${file.name}`)
            setContextMenu(null)
            loadFiles()
        } catch (err: any) {
            toast.error(err.message || 'Failed to delete file')
        }
    }

    const breadcrumbs = ['/', ...currentPath.split('/').filter(Boolean)]

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-2 items-center justify-between bg-dark-900 border border-dark-700 p-2 rounded-lg">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigateTo('..')}
                        disabled={currentPath === '/'}
                        className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button onClick={loadFiles} className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors" title="Refresh">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="h-4 w-px bg-dark-700 mx-1" />
                    <div className="text-sm text-dark-400 flex items-center gap-1 px-2">
                        {breadcrumbs.map((part, i) => (
                            <span key={i} className="flex items-center">
                                <button
                                    onClick={() => {
                                        const newPath = breadcrumbs.slice(0, i + 1).join('/').replace('//', '/')
                                        setCurrentPath(newPath || '/')
                                    }}
                                    className="hover:text-white transition-colors hover:underline underline-offset-4"
                                >
                                    {part === '/' ? 'root' : part}
                                </button>
                                {i < breadcrumbs.length - 1 && <span className="mx-1 text-dark-600">/</span>}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowNewFolder(true)}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">New Folder</span>
                    </button>
                    <button
                        onClick={() => setShowNewFile(true)}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">New File</span>
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                        <Upload className={`w-3.5 h-3.5 ${uploading ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">{uploading ? 'Uploading...' : 'Upload'}</span>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                    />
                    {clipboard && (
                        <button
                            onClick={pasteFiles}
                            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                        >
                            <Copy className="w-3.5 h-3.5" />
                            Paste ({clipboard.files.length})
                        </button>
                    )}
                    {selected.length > 0 && (
                        <>
                            <div className="h-4 w-px bg-dark-700 mx-1" />
                            <button
                                onClick={() => copyFiles('copy')}
                                className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                                title="Copy"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                            <button
                                onClick={deleteSelected}
                                className="p-2 hover:bg-red-500/10 rounded text-dark-400 hover:text-red-400 transition-colors"
                                title="Delete"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Upload Progress */}
            {uploading && (
                <div className="bg-dark-900 border border-dark-700 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-dark-400">
                            Uploading: <span className="text-white font-medium">{uploadProgress.fileName}</span>
                        </span>
                        <span className="text-dark-400 font-mono">
                            {uploadProgress.current} / {uploadProgress.total}
                        </span>
                    </div>
                    <div className="h-1 bg-dark-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Error state */}
            {error && (
                <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <div className="flex-1">
                        <p className="text-red-400 text-sm font-medium">Failed to load files</p>
                        <p className="text-xs text-red-400/70">{error}</p>
                    </div>
                    <button onClick={loadFiles} className="text-xs text-red-400 hover:text-red-300 underline">Retry</button>
                </div>
            )}

            {/* File list */}
            <div className="bg-dark-900 border border-dark-700 rounded-lg overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-dark-500">
                        <RefreshCw className="w-6 h-6 mx-auto mb-3 animate-spin" />
                        <p className="text-sm">Loading files...</p>
                    </div>
                ) : !error && files.length === 0 ? (
                    <div className="p-12 text-center text-dark-500">
                        <Folder className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">This folder is empty</p>
                    </div>
                ) : !error && (
                    <table className="w-full text-left text-sm">
                        <thead className="bg-dark-800/50 border-b border-dark-700 font-medium text-dark-400">
                            <tr>
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setSelected(files.map(f => f.name))
                                            } else {
                                                setSelected([])
                                            }
                                        }}
                                        checked={selected.length === files.length && files.length > 0}
                                        className="rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-0 focus:ring-offset-0"
                                    />
                                </th>
                                <th className="p-3 font-normal">Name</th>
                                <th className="p-3 font-normal w-32">Size</th>
                                <th className="p-3 font-normal w-48 hidden md:table-cell">Modified</th>
                                <th className="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-800">
                            {files.map((file) => {
                                const isRenaming = renamingFile === file.name
                                const isSelected = selected.includes(file.name)
                                return (
                                    <tr
                                        key={file.name}
                                        className={`
                                            group transition-colors cursor-pointer
                                            ${isSelected ? 'bg-primary-500/5' : 'hover:bg-dark-800/50'}
                                        `}
                                        onClick={() => toggleSelect(file.name)}
                                        onDoubleClick={() => openFile(file)}
                                        onContextMenu={(e) => handleContextMenu(e, file)}
                                    >
                                        <td className="p-3 text-center" onClick={e => e.stopPropagation()}>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggleSelect(file.name)}
                                                className="rounded border-dark-600 bg-dark-800 text-primary-500 focus:ring-0 focus:ring-offset-0 opacity-0 group-hover:opacity-100 checked:opacity-100 transition-opacity"
                                            />
                                        </td>
                                        <td className="p-3">
                                            <div className="flex items-center gap-3">
                                                {getFileIcon(file)}
                                                {isRenaming ? (
                                                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                        <input
                                                            type="text"
                                                            value={newName}
                                                            onChange={(e) => setNewName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') confirmRename()
                                                                if (e.key === 'Escape') setRenamingFile(null)
                                                            }}
                                                            className="bg-dark-950 border border-primary-500 rounded px-2 py-0.5 text-sm text-white focus:outline-none w-full"
                                                            autoFocus
                                                        />
                                                    </div>
                                                ) : (
                                                    <span className="text-dark-200 group-hover:text-white transition-colors">{file.name}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-dark-500 font-mono text-xs">
                                            {file.isDirectory ? '—' : formatSize(file.size)}
                                        </td>
                                        <td className="p-3 text-dark-500 text-xs hidden md:table-cell">
                                            {new Date(file.modifiedAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleContextMenu(e, file) }}
                                                className="text-dark-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-dark-800 border border-dark-700 rounded-lg shadow-2xl py-1 min-w-48 animate-in fade-in zoom-in-95 duration-100"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        onClick={() => { openFile(contextMenu.file); setContextMenu(null) }}
                        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:text-white hover:bg-dark-700 flex items-center gap-2 transition-colors"
                    >
                        {contextMenu.file.isDirectory ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        {contextMenu.file.isDirectory ? 'Open' : 'Edit'}
                    </button>
                    <button
                        onClick={() => startRename(contextMenu.file)}
                        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:text-white hover:bg-dark-700 flex items-center gap-2 transition-colors"
                    >
                        <Edit className="w-4 h-4" />
                        Rename
                    </button>
                    <div className="h-px bg-dark-700 my-1" />
                    <button
                        onClick={() => copyFiles('copy')}
                        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:text-white hover:bg-dark-700 flex items-center gap-2 transition-colors"
                    >
                        <Copy className="w-4 h-4" />
                        Copy
                    </button>
                    <button
                        onClick={() => copyFiles('cut')}
                        className="w-full px-4 py-2 text-left text-sm text-dark-200 hover:text-white hover:bg-dark-700 flex items-center gap-2 transition-colors"
                    >
                        <Move className="w-4 h-4" />
                        Cut
                    </button>
                    <div className="h-px bg-dark-700 my-1" />
                    <button
                        onClick={() => deleteFile(contextMenu.file)}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                </div>
            )}

            {/* File Editor Modal */}
            {editingFile && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-900 border border-dark-700 rounded-lg max-w-5xl w-full h-[80vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-dark-700">
                            <div className="flex items-center gap-3">
                                <FileText className="w-5 h-5 text-dark-400" />
                                <span className="font-mono text-sm text-white">{editingFile}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={saveFile}
                                    disabled={savingFile}
                                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                                >
                                    <Save className="w-3.5 h-3.5" />
                                    {savingFile ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button
                                    onClick={() => setEditingFile(null)}
                                    className="p-1.5 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <textarea
                            value={fileContent}
                            onChange={(e) => setFileContent(e.target.value)}
                            className="flex-1 bg-[#0c0c0c] p-4 font-mono text-sm text-dark-200 resize-none focus:outline-none leading-relaxed"
                            spellCheck={false}
                        />
                    </div>
                </div>
            )}

            {/* New Folder Modal */}
            {showNewFolder && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-900 border border-dark-700 rounded-lg max-w-sm w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-medium text-white mb-4">New Folder</h3>
                        <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') createFolder() }}
                            placeholder="Folder name"
                            className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 mb-4"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowNewFolder(false)} className="btn-secondary text-xs">Cancel</button>
                            <button onClick={createFolder} className="btn-primary text-xs">Create Folder</button>
                        </div>
                    </div>
                </div>
            )}

            {/* New File Modal */}
            {showNewFile && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-dark-900 border border-dark-700 rounded-lg max-w-sm w-full p-6 shadow-2xl">
                        <h3 className="text-lg font-medium text-white mb-4">New File</h3>
                        <input
                            type="text"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') createFile() }}
                            placeholder="filename.txt"
                            className="w-full bg-dark-950 border border-dark-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500 mb-4"
                            autoFocus
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setShowNewFile(false)} className="btn-secondary text-xs">Cancel</button>
                            <button onClick={createFile} className="btn-primary text-xs">Create File</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
