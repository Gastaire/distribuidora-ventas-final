import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
// --- INICIO DE MODIFICACIÓN: Importar la función correcta desde el servicio de API ---
import { runSync as apiRunSync } from '../services/syncService';
import { getMisPedidosHistoricos } from '../services/api'; 
// --- FIN DE MODIFICACIÓN ---
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

    const runSync = async () => {
        if (isSyncing || !token) return;

        setIsSyncing(true);
        setSyncError(null);
        try {
            await apiRunSync(token);
            const now = new Date().toISOString();
            setLastSync(now);
            await db.meta.put({ key: 'lastSyncTime', value: now });
            return { success: true, message: 'Sincronización completada.' };
        } catch (error) {
            setSyncError(error.message);
            console.error("Error en runSync:", error);
            return { success: false, message: error.message };
        } finally {
            setIsSyncing(false);
        }
    };

    const fetchPedidosHistoricos = async () => {
        if (isFetchingHistory || !token) return;
        setIsFetchingHistory(true);
        setSyncError(null);
        try {
            const pedidosHistoricos = await getMisPedidosHistoricos(token);
            
            // --- INICIO DE LA MODIFICACIÓN: Mapeo de datos explícito y robusto ---
            const pedidosParaGuardar = pedidosHistoricos.map(p => ({
                id: p.id,
                local_id: `server_${p.id}`, // ID local único para evitar colisiones
                cliente_id: p.cliente_id,
                cliente_local_id: `server_cliente_${p.cliente_id}`, // Creamos un ID local consistente
                cliente_nombre_snapshot: p.nombre_comercio, // <-- ARREGLO: Mapeamos el nombre del comercio
                usuario_id: p.usuario_id,
                nombre_vendedor: p.nombre_vendedor,
                fecha: p.fecha_creacion,
                items: p.items || [],
                notas_entrega: p.notas_entrega || '',
                estado: p.estado, // <-- ARREGLO: Aseguramos que el estado del servidor se guarde
                status: 'synced', // Marcamos como sincronizado
                retries: 0,
            }));
            // --- FIN DE LA MODIFICACIÓN ---
            
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