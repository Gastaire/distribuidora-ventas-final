import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db } from '../services/db';
import { UsersIcon, ShoppingCartIcon, SettingsIcon, CloudOffIcon } from '../components/ui';

// Componente reutilizable para los botones de acción
const ActionButton = ({ icon, text, onClick, badge, badgeColor }) => (
    <button onClick={onClick} className="bg-white p-4 rounded-xl shadow-md flex flex-col items-center justify-center text-center hover:bg-gray-50 active:scale-95 transition-transform relative">
        {badge > 0 && <span className={`absolute top-2 right-2 ${badgeColor} text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center`}>{badge}</span>}
        <div className="text-blue-600 mb-2">{React.cloneElement(icon, { className: "h-10 w-10" })}</div>
        <span className="font-semibold text-gray-700">{text}</span>
    </button>
);

const HomePage = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ pedidosHoy: 0, totalVendidoHoy: 0, clientesVisitadosHoy: 0, pendientesSync: 0 });
    const [offlineMode, setOfflineMode] = useState(!navigator.onLine);

    useEffect(() => {
        const updateStats = async () => {
            try {
                const hoy = new Date().toDateString();
                const pedidosDeHoy = await db.pedidos.filter(p => new Date(p.fecha).toDateString() === hoy).toArray();
                
                const totalVendido = pedidosDeHoy.reduce((total, pedido) => {
                    return total + (pedido.items || []).reduce((itemTotal, item) => itemTotal + (item.precio_congelado || 0) * item.cantidad, 0);
                }, 0);

                const clientesVisitados = new Set(pedidosDeHoy.map(p => p.cliente_local_id || p.cliente_id)).size;
                const pendientes = await db.pedidos.where('status').notEqual('synced').count();

                setStats({
                    pedidosHoy: pedidosDeHoy.length,
                    totalVendidoHoy: totalVendido,
                    clientesVisitadosHoy: clientesVisitados,
                    pendientesSync: pendientes
                });
            } catch (error) {
                console.error('Error calculando estadísticas:', error);
            }
        };

        updateStats();
        const interval = setInterval(updateStats, 5000); // Actualiza cada 5 segundos
        
        const handleOnline = () => setOfflineMode(false);
        const handleOffline = () => setOfflineMode(true);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            clearInterval(interval);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const pendingCount = stats.pendientesSync;
    const badgeColor = pendingCount > 0 ? 'bg-yellow-500' : 'bg-green-500';

    return (
        <div className="bg-white min-h-screen">
            <header className="bg-blue-600 text-white p-4 shadow-md sticky top-0 z-10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-xl font-bold">{user ? `Hola, ${user.nombre}` : 'Modo Offline'}</h1>
                        {offlineMode && (
                            <div className="flex items-center gap-1 bg-yellow-500 text-yellow-900 px-2 py-1 rounded-full text-xs font-medium">
                                <CloudOffIcon className="h-4 w-4"/>
                                Offline
                            </div>
                        )}
                    </div>
                    <button onClick={() => navigate('/configuracion')} title="Configuración"><SettingsIcon className="h-6 w-6"/></button>
                </div>
            </header>
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <h2 className="text-lg font-bold text-gray-800 mb-3">Resumen del Día</h2>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600">Pedidos del Día</p>
                        <p className="text-2xl font-bold text-blue-600">{stats.pedidosHoy}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600">Total Vendido Hoy</p>
                        <p className="text-xl font-bold text-green-600">${stats.totalVendidoHoy.toFixed(2)}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600">Clientes Visitados</p>
                        <p className="text-2xl font-bold text-purple-600">{stats.clientesVisitadosHoy}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg shadow-sm">
                        <p className="text-sm text-gray-600">Pendientes de Sync</p>
                        <p className="text-2xl font-bold text-yellow-600">{stats.pendientesSync}</p>
                    </div>
                </div>
            </div>
            <main className="p-4 grid grid-cols-2 gap-4">
                <ActionButton icon={<UsersIcon/>} text="Clientes" onClick={() => navigate('/clientes')} />
                <ActionButton icon={<ShoppingCartIcon/>} text="Pedidos" onClick={() => navigate('/pedidos')} badge={pendingCount} badgeColor={badgeColor} />
            </main>
        </div>
    );
};

export default HomePage;