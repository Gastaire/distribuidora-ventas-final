import Dexie from 'dexie';

// Creamos una única instancia de la base de datos para toda la aplicación.
export const db = new Dexie('DistribuidoraDB');

// Definimos la estructura (el "schema") de nuestra base de datos.
// Esta es la misma configuración que tenías, pero ahora en un módulo JS.
db.version(8).stores({
    clientes: '++local_id, id, nombre_comercio, status, retries', 
    productos: 'id, nombre, archivado',
    pedidos: '++local_id, id, fecha, status, retries, cliente_id, cliente_local_id, estado',
    meta: 'key',
    borradores: 'cliente_local_id',
    listas_de_precios: '&id, nombre, activa, fecha_creacion',
    lista_precios_items: '++id, [lista_id+producto_id]'
});

// Abrimos la conexión a la base de datos.
// Dexie maneja esto de forma muy eficiente.
db.open().catch(err => {
    console.error(`Error al abrir la base de datos: ${err.stack || err}`);
});