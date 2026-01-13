import React, { createContext } from 'react';
import { useAQIAlert } from '../hooks/useAQIAlert';

/**
 * Context pour partager l'état AQI alert avec l'application
 */
export const AQIAlertContext = createContext({
    aqiAlert: null,
    isLoading: false,
    isHighAQI: false,
    aqiLevel: null,
});

export const AQIAlertProvider = ({ children }) => {
    const { data: aqiAlert, isLoading } = useAQIAlert();

    const value = {
        aqiAlert: aqiAlert || {},
        isLoading,
        isHighAQI: aqiAlert?.isHighAQI || false,
        aqiLevel: aqiAlert?.aqiLevel || null,
    };

    return (
        <AQIAlertContext.Provider value={value}>
            {children}
        </AQIAlertContext.Provider>
    );
};
