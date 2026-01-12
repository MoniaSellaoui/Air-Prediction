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
