import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextType {
    theme: Theme
    resolvedTheme: 'dark' | 'light'
    setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

interface ThemeProviderProps {
    children: ReactNode
    defaultTheme?: Theme
    storageKey?: string
}

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    storageKey = 'hyprdash-theme'
}: ThemeProviderProps) {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem(storageKey)
            if (stored && ['dark', 'light', 'system'].includes(stored)) {
                return stored as Theme
            }
        }
        return defaultTheme
    })

    const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

    useEffect(() => {
        const root = window.document.documentElement

        const updateResolvedTheme = () => {
            if (theme === 'system') {
                const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
                    ? 'dark'
                    : 'light'
                setResolvedTheme(systemTheme)
                root.classList.remove('light', 'dark')
                root.classList.add(systemTheme)
            } else {
                setResolvedTheme(theme)
                root.classList.remove('light', 'dark')
                root.classList.add(theme)
            }
        }

        updateResolvedTheme()

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handleChange = () => {
            if (theme === 'system') {
                updateResolvedTheme()
            }
        }

        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
    }, [theme])

    const setTheme = (newTheme: Theme) => {
        localStorage.setItem(storageKey, newTheme)
        setThemeState(newTheme)
    }

    return (
        <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    )
}

// Theme Toggle Component
import { Moon, Sun, Monitor } from 'lucide-react'

interface ThemeToggleProps {
    className?: string
}

export function ThemeToggle({ className = '' }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme()

    const themes: { value: Theme; icon: typeof Sun; label: string }[] = [
        { value: 'light', icon: Sun, label: 'Light' },
        { value: 'dark', icon: Moon, label: 'Dark' },
        { value: 'system', icon: Monitor, label: 'System' },
    ]

    return (
        <div className={`flex items-center gap-1 bg-dark-800 p-1 rounded-sm ${className}`}>
            {themes.map(({ value, icon: Icon, label }) => (
                <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className={`p-1.5 rounded-sm transition-colors ${theme === value
                            ? 'bg-dark-700 text-white'
                            : 'text-dark-400 hover:text-white'
                        }`}
                    title={label}
                >
                    <Icon className="w-4 h-4" />
                </button>
            ))}
        </div>
    )
}
