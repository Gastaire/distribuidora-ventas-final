import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/db';
import { createPedido as apiCreatePedido, updatePedido as apiUpdatePedido, saveBorradorToServer, getBorradoresFromServer, deleteBorradorFromServer } from '../services/api';

const PedidoContext = createContext(null);

export const PedidoProvider = ({ children }) => {
    const { user, token } = useAuth();
    const [openPedidos, setOpenPedidos] = useState({});
    const [draftNotes, setDraftNotes] = useState({});
    const [editingPedido, setEditingPedido] = useState(null);

    useEffect(() => {
        const loadBorradores = async () => {
            // Load local drafts first
            const borradoresLocales = await db.borradores.toArray();
            const localMap = new Map(borradoresLocales.map(b => [b.cliente_local_id, b]));

            // Try to merge with server drafts if online
            if (navigator.onLine && token) {
                try {
                    const serverBorradores = await getBorradoresFromServer(token);
                    for (const sb of serverBorradores) {
                        const local = localMap.get(sb.cliente_local_id);
                        const serverCart = sb.cart;
                        // Parse server format: cart can be { items, notes } or raw array
                        const serverItems = serverCart?.items || (Array.isArray(serverCart) ? serverCart : []);
                        const serverNotes = serverCart?.notes || '';
                        const serverModified = sb.last_modified || '1970-01-01';

                        if (!local || serverModified > (local.last_modified || '1970-01-01')) {
                            // Server is newer or local doesn't exist — use server version
                            const merged = { cliente_local_id: sb.cliente_local_id, cart: serverItems, notes: serverNotes, last_modified: serverModified };
                            await db.borradores.put(merged);
                            localMap.set(sb.cliente_local_id, merged);
                        }
                    }
                } catch (err) {
                    console.warn('Could not fetch server borradores:', err.message);
                }
            }

            // Build state from merged data
            const allBorradores = Array.from(localMap.values());
            const borradoresMap = {};
            const notesMap = {};
            for (const b of allBorradores) {
                borradoresMap[b.cliente_local_id] = b.cart;
                notesMap[b.cliente_local_id] = b.notes || '';
            }
            setOpenPedidos(borradoresMap);
            setDraftNotes(notesMap);
        };
        loadBorradores();
    }, [token]);

    const syncTimers = React.useRef({});
    const pendingSyncs = React.useRef({}); // Guarda la data más reciente para cada cliente

    // Listener para cuando el usuario cierra la pestaña o cambia de app en el celular
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden' && navigator.onLine && token) {
                // Forzar guardado sincrónico (dentro de lo posible) de todo lo pendiente
                Object.keys(pendingSyncs.current).forEach(clienteLocalId => {
                    const data = pendingSyncs.current[clienteLocalId];
                    if (data) {
                        saveBorradorToServer(clienteLocalId, data.cart, data.notes, token).catch(() => {});
                        delete pendingSyncs.current[clienteLocalId];
                        if (syncTimers.current[clienteLocalId]) clearTimeout(syncTimers.current[clienteLocalId]);
                    }
                });
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [token]);

    const saveBorradorToDB = async (clienteLocalId, cart, notes) => {
        if (!clienteLocalId) return;
        const isFirstItem = !openPedidos[clienteLocalId] || (openPedidos[clienteLocalId]?.length === 0 && cart?.length > 0);
        try {
            await db.borradores.put({ cliente_local_id: clienteLocalId, cart, notes, last_modified: new Date().toISOString() });
        } catch (error) {
            console.error("Error al guardar borrador en Dexie:", error);
        }
        
        if (navigator.onLine && token) {
            pendingSyncs.current[clienteLocalId] = { cart, notes };
            if (syncTimers.current[clienteLocalId]) clearTimeout(syncTimers.current[clienteLocalId]);
            
            // Si es el primer item, guardar inmediatamente (sin esperar el debounce)
            const delay = isFirstItem ? 0 : 1000;
            syncTimers.current[clienteLocalId] = setTimeout(async () => {
                const data = pendingSyncs.current[clienteLocalId];
                if (!data) return;
                try {
                    await saveBorradorToServer(clienteLocalId, data.cart, data.notes, token);
                    delete pendingSyncs.current[clienteLocalId];
                    console.log(`[Borrador] Guardado en nube: ${clienteLocalId} (${data.cart?.length || 0} items)`);
                } catch (err) {
                    console.warn('[Borrador] Cloud sync failed, se reintentara en el proximo sync:', err.message);
                }
            }, delay);
        }
    };

    const updateCart = (clienteLocalId, newCart) => {
        setOpenPedidos(prev => {
            const updated = { ...prev, [clienteLocalId]: newCart };
            saveBorradorToDB(clienteLocalId, newCart, draftNotes[clienteLocalId] || '');
            return updated;
        });
    };
    
    const updateNotes = (clienteLocalId, newNotes) => {
        setDraftNotes(prev => {
            const updatedNotes = { ...prev, [clienteLocalId]: newNotes };
            saveBorradorToDB(clienteLocalId, openPedidos[clienteLocalId] || [], newNotes);
            return updatedNotes;
        });
    };

    const discardCart = (clienteLocalId) => {
        setOpenPedidos(prev => {
            const { [clienteLocalId]: _, ...rest } = prev;
            return rest;
        });
        setDraftNotes(prev => {
            const { [clienteLocalId]: _, ...rest } = prev;
            return rest;
        });
        if (syncTimers.current[clienteLocalId]) clearTimeout(syncTimers.current[clienteLocalId]);
        delete pendingSyncs.current[clienteLocalId];
        db.borradores.delete(clienteLocalId);
        // Delete from server too
        if (navigator.onLine && token) {
            deleteBorradorFromServer(clienteLocalId, token).catch(err =>
                console.warn('Could not delete server borrador:', err.message)
            );
        }
        setEditingPedido(null);
    };

    const loadPedidoForEdit = async (pedido) => {
        const productos = await db.productos.toArray();
        const cart = pedido.items.map(item => {
            const producto = productos.find(p => p.id === item.producto_id);
            return producto ? { producto, cantidad: item.cantidad } : null;
        }).filter(Boolean);

        updateCart(pedido.cliente_local_id, cart);
        updateNotes(pedido.cliente_local_id, pedido.notas_entrega || '');
        setEditingPedido(pedido);
        return true;
    };

    const savePedido = async (cliente, cart, notas) => {
        if (!cliente || cart.length === 0) throw new Error("Cliente o carrito inválido.");

        const itemsParaGuardar = cart.map(item => ({ 
            producto_id: item.producto.id, 
            cantidad: item.cantidad,
            precio_congelado: item.producto.precio_unitario, // Guardamos el precio al momento de la venta
            nombre_producto: item.producto.nombre,
            codigo_sku: item.producto.codigo_sku,
        }));

        if (editingPedido) {
            const pedidoActualizadoLocal = {
                ...editingPedido,
                items: itemsParaGuardar,
                notas_entrega: notas,
                status: 'pending_sync',
                retries: 0
            };
            await db.pedidos.put(pedidoActualizadoLocal);
            
            if (navigator.onLine && token && editingPedido.id) {
                try {
                    await apiUpdatePedido(editingPedido.id, { items: itemsParaGuardar, notas_entrega: notas }, token);
                    // --- INICIO DE LA MODIFICACIÓN (EDICIÓN) ---
                    // Actualizamos el pedido local sin borrar los items y notas.
                    const updateData = { status: 'synced', estado: 'pendiente' };
                    const currentPedido = await db.pedidos.get(editingPedido.local_id);
                    await db.pedidos.put({ ...currentPedido, ...updateData });
                    // --- FIN DE LA MODIFICACIÓN ---
                } catch (apiError) {
                    console.error("API Error en update:", apiError.message);
                }
            }
            discardCart(cliente.local_id);
            return { success: true, message: "Pedido actualizado localmente." };
        }

        const nuevoPedidoLocal = {
            local_id: `local_pedido_${Date.now()}`,
            cliente_id: cliente.id,
            cliente_local_id: cliente.local_id,
            cliente_nombre_snapshot: cliente.nombre_comercio,
            usuario_id: user?.id || 'offline',
            nombre_vendedor: user?.nombre,
            fecha: new Date().toISOString(),
            items: itemsParaGuardar,
            notas_entrega: notas,
            status: 'pending_sync',
            estado: 'pendiente', // Por defecto
            retries: 0
        };

        await db.pedidos.add(nuevoPedidoLocal);

        if (navigator.onLine && token) {
            try {
                const newPedidoFromServer = await apiCreatePedido({ cliente_id: cliente.id, items: itemsParaGuardar, notas_entrega: notas }, token);
                // --- INICIO DE LA MODIFICACIÓN (CREACIÓN) ---
                // Actualizamos el pedido local sin borrar los items y notas.
                const updateData = { id: newPedidoFromServer.pedido_id, status: 'synced', estado: 'pendiente' };
                const currentPedido = await db.pedidos.get(nuevoPedidoLocal.local_id);
                await db.pedidos.put({ ...currentPedido, ...updateData });
                // --- FIN DE LA MODIFICACIÓN ---
            } catch (apiError) {
                console.error("API Error en create:", apiError.message);
            }
        }
        
        discardCart(cliente.local_id);
        return { success: true, message: "Pedido guardado localmente." };
    };

    const value = { openPedidos, editingPedido, draftNotes, updateCart, updateNotes, discardCart, savePedido, loadPedidoForEdit };

    return <PedidoContext.Provider value={value}>{children}</PedidoContext.Provider>;
};

export const usePedidos = () => {
    const context = useContext(PedidoContext);
    if (!context) throw new Error("usePedidos debe ser usado dentro de un PedidoProvider");
    return context;
};