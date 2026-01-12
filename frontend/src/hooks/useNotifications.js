import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export const useNotifications = () => {
    const { user } = useContext(AuthContext);
    const userId = user?.id || user?._id;

    return useQuery({
        queryKey: ['notifications', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data } = await api.get(`/api/notifications/${userId}`);
            return data;
        },
        enabled: !!userId,
        refetchInterval: 10000, // Poll every 10 seconds for new alerts
    });
};
