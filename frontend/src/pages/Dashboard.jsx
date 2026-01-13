import { useState, useEffect } from 'react';
import { useAQI, useAQIHistory } from '../hooks/useAQI';
import { useLocations } from '../hooks/useLocations';
import { useNotifications } from '../hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { AQIChart } from '../components/features/AQIChart';
import { Loader2, Wind, Droplets, Thermometer, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function Dashboard() {
    const { data: locations, isLoading: locationsLoading } = useLocations();
    // 'local' will represent the browser's geolocation
    const [selectedLocationId, setSelectedLocationId] = useState('local');
    const [userCoords, setUserCoords] = useState(null);

    // Try to get user's current location
    useEffect(() => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setUserCoords(`geo:${latitude};${longitude}`);
                },
                (error) => {
                    console.warn("Geolocation error:", error.message);
                }
            );
        }
    }, []);

    // Set default location to first saved one ONLY if geolocation fails or isn't available
    useEffect(() => {
        if (!userCoords && locations?.length > 0 && selectedLocationId === 'local') {
            setSelectedLocationId(String(locations[0].id || locations[0]._id));
        }
    }, [locations, userCoords]);

    const activeLocation = locations?.find(l => String(l.id || l._id) === String(selectedLocationId));

    // Identifier for useAQI: specific geo coords, search query, or location name/city
    const aqiQueryId = selectedLocationId === 'local'
        ? userCoords
        : selectedLocationId.startsWith('query:')
            ? selectedLocationId.split('query:')[1]
            : (activeLocation?.city || activeLocation?.name);

    const { data: aqiData, isLoading: aqiLoading } = useAQI(aqiQueryId);
    const { data: aqiHistory } = useAQIHistory(aqiQueryId);
    const { data: notifications } = useNotifications();

    // Notify user of new critical alerts via Toast
    useEffect(() => {
        if (notifications?.length > 0) {
            const latest = notifications[0];
            const isNew = new Date(latest.created_at) > new Date(Date.now() - 30000);
            if (isNew && latest.type === 'alerts') {
                toast.error(latest.content, { duration: 5000 });
            }
        }
    }, [notifications]);


    if ((locationsLoading || aqiLoading) && !aqiData) {
        return (
            <div className="flex h-[50vh] flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary" />
                <p className="text-muted-foreground animate-pulse">Loading environmental data...</p>
            </div>
        );
    }

    const currentAQI = aqiData?.aqi;
    const currentTemp = aqiData?.temperature;
    const currentHumidity = aqiData?.humidity;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                    <div className="flex items-center text-muted-foreground">
                        <MapPin className="mr-1 h-4 w-4" />
                        {selectedLocationId === 'local' ? 'Current Geolocation' : (activeLocation?.name || activeLocation?.city || 'Selected Place')}
                        {aqiData?.location && <span className="ml-2 text-xs opacity-50">({aqiData.location})</span>}
                    </div>
                </div>

                <div className="w-full md:w-80">
                    <div className="relative">
                        <select
                            className="w-full appearance-none bg-card/50 backdrop-blur-sm border border-white/10 text-foreground rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            value={selectedLocationId}
                            onChange={(e) => setSelectedLocationId(e.target.value)}
                        >
                            <option value="local">📍 My Current Location (Auto)</option>
                            {locations?.length > 0 && <optgroup label="Saved Locations">
                                {locations.map((loc) => (
                                    <option key={loc.id || loc._id} value={String(loc.id || loc._id)}>
                                        {loc.name || loc.city}
                                    </option>
                                ))}
                            </optgroup>}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                            <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="flex justify-end gap-2 px-1">
                <div className="relative w-full max-w-sm flex gap-2">
                    <div className="relative w-full">
                        <input
                            type="text"
                            placeholder="Search city..."
                            className="w-full bg-card/50 backdrop-blur-sm border border-white/10 text-foreground rounded-xl px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                            id="search-input"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const val = e.currentTarget.value.trim();
                                    if (val) {
                                        setSelectedLocationId(`query:${val}`);
                                        toast.info(`Searching for ${val}...`);
                                    }
                                }
                            }}
                        />
                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                            <MapPin className="h-4 w-4" />
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            const input = document.getElementById('search-input');
                            const val = input.value.trim();
                            if (val) {
                                setSelectedLocationId(`query:${val}`);
                                toast.info(`Searching for ${val}...`);
                            }
                        }}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-medium shadow-lg shadow-primary/20"
                    >
                        Search
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 grid-cols-3">
                <Card className="glass-card hover:shadow-2xl transition-all duration-300 border-t-4 border-t-emerald-500 card-gradient-4 overflow-hidden relative h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                    <CardHeader className="flex flex-col items-center justify-center space-y-2 pb-2 relative z-10">
                        <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/30 animate-float">
                            <Wind className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-sm font-medium text-muted-foreground text-center">
                            Air Quality Index
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 flex flex-col items-center justify-center">
                        <div className="flex items-baseline gap-2 justify-center">
                            <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                                {currentAQI ?? '--'}
                            </div>
                            {aqiData?.ai_powered && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold uppercase tracking-wider animate-pulse border border-primary/30">
                                    AI
                                </span>
                            )}
                        </div>
                        <p className={cn("text-xs font-medium mt-1 text-center", (!currentAQI || currentAQI < 50) ? "text-emerald-600" : currentAQI < 100 ? "text-yellow-600" : "text-destructive")}>
                            {!currentAQI ? 'Waiting for data...' : currentAQI < 50 ? '✓ Good' : currentAQI < 100 ? '⚠ Moderate' : '⚠ Unhealthy'} Condition
                        </p>
                    </CardContent>
                </Card>

                <Card className="glass-card hover:shadow-2xl transition-all duration-300 border-t-4 border-t-orange-500 card-gradient-3 overflow-hidden relative h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>
                    <CardHeader className="flex flex-col items-center justify-center space-y-2 pb-2 relative z-10">
                        <div className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl shadow-lg shadow-orange-500/30 animate-float" style={{ animationDelay: '0.2s' }}>
                            <Thermometer className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-sm font-medium text-muted-foreground text-center">
                            Temperature
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 flex flex-col items-center justify-center">
                        <div className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent text-center">
                            {currentTemp !== undefined ? `${currentTemp}°C` : '--'}
                        </div>
                        <p className="text-xs font-medium mt-1 text-orange-600 text-center">Ambient temperature</p>
                    </CardContent>
                </Card>

                <Card className="glass-card hover:shadow-2xl transition-all duration-300 border-t-4 border-t-blue-500 card-gradient-2 overflow-hidden relative h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                    <CardHeader className="flex flex-col items-center justify-center space-y-2 pb-2 relative z-10">
                        <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/30 animate-float" style={{ animationDelay: '0.4s' }}>
                            <Droplets className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-sm font-medium text-muted-foreground text-center">
                            Humidity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10 flex flex-col items-center justify-center">
                        <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent text-center">
                            {currentHumidity !== undefined ? `${currentHumidity}%` : '--'}
                        </div>
                        <p className="text-xs font-medium mt-1 text-blue-600 text-center">Relative humidity</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-1 md:col-span-4 glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-6">Historical Trends</h3>
                    <div className="h-[300px] w-full">
                        <AQIChart data={aqiHistory && aqiHistory.length > 0 ? aqiHistory.map(h => ({
                            time: new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            aqi: h.aqi,
                            temp: h.temperature,
                            humidity: h.humidity
                        })) : (aqiData ? [{
                            time: new Date(aqiData.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                            aqi: aqiData.aqi,
                            temp: aqiData.temperature,
                            humidity: aqiData.humidity
                        }] : [])} />
                    </div>
                </div>
                <Card className="col-span-1 md:col-span-3 glass-card">
                    <CardHeader>
                        <CardTitle>Security & Health Alerts</CardTitle>
                        <CardDescription>
                            Real-time monitoring for your locations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {notifications?.length > 0 ? (
                                notifications.slice(0, 5).map((notif) => (
                                    <div key={notif.id || notif._id} className="p-3 rounded-lg bg-muted/30 border border-muted-foreground/10 hover:bg-muted/50 transition-colors animate-in slide-in-from-right-5">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn(
                                                "text-[10px] uppercase font-bold tracking-widest",
                                                notif.type === 'alerts' ? "text-destructive" : "text-primary"
                                            )}>{notif.type}</span>
                                            <span className="text-[10px] text-muted-foreground">{new Date(notif.timestamp || notif.created_at).toLocaleTimeString()}</span>
                                        </div>
                                        <p className="text-sm line-clamp-2">{notif.content}</p>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-center py-10 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
                                    No critical alerts in your area.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
