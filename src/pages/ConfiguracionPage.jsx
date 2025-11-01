import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { ArrowLeftIcon, LogOutIcon, SyncIcon, Spinner, CloudOffIcon } from '../components/ui';

const ConfiguracionPage = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const { isSyncing, lastSync, syncError, runSync } = useSync();

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white p-4 shadow-md sticky top-0 flex items-center gap-4 z-10">
                <button onClick={() => navigate(-1)} className="text-blue-600"><ArrowLeftIcon className="h-6 w-6" /></button>
                <h2 className="font-bold text-lg">Configuración</h2>
            </header>
            <main className="p-4 space-y-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="font-bold text-gray-800">Cuenta</h3>
                    {user ? (
                        <>
                            <p className="text-gray-600 mt-2">Conectado como: <span className="font-semibold text-blue-600">{user.nombre}</span></p>
                            <button onClick={logout} className="w-full mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2">
                                <LogOutIcon className="h-5 w-5" /> Cerrar Sesión
                            </button>
                        </>
                    ) : (
                         <div className="flex items-center gap-3 mt-2 text-yellow-700">
                            <CloudOffIcon className="h-8 w-8"/>
                            <p>No has iniciado sesión. Tus datos solo se guardan en este dispositivo.</p>
                        </div>
                    )}
                </div>
                <div className="bg-white p-4 rounded-lg shadow">
                    <h3 className="font-bold text-gray-800">Sincronización</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Última sincronización: {lastSync ? new Date(lastSync).toLocaleString() : 'Nunca'}
                    </p>
                    <button onClick={runSync} disabled={isSyncing || !user} className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 disabled:bg-gray-400">
                        {isSyncing ? <Spinner /> : <SyncIcon className="h-5 w-5" />}
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                    </button>
                    {syncError && <p className="text-xs text-red-500 mt-2 text-center">{syncError}</p>}
                    {!user && <p className="text-xs text-red-500 mt-2 text-center">Debes iniciar sesión para poder sincronizar.</p>}
                </div>
            </main>
        </div>
    );
};

export default ConfiguracionPage;