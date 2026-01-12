import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, AreaChart } from "recharts"

export function AQIChart({ data, title = "Air Quality Trends" }) {
    // Mock data if none provided for visualization
    const chartData = data || [
        { time: "00:00", aqi: 45 },
        { time: "04:00", aqi: 55 },
        { time: "08:00", aqi: 120 },
        { time: "12:00", aqi: 150 },
        { time: "16:00", aqi: 140 },
        { time: "20:00", aqi: 80 },
        { time: "23:59", aqi: 60 },
    ]

    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const aqi = payload[0].value;
            let status = "Good";
            let color = "#10b981"; // emerald

            if (aqi > 150) {
                status = "Unhealthy";
                color = "#ef4444"; // red
            } else if (aqi > 100) {
                status = "Moderate";
                color = "#f59e0b"; // orange
            }

            return (
                <div className="glass-card p-3 border-none shadow-xl">
                    <p className="text-sm font-medium text-foreground">{payload[0].payload.time}</p>
                    <p className="text-2xl font-bold mt-1" style={{ color }}>
                        {aqi}
                    </p>
                    <p className="text-xs text-muted-foreground">{status}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
                <defs>
                    <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis
                    dataKey="time"
                    stroke="currentColor"
                    className="text-muted-foreground"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="currentColor"
                    className="text-muted-foreground"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                    type="monotone"
                    dataKey="aqi"
                    stroke="url(#gradient)"
                    strokeWidth={3}
                    fill="url(#colorAqi)"
                    activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
                />
                <Line
                    type="monotone"
                    dataKey="aqi"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: "#8b5cf6", r: 4 }}
                    activeDot={{ r: 6 }}
                />
                <defs>
                    <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="50%" stopColor="#a78bfa" />
                        <stop offset="100%" stopColor="#c4b5fd" />
                    </linearGradient>
                </defs>
            </AreaChart>
        </ResponsiveContainer>
    )
}
