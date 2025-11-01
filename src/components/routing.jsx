import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui';

/**
 * Un componente que protege rutas.
 * Si el usuario no está autenticado, lo redirige a /login.
 * Si está autenticado, renderiza la página solicitada.
 */
export const ProtectedRoute = () => {
    const { user, token } = useAuth();
    // Mientras carga, no hacemos nada. Podríamos mostrar un spinner global aquí.
    if (user === undefined) {
        return <div className="flex h-screen items-center justify-center"><Spinner className="border-blue-600 h-10 w-10"/></div>;
    }
    return user && token ? <Outlet /> : <Navigate to="/login" />;
};


/**
 * El layout principal para la aplicación una vez que el usuario está logueado.
 * Aquí irían elementos comunes como una barra de navegación o un pie de página.
 * Por ahora, simplemente renderiza la página que le corresponda (el "Outlet").
 */
export const AppLayout = () => {
    // Aquí podríamos añadir un Navbar, Sidebar, etc.
    return (
        <div className="min-h-screen bg-gray-50">
            <Outlet /> {/* <-- Aquí se renderizará HomePage, ClientesPage, etc. */}
        </div>
    );
};