import { useState, useEffect } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
} from 'recharts'

interface DataPoint {
    time: string
    value: number
    timestamp: number
}

interface ResourceGraphProps {
    title: string
    unit: string
    color?: string
    maxValue?: number
    data?: DataPoint[]
    realTimeValue?: number
    className?: string
}

export function ResourceGraph({
    title,
    unit,
    color = '#10b981',
    maxValue = 100,
    data: externalData,
    realTimeValue,
    className = ''
}: ResourceGraphProps) {
    const [data, setData] = useState<DataPoint[]>(externalData || [])

    useEffect(() => {
        if (realTimeValue !== undefined) {
            const now = new Date()
            const newPoint: DataPoint = {
                time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                value: realTimeValue,
                timestamp: now.getTime()
            }

            setData(prev => {
                const updated = [...prev, newPoint]
                // Keep only last 60 data points (5 minutes at 5-second intervals)
                return updated.slice(-60)
            })
        }
    }, [realTimeValue])

    useEffect(() => {
        if (externalData) {
            setData(externalData)
        }
    }, [externalData])

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-dark-900 border border-dark-700 rounded-sm px-3 py-2 shadow-lg">
                    <p className="text-xs text-dark-400">{payload[0].payload.time}</p>
                    <p className="text-sm font-mono text-white">
                        {payload[0].value.toFixed(1)} {unit}
                    </p>
                </div>
            )
        }
        return null
    }

    const currentValue = data.length > 0 ? data[data.length - 1].value : 0
    const avgValue = data.length > 0
        ? data.reduce((sum, p) => sum + p.value, 0) / data.length
        : 0
    const maxRecorded = data.length > 0
        ? Math.max(...data.map(p => p.value))
        : 0

    return (
        <div className={`bg-dark-900 border border-dark-700 rounded-sm p-4 ${className}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-medium text-dark-400 uppercase tracking-wider">{title}</h3>
                <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="text-dark-500">
                        avg: <span className="text-dark-300">{avgValue.toFixed(1)}{unit}</span>
                    </span>
                    <span className="text-dark-500">
                        max: <span className="text-dark-300">{maxRecorded.toFixed(1)}{unit}</span>
                    </span>
                    <span className="text-white font-semibold">
                        {currentValue.toFixed(1)}{unit}
                    </span>
                </div>
            </div>

            <div className="h-32">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <defs>
                            <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                                <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="time"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#525252' }}
                            interval="preserveEnd"
                        />
                        <YAxis
                            domain={[0, maxValue]}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#525252' }}
                            tickFormatter={(v) => `${v}`}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="value"
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#gradient-${title})`}
                            animationDuration={300}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            {data.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-dark-500 text-xs font-mono">Waiting for data...</p>
                </div>
            )}
        </div>
    )
}

// Mini version for compact displays
export function MiniResourceGraph({
    value,
    color = '#10b981',
    label,
    unit,
}: {
    value: number
    color?: string
    label: string
    unit: string
}) {
    const [history, setHistory] = useState<number[]>([])

    useEffect(() => {
        setHistory(prev => [...prev.slice(-20), value])
    }, [value])

    const data = history.map((v, i) => ({ i, v }))

    return (
        <div className="flex items-center gap-3">
            <div className="w-20 h-8">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <Line
                            type="monotone"
                            dataKey="v"
                            stroke={color}
                            strokeWidth={1.5}
                            dot={false}
                            animationDuration={200}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="text-right">
                <p className="text-[10px] text-dark-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm font-mono text-white">{value.toFixed(0)}{unit}</p>
            </div>
        </div>
    )
}
