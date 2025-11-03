import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { generatePedidoPDF } from '../services/pdfService';
import { ArrowLeftIcon, ShareIcon, Spinner } from '../components/ui';

const formatPrice = (price) => {
    const numPrice = Number(price);
    if (isNaN(numPrice)) return '$0';
    return numPrice % 1 === 0 ? `$${numPrice}` : `$${numPrice.toFixed(2)}`;
};

const StatusBadge = ({ status }) => {
    const styles = {
        pending_sync: { text: 'Pendiente de Sync', bg: 'bg-yellow-100', textColor: 'text-yellow-800' },
        sync_failed: { text: 'Sync Falló', bg: 'bg-red-100', textColor: 'text-red-800' },
        synced: { text: 'Sincronizado', bg: 'bg-green-100', textColor: 'text-green-800' },
        pendiente: { text: 'Pendiente', bg: 'bg-blue-100', textColor: 'text-blue-800' },
        visto: { text: 'Visto', bg: 'bg-gray-200', textColor: 'text-gray-800' },
        en_preparacion: { text: 'En Preparación', bg: 'bg-indigo-100', textColor: 'text-indigo-800' },
        listo_para_entrega: { text: 'Listo para Entrega', bg: 'bg-purple-100', textColor: 'text-purple-800' },
        entregado: { text: 'Entregado', bg: 'bg-green-200', textColor: 'text-green-900' },
        cancelado: { text: 'Cancelado', bg: 'bg-red-200', textColor: 'text-red-900' },
    };
    const style = styles[status] || { text: status, bg: 'bg-gray-100', textColor: 'text-gray-800' };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style.bg} ${style.textColor}`}>{style.text}</span>;
};

const PedidoDetailPage = () => {
    const { pedidoId } = useParams();
    const navigate = useNavigate();
    const [pedido, setPedido] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPedido = async () => {
            setLoading(true);
            let pedidoData = await db.pedidos.get(pedidoId); // Probar por local_id
            if (!pedidoData) {
                 // Si no, buscar por id de servidor (casteado a número si es necesario)
                pedidoData = await db.pedidos.where('id').equals(Number(pedidoId)).first();
            }

            if (pedidoData) {
                setPedido(pedidoData);
            }
            setLoading(false);
        };
        fetchPedido();
    }, [pedidoId]);

    const handleShare = () => {
        if (pedido) {
            generatePedidoPDF(pedido, { action: 'share' });
        }
    };

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Spinner className="border-blue-600 h-10 w-10"/></div>;
    }

    if (!pedido) {
        return (
            <div className="text-center mt-20">
                <p>Pedido no encontrado.</p>
                <button onClick={() => navigate('/pedidos')} className="text-blue-600 mt-4">Volver a Pedidos</button>
            </div>
        );
    }

    const totalPedido = (pedido.items || []).reduce((acc, item) => acc + (item.precio_congelado * item.cantidad), 0);
    const statusToShow = pedido.status === 'synced' ? pedido.estado : pedido.status;

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="bg-white p-4 shadow-md sticky top-0 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="text-blue-600" aria-label="Volver">
                        <ArrowLeftIcon className="h-6 w-6" />
                    </button>
                    <div>
                        <h2 className="font-bold text-lg">Detalle de Pedido</h2>
                        <p className="text-xs text-gray-500">{pedido.cliente_nombre_snapshot}</p>
                    </div>
                </div>
                <button onClick={handleShare} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" aria-label="Compartir PDF">
                    <ShareIcon className="h-6 w-6" />
                </button>
            </header>
            <main className="flex-1 overflow-y-auto p-4">
                <div className="bg-white p-4 rounded-lg shadow mb-4">
                    <p><strong>Fecha:</strong> {new Date(pedido.fecha).toLocaleString()}</p>
                    <p><strong>Estado:</strong> <StatusBadge status={statusToShow} /></p>
                    <p><strong>Total:</strong> <span className="font-bold text-lg">{formatPrice(totalPedido)}</span></p>
                </div>

                <h3 className="font-bold text-gray-800 mb-2">Items del Pedido</h3>
                {pedido.items.map((item, index) => (
                    <div key={index} className="bg-white p-3 rounded-lg shadow mb-2">
                        <p className="font-semibold">{item.nombre_producto}</p>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">{item.cantidad} x {formatPrice(item.precio_congelado)}</span>
                            <span className="font-bold">{formatPrice(item.cantidad * item.precio_congelado)}</span>
                        </div>
                    </div>
                ))}

                {pedido.notas_entrega && (
                    <div className="mt-4 bg-white p-4 rounded-lg shadow">
                        <h3 className="font-bold text-gray-800 mb-1">Notas</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{pedido.notas_entrega}</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PedidoDetailPage;