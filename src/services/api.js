// La URL base de tu backend. Es una buena práctica tenerla en un solo lugar.
const API_URL = 'https://distriapi2.onzacore.site/api';

/**
 * Realiza la llamada de login al backend.
 * @param {string} email - El correo del usuario.
 * @param {string} password - La contraseña del usuario.
 * @returns {Promise<object>} - Una promesa que resuelve con los datos del usuario y el token.
 * @throws {Error} - Lanza un error si las credenciales son incorrectas o hay un problema de red.
 */
export const login = async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || 'Error al iniciar sesión.');
    }

    return data;
};

/**
 * Crea un nuevo cliente en el servidor.
 * @param {object} clienteData - Datos del cliente (sin local_id).
 * @param {string} token - Token de autenticación.
 * @returns {Promise<object>} - El cliente creado por el servidor.
 */
export const createCliente = async (clienteData, token) => {
    const { local_id, status, ...dataToSend } = clienteData;
    const response = await fetch(`${API_URL}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(dataToSend)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error al crear el cliente.');
    }
    return data;
};

/**
 * Actualiza un cliente existente en el servidor.
 * @param {object} clienteData - Datos completos del cliente, incluyendo el `id` del servidor.
 * @param {string} token - Token de autenticación.
 * @returns {Promise<object>} - El cliente actualizado.
 */
export const updateCliente = async (clienteData, token) => {
    if (!clienteData.id) {
        throw new Error("No se puede actualizar un cliente sin ID del servidor.");
    }
    const { local_id, status, ...dataToSend } = clienteData;
    const response = await fetch(`${API_URL}/clientes/${clienteData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(dataToSend)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar el cliente.');
    }
    return data;
};

/**
 * Crea un nuevo pedido en el servidor.
 * @param {object} pedidoData - Datos del pedido (cliente_id, items, notas_entrega).
 * @param {string} token - Token de autenticación.
 * @returns {Promise<object>} - La respuesta del servidor con el ID del nuevo pedido.
 */
export const createPedido = async (pedidoData, token) => {
    const response = await fetch(`${API_URL}/pedidos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pedidoData)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error al crear el pedido en el servidor.');
    }
    return data;
};

/**
 * Actualiza un pedido existente en el servidor.
 * @param {number} pedidoId - El ID del servidor del pedido a actualizar.
 * @param {object} pedidoData - Datos a actualizar (items, notas_entrega).
 * @param {string} token - Token de autenticación.
 * @returns {Promise<object>} - La respuesta del servidor.
 */
export const updatePedido = async (pedidoId, pedidoData, token) => {
    const response = await fetch(`${API_URL}/pedidos/${pedidoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pedidoData)
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error al actualizar el pedido en el servidor.');
    }
    return data;
};

/**
 * Obtiene el historial de pedidos de un vendedor desde el servidor.
 * @param {string} token - Token de autenticación.
 * @returns {Promise<Array>} - Una lista de pedidos históricos.
 */
export const getMisPedidosHistoricos = async (token) => {
    const response = await fetch(`${API_URL}/pedidos/mis-pedidos-historicos`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error al obtener el historial de pedidos.');
    }
    return data;
};

// --- INICIO DE NUEVA FUNCIÓN ---
/**
 * Obtiene los estados actuales de una lista de pedidos desde el servidor.
 * @param {number[]} pedidoIds - Un array de IDs de pedidos del servidor.
 * @param {string} token - Token de autenticación.
 * @returns {Promise<Array<{id: number, estado: string}>>} - Una lista de objetos con id y estado.
 */
export const getPedidosStatusFromServer = async (pedidoIds, token) => {
    if (!pedidoIds || pedidoIds.length === 0) {
        return []; // No hay nada que consultar
    }
    const response = await fetch(`${API_URL}/pedidos/status?ids=${pedidoIds.join(',')}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.message || 'Error al obtener los estados de los pedidos.');
    }
    return data;
};
// --- FIN DE NUEVA FUNCIÓN ---
