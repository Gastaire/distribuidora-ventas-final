import { db } from './db';
import { createCliente, createPedido } from './api';

const API_URL = 'https://distriapi.onzacore.site/api';

// --- FUNCIONES DE SINCRONIZACIÓN INDIVIDUALES ---

async function syncClientes(token) {
    const clientesPendientes = await db.clientes.where('status').equals('pending_sync').toArray();
    if (clientesPendientes.length === 0) return { created: 0, failed: 0 };

    let created = 0, failed = 0;
    for (const cliente of clientesPendientes) {
        try {
            const newClienteFromServer = await createCliente(cliente, token);
            // Si el cliente se crea, lo actualizamos en Dexie con el ID del servidor y lo marcamos como 'synced'
            await db.transaction('rw', db.clientes, db.pedidos, async () => {
                await db.clientes.update(cliente.local_id, { id: newClienteFromServer.id, status: 'synced', retries: 0 });
                // Buscamos pedidos pendientes asociados a este cliente local y les asignamos el ID del servidor
                const pedidosAsociados = await db.pedidos.where({ cliente_local_id: cliente.local_id, status: 'pending_sync' }).toArray();
                if (pedidosAsociados.length > 0) {
                    const idsDePedidos = pedidosAsociados.map(p => p.local_id);
                    await db.pedidos.where('local_id').anyOf(idsDePedidos).modify({ cliente_id: newClienteFromServer.id });
                }
            });
            created++;
        } catch (error) {
            console.error(`Fallo al sincronizar cliente ${cliente.local_id}:`, error);
            await db.clientes.update(cliente.local_id, { status: 'sync_failed', retries: (cliente.retries || 0) + 1 });
            failed++;
        }
    }
    return { created, failed };
}

async function syncPedidos(token) {
    // Solo sincronizamos pedidos que ya tienen un `cliente_id` del servidor
    const pedidosListos = await db.pedidos.where('status').equals('pending_sync').filter(p => !!p.cliente_id).toArray();
    if (pedidosListos.length === 0) return { created: 0, failed: 0 };

    let created = 0, failed = 0;
    for (const pedido of pedidosListos) {
        try {
            const pedidoParaApi = {
                cliente_id: pedido.cliente_id,
                items: pedido.items,
                notas_entrega: pedido.notas_entrega,
            };
            const newPedidoFromServer = await createPedido(pedidoParaApi, token);
            await db.pedidos.update(pedido.local_id, { id: newPedidoFromServer.pedido_id, status: 'synced', retries: 0 });
            created++;
        } catch (error) {
            console.error(`Fallo al sincronizar pedido ${pedido.local_id}:`, error);
            await db.pedidos.update(pedido.local_id, { status: 'sync_failed', retries: (pedido.retries || 0) + 1 });
            failed++;
        }
    }
    return { created, failed };
}

async function downloadServerData(token) {
    const [clientesRes, productosRes, listasPreciosRes] = await Promise.all([
        fetch(`${API_URL}/clientes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/productos`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/listas-precios/sync-data`, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (!clientesRes.ok || !productosRes.ok || !listasPreciosRes.ok) {
        throw new Error('Error al descargar datos maestros del servidor.');
    }

    const clientesDelServidor = await clientesRes.json();
    const productosDelServidor = await productosRes.json();
    const listasDePreciosData = await listasPreciosRes.json();

    await db.transaction('rw', db.clientes, db.productos, db.listas_de_precios, db.lista_precios_items, async () => {
        await db.productos.bulkPut(productosDelServidor);
        if (listasDePreciosData.listas) {
            await db.listas_de_precios.bulkPut(listasDePreciosData.listas);
        }
        if (listasDePreciosData.items) {
            await db.lista_precios_items.bulkPut(listasDePreciosData.items);
        }

        const clientesLocales = await db.clientes.toArray();
        const clientesLocalesMap = new Map(clientesLocales.map(c => [c.id, c]));
        const clientesParaGuardar = [];

        for (const clienteSrv of clientesDelServidor) {
            const clienteLocal = clientesLocalesMap.get(clienteSrv.id);
            if (clienteLocal) {
                clientesParaGuardar.push({ ...clienteLocal, ...clienteSrv, status: 'synced' });
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
        clientes: { created: 0, failed: 0 },
        pedidos: { created: 0, failed: 0 },
        downloaded: false,
    };

    // 1. Subir Clientes nuevos
    summary.clientes = await syncClientes(token);
    
    // 2. Subir Pedidos listos
    summary.pedidos = await syncPedidos(token);

    // 3. Descargar datos maestros actualizados del servidor
    await downloadServerData(token);
    summary.downloaded = true;

    return summary;
};