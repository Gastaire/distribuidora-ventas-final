import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePedidos } from '../context/PedidoContext';
import { db } from '../services/db';
import { ArrowLeftIcon, Spinner, PlusIcon } from '../components/ui';
import { generatePedidoPDF } from '../services/pdfService';

// ==========================================
// Modal de Programación de Pedido
// ==========================================
const ScheduleModal = ({ onConfirmNow, onConfirmScheduled, onClose }) => {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [selectedDate, setSelectedDate] = useState('');

    // Fecha mínima: mañana
    const minDate = (() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
    })();

    // Calcular la fecha de activación para mostrarla al vendedor
    const getActivationLabel = (dateStr) => {
        if (!dateStr) return '';
        const entrega = new Date(dateStr + 'T00:00:00-03:00');
        entrega.setDate(entrega.getDate() - 1);
        return entrega.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" onClick={onClose}>
            <div className="bg-white rounded-t-3xl w-full max-w-md p-6 pb-10" onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6"/>
                <h3 className="text-xl font-bold text-gray-800 text-center mb-6">¿Cuándo enviamos este pedido?</h3>

                {/* Opción: Enviar ahora */}
                <button
                    onClick={onConfirmNow}
                    className="w-full bg-green-500 text-white font-bold py-4 rounded-xl mb-3 flex items-center justify-center gap-3 active:bg-green-600 text-lg"
                >
                    <span>✅</span> Enviar Ahora
                </button>

                {/* Opción: Programar */}
                {!showDatePicker ? (
                    <button
                        onClick={() => setShowDatePicker(true)}
                        className="w-full bg-violet-100 text-violet-700 font-bold py-4 rounded-xl flex items-center justify-center gap-3 active:bg-violet-200 text-lg"
                    >
                        <span>📅</span> Programar para otra fecha
                    </button>
                ) : (
                    <div className="bg-violet-50 rounded-xl p-4">
                        <p className="text-sm font-semibold text-violet-700 mb-3">Elegí la fecha de entrega:</p>
                        <input
                            type="date"
                            min={minDate}
                            value={selectedDate}
                            onChange={e => setSelectedDate(e.target.value)}
                            className="w-full border-2 border-violet-300 rounded-lg p-3 text-lg font-semibold text-center focus:outline-none focus:border-violet-500 bg-white"
                        />
                        {selectedDate && (
                            <p className="text-xs text-violet-600 mt-2 text-center">
                                📬 El depósito lo verá el <strong>{getActivationLabel(selectedDate)}</strong> a las 16:30
                            </p>
                        )}
                        <button
                            onClick={() => selectedDate && onConfirmScheduled(selectedDate)}
                            disabled={!selectedDate}
                            className="w-full bg-violet-600 text-white font-bold py-3 rounded-lg mt-3 disabled:bg-gray-300 disabled:cursor-not-allowed active:bg-violet-700"
                        >
                            Confirmar Programación
                        </button>
                    </div>
                )}

                <button onClick={onClose} className="w-full text-gray-400 text-sm mt-4 py-2">
                    Cancelar
                </button>
            </div>
        </div>
    );
};

// ==========================================
// Página Principal de Resumen
// ==========================================
const PedidoSummaryPage = () => {
    const navigate = useNavigate();
    const { clienteLocalId } = useParams();
    const { openPedidos, updateCart, savePedido, editingPedido, draftNotes, updateNotes } = usePedidos();
    
    const [cliente, setCliente] = useState(null);
    const notas = draftNotes[clienteLocalId] || '';
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showScheduleModal, setShowScheduleModal] = useState(false);

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

    const executesSave = async (opciones = {}) => {
        setLoading(true);
        setShowScheduleModal(false);
        setError('');
        try {
            const result = await savePedido(cliente, cart, notas, opciones);

            // Preguntar si quiere PDF (solo para pedidos inmediatos)
            if (!opciones.fecha_entrega_programada) {
                const confirmed = window.confirm(`${result.message}\n\n¿Querés guardar una copia del pedido en PDF?`);
                if (confirmed) {
                    const pedidoParaPDF = {
                        ...(editingPedido || {}),
                        local_id: editingPedido ? editingPedido.local_id : `local_${Date.now()}`,
                        cliente_nombre_snapshot: cliente.nombre_comercio,
                        fecha: new Date().toISOString(),
                        items: cart.map(item => ({...item, ...item.producto})),
                        notas_entrega: notas
                    };
                    await generatePedidoPDF(pedidoParaPDF, { action: 'download' });
                }
            } else {
                alert(`✅ ${result.message}`);
            }

            navigate('/', { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmClick = () => {
        if (editingPedido) {
            // Al editar no ofrecemos programar, se guarda directo
            executesSave();
        } else {
            setShowScheduleModal(true);
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
                <button 
                    onClick={handleConfirmClick} 
                    disabled={loading || cart.length === 0} 
                    className="w-full bg-green-500 text-white font-bold py-3 rounded-lg disabled:bg-gray-400 flex items-center justify-center"
                >
                    {loading ? <Spinner /> : (editingPedido ? 'Confirmar Cambios' : 'Confirmar Pedido')}
                </button>
            </footer>

            {/* Modal de programación */}
            {showScheduleModal && (
                <ScheduleModal
                    onConfirmNow={() => executesSave()}
                    onConfirmScheduled={(date) => executesSave({ fecha_entrega_programada: date })}
                    onClose={() => setShowScheduleModal(false)}
                />
            )}
        </div>
    );
};

export default PedidoSummaryPage;