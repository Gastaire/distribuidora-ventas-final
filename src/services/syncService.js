import { db } from './db';
import { createCliente, createPedido, updatePedido } from './api';

const API_URL = 'https://distriapi.onzacore.site/api';

// --- FUNCIONES DE SINCRONIZACIÓN INDIVIDUALES ---

async function syncClientes(token) {
    const clientesPendientes = await db.clientes.where('status').equals('pending_sync').toArray();
    if (clientesPendientes.length === 0) return { created: 0, failed: 0, updated: 0 };

    let created = 0, failed = 0, updated = 0;
    for (const cliente of clientesPendientes) {
        try {
            // Si el cliente ya tiene un ID del servidor, es una actualización
            if (cliente.id) {
                const updatedCliente = await updateCliente(cliente, token);
                await db.clientes.update(cliente.local_id, { status: 'synced', retries: 0 });
                updated++;
            } else { // Si no, es una creación
                const newClienteFromServer = await createCliente(cliente, token);
                await db.transaction('rw', db.clientes, db.pedidos, async () => {
                    await db.clientes.update(cliente.local_id, { id: newClienteFromServer.id, status: 'synced', retries: 0 });
                    const pedidosAsociados = await db.pedidos.where({ cliente_local_id: cliente.local_id, status: 'pending_sync' }).toArray();
                    if (pedidosAsociados.length > 0) {
                        const idsDePedidos = pedidosAsociados.map(p => p.local_id);
                        await db.pedidos.where('local_id').anyOf(idsDePedidos).modify({ cliente_id: newClienteFromServer.id });
                    }
                });
                created++;
            }
        } catch (error) {
            console.error(`Fallo al sincronizar cliente ${cliente.local_id}:`, error);
            await db.clientes.update(cliente.local_id, { status: 'sync_failed', retries: (cliente.retries || 0) + 1 });
            failed++;
        }
    }
    return { created, failed, updated };
}

async function syncPedidos(token) {
    const pedidosListos = await db.pedidos.where('status').equals('pending_sync').filter(p => !!p.cliente_id).toArray();
    if (pedidosListos.length === 0) return { created: 0, failed: 0, updated: 0 };

    let created = 0, failed = 0, updated = 0;
    for (const pedido of pedidosListos) {
        try {
            const pedidoParaApi = {
                cliente_id: pedido.cliente_id,
                items: pedido.items,
                notas_entrega: pedido.notas_entrega,
            };
            // Si el pedido ya tiene un ID del servidor, es una actualización
            if (pedido.id) {
                await updatePedido(pedido.id, pedidoParaApi, token);
                await db.pedidos.update(pedido.local_id, { status: 'synced', retries: 0 });
                updated++;
            } else { // Si no, es una creación
                const newPedidoFromServer = await createPedido(pedidoParaApi, token);
                await db.pedidos.update(pedido.local_id, { id: newPedidoFromServer.pedido_id, status: 'synced', retries: 0 });
                created++;
            }
        } catch (error) {
            console.error(`Fallo al sincronizar pedido ${pedido.local_id}:`, error);
            await db.pedidos.update(pedido.local_id, { status: 'sync_failed', retries: (pedido.retries || 0) + 1 });
            failed++;
        }
    }
    return { created, failed, updated };
}

async function downloadServerData(token) {
    const [clientesRes, productosRes, listasPreciosRes] = await Promise.all([
        fetch(`${API_URL}/clientes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/productos?format=full`, { headers: { Authorization: `Bearer ${token}` } }), // Pedimos formato full
        fetch(`${API_URL}/listas-precios/sync-data`, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (!clientesRes.ok || !productosRes.ok || !listasPreciosRes.ok) {
        throw new Error('Error al descargar datos maestros del servidor.');
    }

    const clientesDelServidor = await clientesRes.json();
    const productosData = await productosRes.json(); // Ahora es un objeto { productos, categorias }
    const listasDePreciosData = await listasPreciosRes.json();

    await db.transaction('rw', db.clientes, db.productos, db.listas_de_precios, db.lista_precios_items, async () => {
        
        // Sincronización de productos
        if (productosData.productos && Array.isArray(productosData.productos)) {
            await db.productos.clear(); // Limpiamos para evitar productos viejos
            await db.productos.bulkPut(productosData.productos);
        }
        
        // Sincronización de listas de precios
        if (listasDePreciosData.listas) {
            await db.listas_de_precios.bulkPut(listasDePreciosData.listas);
        }
        if (listasDePreciosData.items) {
            await db.lista_precios_items.bulkPut(listasDePreciosData.items);
        }

        // Sincronización de clientes
        const clientesLocales = await db.clientes.toArray();
        const clientesLocalesMap = new Map(clientesLocales.map(c => [c.id, c]));
        const clientesParaGuardar = [];

        for (const clienteSrv of clientesDelServidor) {
            const clienteLocal = clientesLocalesMap.get(clienteSrv.id);
            if (clienteLocal) {
                // Si el cliente local está pendiente de sincronizar, no lo sobrescribimos
                if (clienteLocal.status !== 'pending_sync') {
                    clientesParaGuardar.push({ ...clienteLocal, ...clienteSrv, status: 'synced' });
                }
            } else {
                clientesParaGuardar.push({ ...clienteSrv, local_id: `server_${clienteSrv.id}_${Date.now()}`, status: 'synced' });
            }
        }
        if (clientesParaGuardar.length > 0) {
            await db.clientes.bulkPut(clientesParaGuardar);
        }
    });
}

// --- FUNCIÓN PRINCIPAL DE SINCRONIZACIÓN ---

export const runSync = async (token) => {
    if (!navigator.onLine || !token) {
        throw new Error('Sin conexión o sin sesión de usuario.');
    }

    let summary = {
        clientes: { created: 0, failed: 0, updated: 0 },
        pedidos: { created: 0, failed: 0, updated: 0 },
        downloaded: false,
    };

    // 1. Descargar datos maestros actualizados del servidor
    await downloadServerData(token);
    summary.downloaded = true;

    // 2. Subir Clientes nuevos o modificados
    summary.clientes = await syncClientes(token);
    
    // 3. Subir Pedidos nuevos o modificados
    summary.pedidos = await syncPedidos(token);

    return summary;
};