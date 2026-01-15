import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, RotateCcw, AlertCircle, Info } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/services/api'

interface Variable {
    id: string
    name: string
    description?: string
    envVariable: string
    value: string
    defaultValue?: string
    userViewable: boolean
    userEditable: boolean
    rules?: string
    fieldType: string
}

interface StartupEditorProps {
    serverId: string
    startup: string
    variables: Variable[]
    isOwner: boolean
}

export function StartupEditor({ serverId, startup, variables, isOwner }: StartupEditorProps) {
    const queryClient = useQueryClient()
    const [editedVariables, setEditedVariables] = useState<Record<string, string>>({})
    const [hasChanges, setHasChanges] = useState(false)
    const [errors, setErrors] = useState<Record<string, string>>({})

    // Initialize edited variables
    useEffect(() => {
        const initial: Record<string, string> = {}
        variables.forEach(v => {
            initial[v.envVariable] = v.value
        })
        setEditedVariables(initial)
    }, [variables])

    // Build preview startup command
    const previewStartup = () => {
        let preview = startup
        for (const [key, value] of Object.entries(editedVariables)) {
            preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value || `{{${key}}}`)
        }
        // Replace system variables with placeholders
        preview = preview.replace(/{{SERVER_MEMORY}}/g, '[MEMORY]')
        preview = preview.replace(/{{SERVER_IP}}/g, '[IP]')
        preview = preview.replace(/{{SERVER_PORT}}/g, '[PORT]')
        return preview
    }

    const handleVariableChange = (envVar: string, value: string) => {
        setEditedVariables(prev => ({ ...prev, [envVar]: value }))
        setHasChanges(true)

        // Validate if rules exist
        const variable = variables.find(v => v.envVariable === envVar)
        if (variable?.rules) {
            const error = validateValue(value, variable.rules)
            setErrors(prev => ({ ...prev, [envVar]: error }))
        }
    }

    const validateValue = (value: string, rules: string): string => {
        const ruleList = rules.split('|')

        for (const rule of ruleList) {
            if (rule === 'required' && !value.trim()) {
                return 'This field is required'
            }
            if (rule.startsWith('max:')) {
                const max = parseInt(rule.split(':')[1])
                if (value.length > max) {
                    return `Maximum ${max} characters`
                }
            }
            if (rule.startsWith('min:')) {
                const min = parseInt(rule.split(':')[1])
                if (value.length < min) {
                    return `Minimum ${min} characters`
                }
            }
            if (rule === 'numeric' && !/^\d+$/.test(value)) {
                return 'Must be a number'
            }
        }

        return ''
    }

    const saveMutation = useMutation({
        mutationFn: (data: { variables: Array<{ envVariable: string; value: string }> }) =>
            api.put(`/servers/${serverId}/variables`, data),
        onSuccess: () => {
            toast.success('Variables saved successfully')
            queryClient.invalidateQueries({ queryKey: ['server', serverId] })
            setHasChanges(false)
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to save variables')
        },
    })

    const handleSave = () => {
        // Check for validation errors
        const hasErrors = Object.values(errors).some(e => e)
        if (hasErrors) {
            toast.error('Please fix validation errors before saving')
            return
        }

        const data = Object.entries(editedVariables).map(([envVariable, value]) => ({
            envVariable,
            value,
        }))

        saveMutation.mutate({ variables: data })
    }

    const handleReset = () => {
        const initial: Record<string, string> = {}
        variables.forEach(v => {
            initial[v.envVariable] = v.value
        })
        setEditedVariables(initial)
        setHasChanges(false)
        setErrors({})
    }

    const editableVariables = variables.filter(v => v.userViewable)

    return (
        <div className="space-y-6">
            {/* Startup Command Preview */}
            <div className="bg-black border border-dark-700 rounded-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-accent" />
                    <span className="text-xs text-dark-400 uppercase tracking-wider">Startup Command Preview</span>
                </div>
                <code className="text-sm font-mono text-emerald-400 break-all block">
                    {previewStartup()}
                </code>
            </div>

            {/* Variables Editor */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-white">Startup Variables</h3>
                    {hasChanges && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-dark-400 hover:text-white transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" />
                                Reset
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saveMutation.isPending || Object.values(errors).some(e => e)}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-sm hover:bg-accent/90 transition-colors disabled:opacity-50"
                            >
                                {saveMutation.isPending ? (
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <Save className="w-3 h-3" />
                                )}
                                Save Changes
                            </button>
                        </div>
                    )}
                </div>

                <div className="grid gap-4">
                    {editableVariables.map((variable) => (
                        <div
                            key={variable.id}
                            className={`bg-dark-900 border rounded-sm p-4 ${errors[variable.envVariable] ? 'border-red-500/50' : 'border-dark-700'
                                }`}
                        >
                            <div className="flex flex-col md:flex-row md:items-start gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <label className="text-sm font-medium text-white">
                                            {variable.name}
                                        </label>
                                        <code className="text-xs text-dark-500 bg-dark-800 px-1.5 py-0.5 rounded">
                                            {variable.envVariable}
                                        </code>
                                    </div>
                                    {variable.description && (
                                        <p className="text-xs text-dark-400 mb-2">{variable.description}</p>
                                    )}

                                    {variable.userEditable && isOwner ? (
                                        <>
                                            {variable.fieldType === 'select' ? (
                                                <select
                                                    value={editedVariables[variable.envVariable] || ''}
                                                    onChange={(e) => handleVariableChange(variable.envVariable, e.target.value)}
                                                    className="w-full bg-dark-800 border border-dark-600 rounded-sm px-3 py-2 text-sm text-white focus:border-accent focus:outline-none transition-colors"
                                                >
                                                    <option value="">Select...</option>
                                                    {/* Options would come from rules in practice */}
                                                </select>
                                            ) : (
                                                <input
                                                    type={variable.fieldType === 'number' ? 'number' : 'text'}
                                                    value={editedVariables[variable.envVariable] || ''}
                                                    onChange={(e) => handleVariableChange(variable.envVariable, e.target.value)}
                                                    placeholder={variable.defaultValue || ''}
                                                    className="w-full bg-dark-800 border border-dark-600 rounded-sm px-3 py-2 text-sm text-white font-mono focus:border-accent focus:outline-none transition-colors"
                                                />
                                            )}

                                            {errors[variable.envVariable] && (
                                                <p className="flex items-center gap-1 text-xs text-red-400 mt-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {errors[variable.envVariable]}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <code className="bg-dark-800 px-3 py-2 rounded-sm text-sm text-dark-300 font-mono">
                                                {editedVariables[variable.envVariable] || variable.defaultValue || '-'}
                                            </code>
                                            {!variable.userEditable && (
                                                <span className="text-xs text-dark-500">(read-only)</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Default value indicator */}
                                {variable.defaultValue && editedVariables[variable.envVariable] !== variable.defaultValue && (
                                    <button
                                        onClick={() => handleVariableChange(variable.envVariable, variable.defaultValue!)}
                                        className="text-xs text-dark-500 hover:text-accent transition-colors whitespace-nowrap"
                                        title="Reset to default"
                                    >
                                        Default: {variable.defaultValue}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {editableVariables.length === 0 && (
                    <div className="text-center py-8 text-dark-500">
                        No editable variables for this server.
                    </div>
                )}
            </div>
        </div>
    )
}
