import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from './App'
import { ThemeProvider } from './components/ThemeProvider'
import { KeyboardShortcuts } from './components/KeyboardShortcuts'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 1000 * 60, // 1 minute
            retry: 1,
        },
    },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <ThemeProvider defaultTheme="dark">
                    <div className="fixed inset-0 min-h-screen mesh-bg -z-50" />
                    <KeyboardShortcuts>
                        <App />
                    </KeyboardShortcuts>
                </ThemeProvider>
                <Toaster
                    theme="dark"
                    position="bottom-right"
                    toastOptions={{
                        style: {
                            background: 'rgba(15, 23, 42, 0.9)',
                            border: '1px solid rgba(99, 102, 241, 0.2)',
                            color: '#fff',
                        },
                    }}
                />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
)

