import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Area, AreaChart } from "recharts"

export function AQIChart({ data, title = "Air Quality Trends" }) {
    // Custom tooltip
    const CustomTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            return (
                <div className="glass-card p-3 border-none shadow-xl">
                    <p className="text-sm font-medium text-foreground mb-2">{payload[0].payload.time}</p>
                    {payload.map((item, index) => (
                        <div key={index} className="flex flex-col mb-1 last:mb-0">
                            <span className="text-[10px] text-muted-foreground uppercase">{item.name}</span>
                            <span className="text-lg font-bold" style={{ color: item.color || item.stroke }}>
                                {item.value}{item.name === 'Temp' ? '°C' : item.name === 'Humidity' ? '%' : ''}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
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
                    name="AQI"
                    type="monotone"
                    dataKey="aqi"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fill="url(#colorAqi)"
                    activeDot={{ r: 6, fill: "#8b5cf6", stroke: "#fff", strokeWidth: 2 }}
                />
                <Area
                    name="Temp"
                    type="monotone"
                    dataKey="temp"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#colorTemp)"
                />
                <Area
                    name="Humidity"
                    type="monotone"
                    dataKey="humidity"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="url(#colorHum)"
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}
