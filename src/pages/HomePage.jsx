import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { db } from '../services/db';
import { UsersIcon, ShoppingCartIcon, SettingsIcon, CloudOffIcon } from '../components/ui';
import { getCronogramaZonas } from '../services/api';

// Componente reutilizable para los botones de acción
const ActionButton = ({ icon, text, onClick, badge, badgeColor }) => (
    <button onClick={onClick} className="bg-white p-4 rounded-xl shadow-md flex flex-col items-center justify-center text-center hover:bg-gray-50 active:scale-95 transition-transform relative">
        {badge > 0 && <span className={`absolute top-2 right-2 ${badgeColor} text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center`}>{badge}</span>}
        <div className="text-blue-600 mb-2">{React.cloneElement(icon, { className: "h-10 w-10" })}</div>
        <span className="font-semibold text-gray-700">{text}</span>
    </button>
);

const HomePage = () => {
    const { user, token } = useAuth();
    const { runSync, lastSync } = useSync();
    const navigate = useNavigate();
    const [stats, setStats] = useState({ pedidosHoy: 0, totalVendidoHoy: 0, clientesVisitadosHoy: 0, pendientesSync: 0 });
    const [offlineMode, setOfflineMode] = useState(!navigator.onLine);
    const [cronograma, setCronograma] = useState([]);
    const [showFullWeek, setShowFullWeek] = useState(false);

    useEffect(() => {
        // Auto-sync al entrar al Dashboard si pasaron más de 30 mins
        if (token && navigator.onLine) {
            const checkAndSync = () => {
                const now = new Date().getTime();
                const last = lastSync ? new Date(lastSync).getTime() : 0;
                const diffMins = (now - last) / (1000 * 60);
                if (diffMins > 30) {
                    console.log(`[Dashboard Auto-Sync] Pasaron ${Math.round(diffMins)} mins. Sincronizando...`);
                    runSync(true);
                }
            };
            
            checkAndSync();
            // Ejecutar cada 30 mins mientras esté en el dashboard
            const syncInterval = setInterval(checkAndSync, 30 * 60 * 1000);
            return () => clearInterval(syncInterval);
        }
    }, [token, navigator.onLine, lastSync]);

    useEffect(() => {
        const updateStats = async () => {
            try {
                const hoyLocalDate = new Date().toLocaleDateString('sv'); // Formato 'YYYY-MM-DD' en zona horaria local
                const allPedidos = await db.pedidos.toArray();
                
                const pedidos = allPedidos.filter(p => {
                    if (!p.fecha) return false;
                    const dateStr = new Date(p.fecha).toLocaleDateString('sv');
                    return dateStr === hoyLocalDate;
                });
                
                const totalVendido = pedidos.reduce((acc, p) => {
                    return acc + (p.items || []).reduce((sum, item) => sum + (item.cantidad * (item.precio || item.precio_congelado || 0)), 0);
                }, 0);

                const clientesUnicos = new Set(pedidos.map(p => p.cliente_id || p.cliente_local_id)).size;
                const pendientes = await db.pedidos.where('status').equals('pending_sync').count();
                const clientesPendientes = await db.clientes.where('status').equals('pending_sync').count();

                setStats({
                    pedidosHoy: pedidos.length,
                    totalVendidoHoy: totalVendido,
                    clientesVisitadosHoy: clientesUnicos,
                    pendientesSync: pendientes + clientesPendientes
                });
            } catch (error) {
                console.error("Error al actualizar estadísticas:", error);
            }
        };

        const fetchCronograma = async () => {
            if (!token) return;
            try {
                const data = await getCronogramaZonas(token);
                if (data && Array.isArray(data)) {
                    setCronograma(data);
                }
            } catch (e) {
                // Fail silently
            }
        };

        updateStats();
        fetchCronograma();
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
    }, [token]);

    const pendingCount = stats.pendientesSync;
    const badgeColor = pendingCount > 0 ? 'bg-yellow-500' : 'bg-green-500';

    const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const hoyDow = new Date().getDay(); // 0=Dom, 1=Lun ...
    const manyanaDow = (hoyDow + 1) % 7;

    const getZonaParaDia = (dow) => {
        const entrada = cronograma.find(e => {
            if (!e.fecha) return false;
            const datePart = e.fecha.split('T')[0];
            const [y, m, d] = datePart.split('-');
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            return dateObj.getDay() === dow;
        });
        return entrada ? entrada.zonas : null;
    };

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

            {cronograma.length > 0 && (
                <div className="px-4 pb-4">
                    <div className="bg-blue-600 text-white rounded-xl p-4 shadow">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-sm">🗺️ Zonas de Reparto</h3>
                            <button
                                onClick={() => setShowFullWeek(v => !v)}
                                className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full"
                            >
                                {showFullWeek ? 'Ver menos' : 'Ver semana'}
                            </button>
                        </div>
                        
                        {/* Hoy y Mañana siempre visibles */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-white/20 rounded-lg p-3">
                                <p className="text-xs text-blue-100">Hoy ({DIAS[hoyDow]})</p>
                                <p className="font-bold text-sm mt-0.5 text-white">
                                    {getZonaParaDia(hoyDow) || '—'}
                                </p>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3">
                                <p className="text-xs text-blue-100">Mañana ({DIAS[manyanaDow]})</p>
                                <p className="font-bold text-sm mt-0.5 text-white">
                                    {getZonaParaDia(manyanaDow) || '—'}
                                </p>
                            </div>
                        </div>
                        
                        {/* Semana completa (desplegable) */}
                        {showFullWeek && (
                            <div className="mt-3 space-y-1">
                                {[1,2,3,4,5,6,0].map(dow => { // Lun a Dom
                                    const zona = getZonaParaDia(dow);
                                    const isHoy = dow === hoyDow;
                                    return (
                                        <div key={dow}
                                            className={`flex justify-between items-center text-sm py-1.5 px-2 rounded-lg ${isHoy ? 'bg-white bg-opacity-25 font-bold' : 'opacity-80'}`}
                                        >
                                            <span>{DIAS[dow]}</span>
                                            <span>{zona || '—'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <main className="p-4 grid grid-cols-2 gap-4">
                <ActionButton icon={<UsersIcon/>} text="Clientes" onClick={() => navigate('/clientes')} />
                <ActionButton icon={<ShoppingCartIcon/>} text="Pedidos" onClick={() => navigate('/pedidos')} badge={pendingCount} badgeColor={badgeColor} />
            </main>
        </div>
    );
};

export default HomePage;