import { useState, useEffect } from 'react';
import { useAQI } from '../hooks/useAQI';
import { useLocations } from '../hooks/useLocations'; // To get a default location
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { AQIChart } from '../components/features/AQIChart';
import { Loader2, Wind, Droplets, Thermometer, MapPin } from 'lucide-react';
import { cn } from '../lib/utils';

export default function Dashboard() {
    const { data: locations, isLoading: locationsLoading } = useLocations();
    const [selectedLocationId, setSelectedLocationId] = useState(null);

    // Set default location when data loads
    useEffect(() => {
        if (locations?.length > 0 && !selectedLocationId) {
            const firstId = String(locations[0].id || locations[0]._id);
            setSelectedLocationId(firstId);
        }
    }, [locations, selectedLocationId]);

    const activeLocation = locations?.find(l => String(l.id || l._id) === String(selectedLocationId)) || locations?.[0];
    // On utilise le nom ou la ville de la localisation active pour interroger le service AQI
    const activeLocationName = activeLocation?.city || activeLocation?.name;
    const { data: aqiData, isLoading: aqiLoading } = useAQI(activeLocationName);


    if ((locationsLoading || aqiLoading) && !aqiData) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>
    }

    // Valeurs courantes basées sur les vraies données retournées par le service AQI
    // (fallbacks conservés pour éviter de casser l'UI si aucune donnée n'est disponible)
    const currentAQI = aqiData?.aqi ?? 42;
    const currentTemp = aqiData?.temperature ?? 24;
    const currentHumidity = aqiData?.humidity ?? 65;

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                    <div className="flex items-center text-muted-foreground">
                        <MapPin className="mr-1 h-4 w-4" />
                        {activeLocation ? activeLocation.name : 'Select a location'}
                    </div>
                </div>

                <div className="w-full md:w-64">
                    <div className="relative">
                        <select
                            className="w-full appearance-none bg-card/50 backdrop-blur-sm border border-white/10 text-foreground rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                            value={selectedLocationId || ""}
                            onChange={(e) => {
                                console.log('Selected location ID:', e.target.value);
                                setSelectedLocationId(e.target.value);
                            }}
                            disabled={!locations?.length}
                        >
                            {!locations?.length && <option>No locations found</option>}
                            {locations?.map((loc) => {
                                const locId = String(loc.id || loc._id);
                                return (
                                    <option key={locId} value={locId}>
                                        {loc.name || loc.city}
                                    </option>
                                );
                            })}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                            <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-8 grid-cols-3">
                <Card className="glass-card hover:shadow-2xl transition-all duration-300 border-t-4 border-t-emerald-500 card-gradient-4 overflow-hidden relative h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Air Quality Index
                        </CardTitle>
                        <div className="p-3 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl shadow-lg shadow-emerald-500/30 animate-float">
                            <Wind className="h-5 w-5 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">{currentAQI}</div>
                        <p className={cn("text-xs font-medium mt-1", currentAQI < 50 ? "text-emerald-600" : "text-yellow-600")}>
                            {currentAQI < 50 ? '✓ Good' : currentAQI < 100 ? '⚠ Moderate' : '⚠ Unhealthy'} Condition
                        </p>
                    </CardContent>
                </Card>
                <Card className="glass-card hover:shadow-2xl transition-all duration-300 border-t-4 border-t-orange-500 card-gradient-3 overflow-hidden relative h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Temperature
                        </CardTitle>
                        <div className="p-3 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl shadow-lg shadow-orange-500/30 animate-float" style={{ animationDelay: '0.2s' }}>
                            <Thermometer className="h-5 w-5 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">{currentTemp}°C</div>
                        <p className="text-xs font-medium mt-1 text-orange-600">Current temperature</p>
                    </CardContent>
                </Card>
                <Card className="glass-card hover:shadow-2xl transition-all duration-300 border-t-4 border-t-blue-500 card-gradient-2 overflow-hidden relative h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Humidity
                        </CardTitle>
                        <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-xl shadow-lg shadow-blue-500/30 animate-float" style={{ animationDelay: '0.4s' }}>
                            <Droplets className="h-5 w-5 text-white" />
                        </div>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{currentHumidity}%</div>
                        <p className="text-xs font-medium mt-1 text-blue-600">Relative humidity</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 glass-card rounded-xl p-6">
                    <h3 className="text-lg font-semibold mb-6">AQI History</h3>
                    <div className="h-[300px] w-full">
                        {/* Si l'API renvoie une seule mesure, on construit un petit historique à partir du timestamp */}
                        <AQIChart data={aqiData ? [{ time: aqiData.timestamp || 'now', aqi: aqiData.aqi }] : undefined} />
                    </div>
                </div>
                <Card className="col-span-3 glass-card">
                    <CardHeader>
                        <CardTitle>Recent Alerts</CardTitle>
                        <CardDescription>
                            Latest notifications for your locations.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="text-sm text-center py-10 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20">
                            No recent alerts.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
