import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Hook pour récupérer les données AQI de l'utilisateur et détecter les niveaux élevés
 * @returns {Object} { aqiLevel, isHighAQI, aqiData, isLoading }
 * 
 * Niveaux AQI:
 * 0-50: Good
 * 51-100: Moderate
 * 101-150: Unhealthy for Sensitive Groups
 * 151-200: Unhealthy
 * 201-300: Very Unhealthy
 * 301+: Hazardous
 */
export const useAQIAlert = () => {
    const { user } = useContext(AuthContext);
    const userId = user?.id || user?._id;

    return useQuery({
        queryKey: ['aqi-alert', userId],
        queryFn: async () => {
            if (!userId) return { aqiLevel: null, isHighAQI: false };

            try {
                // Récupérer les données AQI de l'utilisateur
                const { data } = await api.get(`/api/aqi/user-location`);
                
                const aqiValue = data?.aqi || 0;
                
                // AQI est considéré comme élevé s'il est > 100 (Unhealthy for Sensitive Groups et plus)
                const isHighAQI = aqiValue > 100;
                
                return {
                    aqiLevel: aqiValue,
                    isHighAQI,
                    aqiData: data,
                    location: data?.location || 'Unknown'
                };
            } catch (error) {
                console.warn('Error fetching AQI alert:', error);
                return { aqiLevel: null, isHighAQI: false };
            }
        },
        enabled: !!userId,
        refetchInterval: 30000, // Mettre à jour toutes les 30 secondes
        staleTime: 15000, // Données valides pendant 15 secondes
    });
};

/**
 * Retourne la couleur et le label basé sur la valeur AQI
 */
export const getAQIColor = (aqiValue) => {
    if (!aqiValue) return { color: 'bg-gray-500', label: 'N/A', bgClass: 'bg-gray-500/10', textClass: 'text-gray-500' };
    
    if (aqiValue <= 50) return { color: 'bg-green-500', label: 'Good', bgClass: 'bg-green-500/10', textClass: 'text-green-500' };
    if (aqiValue <= 100) return { color: 'bg-yellow-500', label: 'Moderate', bgClass: 'bg-yellow-500/10', textClass: 'text-yellow-500' };
    if (aqiValue <= 150) return { color: 'bg-orange-500', label: 'Unhealthy (SG)', bgClass: 'bg-orange-500/10', textClass: 'text-orange-500' };
    if (aqiValue <= 200) return { color: 'bg-red-500', label: 'Unhealthy', bgClass: 'bg-red-500/10', textClass: 'text-red-500' };
    if (aqiValue <= 300) return { color: 'bg-purple-500', label: 'Very Unhealthy', bgClass: 'bg-purple-500/10', textClass: 'text-purple-500' };
    return { color: 'bg-red-600', label: 'Hazardous', bgClass: 'bg-red-600/10', textClass: 'text-red-600' };
};
