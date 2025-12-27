/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                    950: '#082f49',
                },
                dark: {
                    50: '#f9fafb',
                    100: '#f3f4f6',
                    200: '#e5e7eb',
                    300: '#d1d5db',
                    400: '#9ca3af',
                    500: '#6b7280',
                    600: '#4b5563',
                    700: '#262626', // Border subtle
                    800: '#111111', // Card hover / Surface
                    900: '#0A0A0A', // Card bg
                    950: '#000000', // App background
                },
                accent: {
                    DEFAULT: '#3B82F6', // Electric Blue
                    hover: '#2563EB',
                }
            },
            boxShadow: {
                'glow-sm': '0 0 10px rgba(59, 130, 246, 0.1)',
                'glow-md': '0 0 15px rgba(59, 130, 246, 0.3)',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                mono: ['JetBrains Mono', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
            },
            keyframes: {
                glow: {
                    '0%': { boxShadow: '0 0 5px rgba(99, 102, 241, 0.5), 0 0 20px rgba(99, 102, 241, 0.3)' },
                    '100%': { boxShadow: '0 0 10px rgba(99, 102, 241, 0.8), 0 0 30px rgba(99, 102, 241, 0.5)' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
}
