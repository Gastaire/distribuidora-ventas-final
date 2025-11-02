import React, { createContext, useState, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { db } from '../services/db';
import { createPedido as apiCreatePedido, updatePedido as apiUpdatePedido } from '../services/api';

const PedidoContext = createContext(null);

export const PedidoProvider = ({ children }) => {
    const { user, token } = useAuth();
    const [openPedidos, setOpenPedidos] = useState({});
    const [draftNotes, setDraftNotes] = useState({});
    const [editingPedido, setEditingPedido] = useState(null);

    useEffect(() => {
        const loadBorradores = async () => {
            const borradoresArray = await db.borradores.toArray();
            const borradoresMap = borradoresArray.reduce((acc, b) => {
                acc[b.cliente_local_id] = b.cart;
                return acc;
            }, {});
            const notesMap = borradoresArray.reduce((acc, b) => {
                acc[b.cliente_local_id] = b.notes || ''; 
                return acc;
            }, {});
            setOpenPedidos(borradoresMap);
            setDraftNotes(notesMap);
        };
        loadBorradores();
    }, []);

    // --- INICIO DE LA MODIFICACIÓN ---
    const saveBorradorToDB = async (clienteLocalId, cart, notes) => {
        if (!clienteLocalId) return;
        try {
            // Ahora guardamos tanto el carrito como las notas.
            await db.borradores.put({ cliente_local_id: clienteLocalId, cart, notes });
        } catch (error) {
            console.error("Error al guardar borrador en Dexie:", error);
        }
    };

    const updateCart = (clienteLocalId, newCart) => {
        setOpenPedidos(prev => {
            const updated = { ...prev, [clienteLocalId]: newCart };
            // Pasamos las notas actuales para que no se borren.
            saveBorradorToDB(clienteLocalId, newCart, draftNotes[clienteLocalId] || '');
            return updated;
        });
    };
    
    const updateNotes = (clienteLocalId, newNotes) => {
        setDraftNotes(prev => {
            const updatedNotes = { ...prev, [clienteLocalId]: newNotes };
            // Guardamos las notas junto con el carrito actual.
            saveBorradorToDB(clienteLocalId, openPedidos[clienteLocalId] || [], newNotes);
            return updatedNotes;
        });
    };

    const discardCart = (clienteLocalId) => {
        setOpenPedidos(prev => {
            const { [clienteLocalId]: _, ...rest } = prev;
            return rest;
        });
        // También limpiamos las notas del borrador.
        setDraftNotes(prev => {
            const { [clienteLocalId]: _, ...rest } = prev;
            return rest;
        });
        db.borradores.delete(clienteLocalId);
        setEditingPedido(null);
    };
    // --- FIN DE LA MODIFICACIÓN ---

    const loadPedidoForEdit = async (pedido) => {
        const productos = await db.productos.toArray();
        const cart = pedido.items.map(item => {
            const producto = productos.find(p => p.id === item.producto_id);
            return producto ? { producto, cantidad: item.cantidad } : null;
        }).filter(Boolean);

        updateCart(pedido.cliente_local_id, cart);
        // Al cargar para editar, también cargamos las notas existentes del pedido.
        updateNotes(pedido.cliente_local_id, pedido.notas_entrega || '');
        setEditingPedido(pedido);
        return true;
    };

    const savePedido = async (cliente, cart, notas) => {
        if (!cliente || cart.length === 0) throw new Error("Cliente o carrito inválido.");

        const itemsParaGuardar = cart.map(item => ({ 
            producto_id: item.producto.id, 
            cantidad: item.cantidad,
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
                    await db.pedidos.update(editingPedido.local_id, { status: 'synced' });
                } catch (apiError) {
                    // La actualización local ya está hecha, solo logueamos el error de sync
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
            fecha: new Date().toISOString(),
            items: itemsParaGuardar,
            notas_entrega: notas,
            status: 'pending_sync',
            retries: 0
        };

        await db.pedidos.add(nuevoPedidoLocal);
        discardCart(cliente.local_id);

        if (navigator.onLine && token) {
            try {
                const newPedidoFromServer = await apiCreatePedido({ cliente_id: cliente.id, items: itemsParaGuardar, notas_entrega: notas }, token);
                await db.pedidos.update(nuevoPedidoLocal.local_id, { id: newPedidoFromServer.pedido_id, status: 'synced' });
                return { success: true, message: "Pedido creado y sincronizado." };
            } catch (apiError) {
                return { success: true, message: "Pedido guardado localmente. Se sincronizará más tarde." };
            }
        }
        
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