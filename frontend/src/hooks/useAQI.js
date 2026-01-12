import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export const useAQI = (locationName) => {
    return useQuery({
        queryKey: ['aqi', locationName],
        queryFn: async () => {
            // Le service AQI expose GET /api/aqi/:location (nom de ville ou lieu)
            const encoded = encodeURIComponent(locationName);
            const { data } = await api.get(`/api/aqi/${encoded}`);
            return data;
        },
        enabled: !!locationName, // On ne lance la requête que si un nom de lieu est défini
    });
};

export const useAQIHistory = (locationName) => {
    return useQuery({
        queryKey: ['aqi-history', locationName],
        queryFn: async () => {
            const encoded = encodeURIComponent(locationName);
            const { data } = await api.get(`/api/aqi/history/${encoded}`);
            return data;
        },
        enabled: !!locationName
    })
}
