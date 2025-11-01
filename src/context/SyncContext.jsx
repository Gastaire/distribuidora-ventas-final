import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { runSync as apiRunSync } from '../services/syncService';
import { db } from '../services/db';

const SyncContext = createContext(null);

export const SyncProvider = ({ children }) => {
    const { token } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [syncError, setSyncError] = useState(null);

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

    const value = { isSyncing, lastSync, syncError, runSync };

    return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSync = () => {
    const context = useContext(SyncContext);
    if (!context) {
        throw new Error("useSync debe ser usado dentro de un SyncProvider");
    }
    return context;
};