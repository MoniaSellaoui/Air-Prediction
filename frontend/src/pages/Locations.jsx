import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Loader2, Plus, MapPin, Navigation } from 'lucide-react';

export default function Locations() {
    const [locations, setLocations] = useState([]);
    const [cities, setCities] = useState([]);
    const [selectedCity, setSelectedCity] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // Charger les villes disponibles
    useEffect(() => {
        const fetchCities = async () => {
            try {
                const response = await fetch('http://localhost:3000/cities');
                const data = await response.json();
                setCities(data);
            } catch (error) {
                console.error('Error fetching cities:', error);
            }
        };
        fetchCities();
    }, []);

    // Charger les localisations de l'utilisateur
    useEffect(() => {
        const fetchLocations = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    setIsLoading(false);
                    return;
                }
                
                const response = await fetch('http://localhost:3000/api/locations', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    setLocations(data || []);
                }
            } catch (error) {
                console.error('Error fetching locations:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLocations();
    }, []);

    const handleAddLocation = async (e) => {
        e.preventDefault();
        if (!selectedCity.trim()) return;

        try {
            const token = localStorage.getItem('token');
            const cityData = cities.find(city => city.name === selectedCity);
            
            if (!cityData) {
                alert('Ville non trouvée');
                return;
            }

            const response = await fetch('http://localhost:3000/api/locations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: cityData.name,
                    city: cityData.city,
                    latitude: cityData.latitude,
                    longitude: cityData.longitude
                })
            });

            if (response.ok) {
                const newLocation = await response.json();
                setLocations([...locations, newLocation]);
                setSelectedCity('');
                alert('Location ajoutée avec succès!');
            } else {
                alert('Erreur lors de l\'ajout de la location');
            }
        } catch (error) {
            console.error('Error adding location:', error);
            alert('Erreur lors de l\'ajout de la location');
        }
    };

    if (isLoading) {
        return <div className="flex h-[50vh] items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
    }

    return (
        <div className="space-y-8 animate-fade-in">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Locations
                </h1>
                <p className="text-muted-foreground">Manage your monitored locations</p>
            </div>

            <Card className="glass-card border-t-4 border-t-primary">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Add New Location
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleAddLocation} className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="grid w-full sm:max-w-sm items-center gap-2">
                            <Label htmlFor="city" className="text-sm font-medium">Select City</Label>
                            <select
                                id="city"
                                value={selectedCity}
                                onChange={(e) => setSelectedCity(e.target.value)}
                                className="w-full p-2 rounded-md bg-muted/30 border border-muted-foreground/20"
                            >
                                <option value="">Choose a city...</option>
                                {cities.map((city) => (
                                    <option key={city.id} value={city.name}>
                                        {city.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <Button
                            type="submit"
                            className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Add Location
                        </Button>
                    </form>
                </CardContent>
            </Card>

            <div>
                <h2 className="text-xl font-semibold mb-4">Your Locations</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {locations?.map((location, index) => {
                        const gradients = [
                            { bg: 'card-gradient-1', border: 'border-l-purple-500', iconBg: 'bg-gradient-to-br from-purple-400 to-indigo-500', iconShadow: 'shadow-purple-500/30' },
                            { bg: 'card-gradient-2', border: 'border-l-blue-500', iconBg: 'bg-gradient-to-br from-blue-400 to-cyan-500', iconShadow: 'shadow-blue-500/30' },
                            { bg: 'card-gradient-3', border: 'border-l-pink-500', iconBg: 'bg-gradient-to-br from-pink-400 to-rose-500', iconShadow: 'shadow-pink-500/30' },
                            { bg: 'card-gradient-4', border: 'border-l-emerald-500', iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500', iconShadow: 'shadow-emerald-500/30' },
                        ];
                        const style = gradients[index % gradients.length];

                        return (
                            <Card key={location.id || index} className={`glass-card hover:shadow-2xl transition-all duration-300 border-l-4 ${style.border} ${style.bg} overflow-hidden relative`}>
                                <div className={`absolute top-0 right-0 w-32 h-32 ${style.iconBg} opacity-10 rounded-full blur-3xl`}></div>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
                                    <CardTitle className="text-lg font-semibold">
                                        {location.name || location.city}
                                    </CardTitle>
                                    <div className={`p-2 ${style.iconBg} rounded-full shadow-lg ${style.iconShadow} animate-float`} style={{ animationDelay: `${index * 0.1}s` }}>
                                        <MapPin className="h-5 w-5 text-white" />
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 relative z-10">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <Navigation className="h-4 w-4" />
                                        <span className="font-mono">
                                            {location.latitude && location.longitude
                                                ? `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`
                                                : 'Coordinates unavailable'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-white/10">
                                        <p className="text-sm font-medium text-muted-foreground">
                                            {location.city || 'Unknown City'}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                    {locations?.length === 0 && (
                        <div className="col-span-full">
                            <div className="glass-card p-12 text-center border-dashed border-2 border-muted-foreground/20">
                                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                                <h3 className="text-lg font-semibold mb-2">No locations yet</h3>
                                <p className="text-muted-foreground mb-4">
                                    Add your first location above to start monitoring air quality
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
