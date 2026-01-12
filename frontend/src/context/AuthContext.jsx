import { createContext, useState } from 'react';
import api from '../lib/api';
import { toast } from 'sonner';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Lazy initialization for user state
    const [user, setUser] = useState(() => {
        const token = localStorage.getItem('token');
        return token ? { token } : null;
    });
    // Loading state effectively not needed if sync check, keeping variable for API shape consistency if needed later
    // but for now removing to fix lint error or setting it to false always.
    const loading = false;

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, user: userData } = response.data;
            localStorage.setItem('token', token);
            setUser(userData || { email });
            toast.success('Logged in successfully');
            return true;
        } catch (error) {
            console.error('Login error:', error);
            toast.error(error.response?.data?.error || 'Login failed');
            return false;
        }
    };

    const register = async (name, email, password) => {
        try {
            await api.post('/auth/register', { name, email, password });
            toast.success('Registration successful! Please login.');
            return true;
        } catch (error) {
            console.error('Registration error:', error);
            toast.error(error.response?.data?.error || 'Registration failed');
            return false;
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        toast.info('Logged out');
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
