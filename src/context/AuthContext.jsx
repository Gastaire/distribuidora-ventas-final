import React, { createContext, useState, useContext, useEffect } from 'react';
import { login as apiLogin } from '../services/api';

// 1. Creamos el contexto
const AuthContext = createContext(null);

// 2. Creamos el "Proveedor" que envolverá nuestra aplicación
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Al cargar la app, revisamos si ya hay una sesión guardada en el navegador
    useEffect(() => {
        const storedToken = localStorage.getItem('authToken');
        const storedUser = localStorage.getItem('authUser');
        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
        }
    }, []);

    // Función de Login que usarán los componentes
    const login = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiLogin(email, password);
            setUser(data.user);
            setToken(data.token);
            // Guardamos la sesión para que no se pierda al recargar la página
            localStorage.setItem('authToken', data.token);
            localStorage.setItem('authUser', JSON.stringify(data.user));
            return true; // Éxito
        } catch (err) {
            setError(err.message);
            return false; // Fracaso
        } finally {
            setLoading(false);
        }
    };

    // Función de Logout
    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('authUser');
    };

    // El valor que compartiremos con toda la app
    const value = { user, token, loading, error, login, logout };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 3. Creamos un "Hook" personalizado para usar el contexto fácilmente
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe ser usado dentro de un AuthProvider');
    }
    return context;
};