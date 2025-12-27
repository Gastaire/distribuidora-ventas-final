import { db } from './db';
// --- INICIO DE MODIFICACIÓN ---
import { 
    createCliente, 
    createPedido, 
    updatePedido, 
    getPedidosStatusFromServer 
} from './api';
// --- FIN DE MODIFICACIÓN ---

const API_URL = 'https://distriapi.onzacore.site/api';

// --- FUNCIONES DE SINCRONIZACIÓN INDIVIDUALES ---

async function syncClientes(token) {
    const clientesPendientes = await db.clientes.where('status').equals('pending_sync').toArray();
    if (clientesPendientes.length === 0) return { created: 0, failed: 0, updated: 0 };

    let created = 0, failed = 0, updated = 0;
    for (const cliente of clientesPendientes) {
        try {
            if (cliente.id) {
                const updatedCliente = await updateCliente(cliente, token);
                await db.clientes.update(cliente.local_id, { status: 'synced', retries: 0 });
                updated++;
            } else { 
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
            if (pedido.id) {
                await updatePedido(pedido.id, pedidoParaApi, token);
                await db.pedidos.update(pedido.local_id, { status: 'synced', retries: 0 });
                updated++;
            } else { 
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
        fetch(`${API_URL}/productos?format=full`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/listas-precios/sync-data`, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (!clientesRes.ok || !productosRes.ok || !listasPreciosRes.ok) {
        throw new Error('Error al descargar datos maestros del servidor.');
    }

    const clientesDelServidor = await clientesRes.json();
    const productosData = await productosRes.json();
    const listasDePreciosData = await listasPreciosRes.json();

    await db.transaction('rw', db.clientes, db.productos, db.listas_de_precios, db.lista_precios_items, async () => {
        
        if (productosData.productos && Array.isArray(productosData.productos)) {
            const productosValidos = productosData.productos.filter(p => p.id != null);
            const productosUnicosMap = new Map(productosValidos.map(p => [p.id, p]));
            const productosFinales = Array.from(productosUnicosMap.values());
            await db.productos.clear();
            if (productosFinales.length > 0) {
                await db.productos.bulkPut(productosFinales);
            }
        }
        
        if (listasDePreciosData.listas) await db.listas_de_precios.bulkPut(listasDePreciosData.listas);
        if (listasDePreciosData.items) await db.lista_precios_items.bulkPut(listasDePreciosData.items);

        const clientesLocales = await db.clientes.toArray();
        const clientesLocalesMap = new Map(clientesLocales.map(c => [c.id, c]));
        const clientesParaGuardar = [];

        for (const clienteSrv of clientesDelServidor) {
            const clienteLocal = clientesLocalesMap.get(clienteSrv.id);
            if (clienteLocal) {
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

// --- INICIO DE NUEVA FUNCIÓN ---
/**
 * Sincroniza el estado de los pedidos locales con el servidor.
 */
async function syncPedidosStatus(token) {
    // 1. Obtener todos los pedidos locales que ya están sincronizados y tienen un ID de servidor.
    const syncedPedidos = await db.pedidos.where('status').equals('synced').and(p => !!p.id).toArray();
    if (syncedPedidos.length === 0) return 0;

    const pedidoIds = syncedPedidos.map(p => p.id);

    // 2. Consultar al servidor por el estado actual de esos pedidos.
    const serverStatuses = await getPedidosStatusFromServer(pedidoIds, token);
    const statusMap = new Map(serverStatuses.map(s => [s.id, s.estado]));

    let updatedCount = 0;
    const updates = [];

    // 3. Comparar y preparar actualizaciones.
    for (const pedidoLocal of syncedPedidos) {
        const serverStatus = statusMap.get(pedidoLocal.id);
        // Si el estado del servidor existe y es diferente al local, lo actualizamos.
        if (serverStatus && serverStatus !== pedidoLocal.estado) {
            updates.push({ key: pedidoLocal.local_id, changes: { estado: serverStatus } });
            updatedCount++;
        }
    }

    // 4. Aplicar todas las actualizaciones a la base de datos local de una sola vez.
    if (updates.length > 0) {
        await db.pedidos.bulkUpdate(updates);
    }
    
    return updatedCount;
}
// --- FIN DE NUEVA FUNCIÓN ---

export const runSync = async (token) => {
    if (!navigator.onLine || !token) {
        throw new Error('Sin conexión o sin sesión de usuario.');
    }

    let summary = {
        clientes: { created: 0, failed: 0, updated: 0 },
        pedidos: { created: 0, failed: 0, updated: 0 },
        downloaded: false,
        statusesUpdated: 0, // <-- Nuevo campo para el resumen
    };

    // 1. Descargar datos maestros actualizados del servidor
    await downloadServerData(token);
    summary.downloaded = true;

    // --- INICIO DE MODIFICACIÓN: Añadir sincronización de estados ---
    // 2. Sincronizar estados de pedidos existentes (antes de subir nuevos)
    summary.statusesUpdated = await syncPedidosStatus(token);
    // --- FIN DE MODIFICACIÓN ---

    // 3. Subir Clientes nuevos o modificados
    summary.clientes = await syncClientes(token);
    
    // 4. Subir Pedidos nuevos o modificados
    summary.pedidos = await syncPedidos(token);

    return summary;
};
