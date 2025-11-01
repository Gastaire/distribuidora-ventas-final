import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext'; // Importamos nuestro hook
import { Spinner, PackageIcon, ArrowLeftIcon } from '../components/ui';

// El componente ya no necesita props para el login. ¡Más limpio!
const LoginPage = () => {
    // Obtenemos todo lo que necesitamos del contexto
    const { login, loading, error } = useAuth();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        // Llamamos a la función de login del contexto
        await login(email, password);
    };

    return (
        <div className="min-h-screen bg-blue-600 flex flex-col justify-center items-center p-4 font-sans">
            <div className="w-full max-w-sm">
                <div className="bg-white rounded-2xl shadow-lg p-8 relative">
                    {/* Este botón ya no tiene `onBack`, lo gestionaremos con el ruteo más adelante */}
                    <div className="text-center mb-6">
                        <PackageIcon className="h-16 w-16 text-blue-600 mx-auto" />
                        <h1 className="text-2xl font-bold text-gray-800 mt-2">Iniciar Sesión</h1>
                        <p className="text-gray-500">Sincroniza tus datos con la nube.</p>
                    </div>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-5">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                                Correo
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="w-full px-4 py-3 rounded-lg bg-gray-100 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                                required
                                aria-required="true"
                                autoComplete="email"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                                Contraseña
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••••"
                                className="w-full px-4 py-3 rounded-lg bg-gray-100 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
                                required
                                aria-required="true"
                                autoComplete="current-password"
                            />
                        </div>
                        {error && <p className="text-red-500 text-xs italic mb-4 text-center" role="alert">{error}</p>}
                        <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center text-lg transition-colors disabled:bg-blue-400">
                            {loading ? <Spinner /> : 'Ingresar y Sincronizar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;