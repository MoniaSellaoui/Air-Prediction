import { useContext } from 'react';
import { AQIAlertContext } from '../context/AQIAlertContext';

/**
 * Hook pour accéder au contexte d'alerte AQI
 */
export const useAQIAlertContext = () => {
    const context = useContext(AQIAlertContext);
    
    if (!context) {
        throw new Error('useAQIAlertContext must be used within AQIAlertProvider');
    }
    
    return context;
};
