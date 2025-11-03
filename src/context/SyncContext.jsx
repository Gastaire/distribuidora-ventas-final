import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { runSync as apiRunSync } from '../services/syncService';
import { getMisPedidosHistoricos } from '../services/api'; 
import { db } from '../services/db';

const SyncContext = createContext(null);

export const SyncProvider = ({ children }) => {
    const { token } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [syncError, setSyncError] = useState(null);
    const [isFetchingHistory, setIsFetchingHistory] = useState(false);

    useEffect(() => {
        db.meta.get('lastSyncTime').then(item => {
            if (item) setLastSync(item.value);
        });
    }, []);

    const runSync = async (isAutomatic = false) => {
        if (isSyncing || !token) return;

        // Si es automático, no mostramos el spinner global, es una tarea de fondo.
        if (!isAutomatic) {
            setIsSyncing(true);
        }
        setSyncError(null);
        console.log(`[Sync ${isAutomatic ? 'Automático' : 'Manual'}] Iniciando...`);

        try {
            await apiRunSync(token);
            const now = new Date().toISOString();
            setLastSync(now);
            await db.meta.put({ key: 'lastSyncTime', value: now });
            console.log(`[Sync ${isAutomatic ? 'Automático' : 'Manual'}] Sincronización completada.`);
            return { success: true, message: 'Sincronización completada.' };
        } catch (error) {
            setSyncError(error.message);
            console.error(`[Sync ${isAutomatic ? 'Automático' : 'Manual'}] Error en runSync:`, error);
            return { success: false, message: error.message };
        } finally {
            if (!isAutomatic) {
                setIsSyncing(false);
            }
        }
    };

    // --- INICIO DE LA MODIFICACIÓN: Sincronización automática ---
    useEffect(() => {
        let intervalId = null;

        const TWELVE_HOURS_IN_MS = 12 * 60 * 60 * 1000;

        // Si hay un token (usuario logueado), configuramos la sincronización automática.
        if (token) {
            console.log('[Sync Automático] Configurando intervalo de 12 horas.');
            
            // Ejecutamos una vez al inicio (opcional, pero bueno para mantener todo fresco)
            runSync(true);

            intervalId = setInterval(() => {
                // Solo se ejecuta si hay conexión
                if (navigator.onLine) {
                    runSync(true); // 'true' indica que es una ejecución automática
                } else {
                    console.log('[Sync Automático] Omitiendo ejecución por falta de conexión.');
                }
            }, TWELVE_HOURS_IN_MS);
        }

        // Función de limpieza: se ejecuta si el usuario cierra sesión o el componente se desmonta.
        return () => {
            if (intervalId) {
                console.log('[Sync Automático] Limpiando intervalo.');
                clearInterval(intervalId);
            }
        };
    }, [token]); // Este efecto se volverá a ejecutar cada vez que el token cambie (login/logout).
    // --- FIN DE LA MODIFICACIÓN ---

    const fetchPedidosHistoricos = async () => {
        if (isFetchingHistory || !token) return;
        setIsFetchingHistory(true);
        setSyncError(null);
        try {
            const pedidosHistoricos = await getMisPedidosHistoricos(token);
            
            const pedidosParaGuardar = pedidosHistoricos.map(p => ({
                id: p.id,
                local_id: `server_${p.id}`,
                cliente_id: p.cliente_id,
                cliente_local_id: `server_cliente_${p.cliente_id}`,
                cliente_nombre_snapshot: p.nombre_comercio,
                usuario_id: p.usuario_id,
                nombre_vendedor: p.nombre_vendedor,
                fecha: p.fecha_creacion,
                items: p.items || [],
                notas_entrega: p.notas_entrega || '',
                estado: p.estado,
                status: 'synced',
                retries: 0,
            }));
            
            if (pedidosParaGuardar.length > 0) {
                await db.pedidos.bulkPut(pedidosParaGuardar);
            }
            
            return { success: true, count: pedidosParaGuardar.length };
        } catch (error) {
            setSyncError(error.message);
            console.error("Error al buscar historial de pedidos:", error);
            return { success: false, message: error.message };
        } finally {
            setIsFetchingHistory(false);
        }
    };

    const value = { isSyncing, lastSync, syncError, runSync, isFetchingHistory, fetchPedidosHistoricos };

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error("useSync debe ser usado dentro de un SyncProvider");
    }
    return context;
};