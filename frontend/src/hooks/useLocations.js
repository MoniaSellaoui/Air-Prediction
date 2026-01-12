import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { toast } from 'sonner';

export const useLocations = () => {
    return useQuery({
        queryKey: ['locations'],
        queryFn: async () => {
            // Le backend renvoie les localisations de l'utilisateur courant
            const { data } = await api.get('/api/locations');
            return data;
        },
    });
};

export const useAddLocation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (locationData) => {
            // Le backend déduit userId depuis le token JWT et géocode name/city
            const { data } = await api.post('/api/locations', locationData);
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['locations']);
            toast.success('Location added successfully');
        },
        onError: (error) => {
            toast.error('Failed to add location');
            console.error(error);
        }
    });
};
export const useDeleteLocation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (locationId) => {
            await api.delete(`/api/locations/${locationId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['locations']);
            toast.success('Location removed');
        },
        onError: (error) => {
            toast.error('Failed to remove location');
            console.error(error);
        }
    });
};

export const useSearchLocations = (query) => {
    return useQuery({
        queryKey: ['search-locations', query],
        queryFn: async () => {
            if (!query) return [];
            const { data } = await api.get(`/api/locations/public/search?q=${encodeURIComponent(query)}`);
            return data;
        },
        enabled: !!query && query.length > 2,
    });
};
