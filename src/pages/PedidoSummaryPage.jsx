import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePedidos } from '../context/PedidoContext';
import { db } from '../services/db';
import { ArrowLeftIcon, Spinner, PlusIcon } from '../components/ui';
import { generatePedidoPDF } from '../services/pdfService'; // <-- IMPORTAMOS EL SERVICIO DE PDF

const PedidoSummaryPage = () => {
    const navigate = useNavigate();
    const { clienteLocalId } = useParams();
    const { openPedidos, updateCart, savePedido, editingPedido, draftNotes, updateNotes } = usePedidos();
    
    const [cliente, setCliente] = useState(null);
    const notas = draftNotes[clienteLocalId] || '';
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const cart = openPedidos[clienteLocalId] || [];

    useEffect(() => {
        db.clientes.get(clienteLocalId).then(setCliente);
    }, [clienteLocalId]);

    const handleUpdateCantidad = (productoId, cantidadStr) => {
        const cantidad = parseFloat(String(cantidadStr).replace(',', '.'));
        let newCart;
        if (isNaN(cantidad) || cantidad <= 0) {
            newCart = cart.filter(item => item.producto.id !== productoId);
        } else {
            newCart = cart.map(item => item.producto.id === productoId ? { ...item, cantidad } : item);
        }
        updateCart(clienteLocalId, newCart);
    };

    const handleSave = async () => {
        setLoading(true);
        setError('');
        try {
            const result = await savePedido(cliente, cart, notas);
            
            // --- INICIO DE LA MODIFICACIÓN: Preguntar para generar PDF ---
            const confirmed = window.confirm(`${result.message}\n\n¿Quieres guardar una copia del pedido en PDF?`);
            if (confirmed) {
                // Reconstruimos el objeto pedido con los datos que tenemos a mano para el PDF
                const pedidoParaPDF = {
                    ...(editingPedido || {}),
                    local_id: editingPedido ? editingPedido.local_id : `local_${Date.now()}`,
                    cliente_nombre_snapshot: cliente.nombre_comercio,
                    fecha: new Date().toISOString(),
                    items: cart.map(item => ({...item, ...item.producto})), // Combinamos para tener todos los datos
                    notas_entrega: notas
                };
                await generatePedidoPDF(pedidoParaPDF, { action: 'download' });
            }
            // --- FIN DE LA MODIFICACIÓN ---

            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };
    
    const goBackPath = editingPedido ? `/pedidos/editar/${editingPedido.local_id}` : `/pedidos/nuevo/${clienteLocalId}`;

    const totalPedido = cart.reduce((acc, item) => acc + (item.producto.precio_unitario * item.cantidad), 0);

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="bg-white p-4 shadow-md sticky top-0 flex items-center gap-4 z-10">
                <button onClick={() => navigate(goBackPath)} className="text-blue-600" aria-label="Volver">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <div>
                    <h2 className="font-bold text-lg">Revisar Pedido</h2>
                    <p className="text-xs text-gray-500">{cliente?.nombre_comercio}</p>
                </div>
            </header>
            <main className="flex-1 overflow-y-auto p-4">
                <button onClick={() => navigate(goBackPath)} className="w-full bg-blue-100 text-blue-800 font-semibold py-3 rounded-lg mb-4 flex items-center justify-center gap-2">
                    <PlusIcon className="h-5 w-5"/> {editingPedido ? 'Modificar productos' : 'Agregar más productos'}
                </button>
                {cart.map(item => (
                    <div key={item.producto.id} className="bg-white p-3 rounded-lg shadow mb-3 flex items-center gap-4">
                        <img loading="lazy" src={item.producto.imagen_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=...'} alt={item.producto.nombre} className="w-12 h-12 rounded-md object-cover"/>
                        <div className="flex-1">
                            <p className="font-semibold text-gray-800 text-sm">{item.producto.nombre}</p>
                            <p className="text-xs text-gray-500">${item.producto.precio_unitario.toFixed(2)} c/u</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium">Cant:</label>
                            <input type="text" inputMode="decimal" value={item.cantidad} onChange={(e) => handleUpdateCantidad(item.producto.id, e.target.value)} className="w-20 text-center border-gray-300 border rounded-lg p-1 bg-transparent" min="0" />
                        </div>
                    </div>
                ))}
                <div className="mt-4">
                    <label htmlFor="notas" className="block text-sm font-medium text-gray-700 mb-1">Notas para la entrega</label>
                    <textarea 
                        id="notas" 
                        value={notas} 
                        onChange={e => updateNotes(clienteLocalId, e.target.value)} 
                        rows="3" 
                        className="w-full p-2 border rounded-lg" 
                        placeholder="Ej: Dejar en el depósito del fondo..."
                    ></textarea>
                </div>
            </main>
            <footer className="bg-white p-4 shadow-inner sticky bottom-0 border-t">
                <div className="flex justify-between items-center font-bold text-xl mb-3">
                    <span>Total:</span>
                    <span>${totalPedido.toFixed(2)}</span>
                </div>
                {error && <p className="text-red-500 text-sm mb-2 text-center">{error}</p>}
                <button onClick={handleSave} disabled={loading || cart.length === 0} className="w-full bg-green-500 text-white font-bold py-3 rounded-lg disabled:bg-gray-400 flex items-center justify-center">
                    {loading ? <Spinner /> : (editingPedido ? 'Confirmar Cambios' : 'Confirmar Pedido')}
                </button>
            </footer>
        </div>
    );
};

export default PedidoSummaryPage;