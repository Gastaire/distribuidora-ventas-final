import Dexie from 'dexie';

// Creamos una única instancia de la base de datos para toda la aplicación.
export const db = new Dexie('DistribuidoraDB');

// Definimos la estructura (el "schema") de nuestra base de datos.
// Esta es la misma configuración que tenías, pero ahora en un módulo JS.
db.version(9).stores({
    clientes: '++local_id, id, nombre_comercio, status, retries, vendedor_id', 
    productos: 'id, nombre, archivado',
    pedidos: '++local_id, id, fecha, status, retries, cliente_id, cliente_local_id, estado',
    meta: 'key',
    borradores: 'cliente_local_id',
    listas_de_precios: '&id, nombre, activa, fecha_creacion',
    lista_precios_items: '++id, [lista_id+producto_id]'
}).upgrade(trans => {
    return trans.clientes.toCollection().modify(cliente => {
        if (cliente.latitud === undefined) cliente.latitud = null;
        if (cliente.longitud === undefined) cliente.longitud = null;
        if (cliente.horario_atencion === undefined) cliente.horario_atencion = '';
        if (cliente.horario_entrega === undefined) cliente.horario_entrega = '';
        if (cliente.vendedor_id === undefined) cliente.vendedor_id = null;
        if (cliente.vendedor_nombre === undefined) cliente.vendedor_nombre = null;
    });
});

// Version 10: Indexar last_modified en borradores para reconciliación eficiente
db.version(10).stores({
    clientes: '++local_id, id, nombre_comercio, status, retries, vendedor_id', 
    productos: 'id, nombre, archivado',
    pedidos: '++local_id, id, fecha, status, retries, cliente_id, cliente_local_id, estado',
    meta: 'key',
    borradores: 'cliente_local_id, last_modified',
    listas_de_precios: '&id, nombre, activa, fecha_creacion',
    lista_precios_items: '++id, [lista_id+producto_id]'
});


// Abrimos la conexión a la base de datos.
// Dexie maneja esto de forma muy eficiente.
db.open().catch(err => {
    console.error(`Error al abrir la base de datos: ${err.stack || err}`);
});