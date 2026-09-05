import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { useSync } from '../context/SyncContext';
import { usePedidos } from '../context/PedidoContext';
import { ArrowLeftIcon, SyncIcon, Spinner, EditIcon, EyeIcon, TrashIcon, HistoryIcon, ShoppingCartIcon } from '../components/ui';

const StatusBadge = ({ status }) => {
    const styles = {
        pending_sync: { text: 'Pendiente de Sync', bg: 'bg-yellow-100', textColor: 'text-yellow-800' },
        sync_failed: { text: 'Sync Falló', bg: 'bg-red-100', textColor: 'text-red-800' },
        synced: { text: 'Sincronizado', bg: 'bg-green-100', textColor: 'text-green-800' },
        pendiente: { text: 'Pendiente', bg: 'bg-blue-100', textColor: 'text-blue-800' },
        programado: { text: 'Programado', bg: 'bg-violet-100', textColor: 'text-violet-800' },
        visto: { text: 'Visto', bg: 'bg-gray-200', textColor: 'text-gray-800' },
        en_preparacion: { text: 'En Preparación', bg: 'bg-indigo-100', textColor: 'text-indigo-800' },
        listo_para_entrega: { text: 'Listo para Entrega', bg: 'bg-purple-100', textColor: 'text-purple-800' },
        entregado: { text: 'Entregado', bg: 'bg-green-200', textColor: 'text-green-900' },
        cancelado: { text: 'Cancelado', bg: 'bg-red-200', textColor: 'text-red-900' },
    };
    const style = styles[status] || { text: status, bg: 'bg-gray-100', textColor: 'text-gray-800' };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style.bg} ${style.textColor}`}>{style.text}</span>;
};

/** Formatea una fecha local yyyy-mm-dd a dd/mm/yyyy */
const fmtFecha = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
};

/** Verifica si un pedido programado todavía es editable (fecha_activacion no llegó) */
const esEditable = (pedido) => {
    if (pedido.estado !== 'programado') {
        return pedido.status === 'pending_sync' || pedido.estado === 'pendiente';
    }
    if (!pedido.fecha_activacion) return true;
    return new Date(pedido.fecha_activacion) > new Date();
};

const PedidosPage = () => {
    const navigate = useNavigate();
    const { isSyncing, runSync, isFetchingHistory, fetchPedidosHistoricos } = useSync();
    const { loadPedidoForEdit, discardCart } = usePedidos();
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('activos'); // 'activos' | 'programados'

    const fetchLocalPedidos = async () => {
        setLoading(true);
        const data = await db.pedidos.orderBy('fecha').reverse().toArray();
        setPedidos(data);
        setLoading(false);
    };
    
    useEffect(() => {
        fetchLocalPedidos();
    }, [isSyncing]);

    const handleFetchHistory = async () => {
        const result = await fetchPedidosHistoricos();
        if (result.success) {
            alert(`${result.count} pedidos históricos fueron cargados.`);
            fetchLocalPedidos();
        } else {
            alert(`Error al cargar el historial: ${result.message}`);
        }
    };

    const handleDelete = async (localId, clienteLocalId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este pedido local? Esta acción no se puede deshacer.')) {
            await db.pedidos.delete(localId);
            discardCart(clienteLocalId);
            setPedidos(prev => prev.filter(p => p.local_id !== localId));
        }
    };

    const handleEdit = async (pedido) => {
        if (!esEditable(pedido)) {
            alert(pedido.estado === 'programado' 
                ? 'Este pedido ya fue enviado al depósito y no se puede editar.'
                : `No se puede editar un pedido con estado "${pedido.estado}".`
            );
            return;
        }
        const success = await loadPedidoForEdit(pedido);
        if (success) {
            navigate(`/pedidos/editar/${pedido.local_id}`);
        } else {
            alert('No se pudo cargar el pedido para editar.');
        }
    };

    const handleView = (pedido) => {
        const idParaNavegar = pedido.id || pedido.local_id;
        navigate(`/pedidos/detalle/${idParaNavegar}`);
    };

    // Separar pedidos activos y programados
    const pedidosActivos = pedidos.filter(p => p.estado !== 'programado');
    const pedidosProgramados = pedidos.filter(p => p.estado === 'programado');
    const listaActual = activeTab === 'activos' ? pedidosActivos : pedidosProgramados;

    const renderPedido = (p) => {
        const statusToShow = p.status === 'synced' ? p.estado : p.status;
        const puedeEditar = esEditable(p);
        const esProgramado = p.estado === 'programado';

        return (
            <div key={p.local_id || p.id} className="bg-white p-4 rounded-lg shadow mb-3">
                {esProgramado && (
                    <div className="flex items-center gap-1.5 mb-2 text-violet-700 bg-violet-50 rounded-lg px-3 py-1.5 text-sm">
                        <span>📅</span>
                        <span className="font-medium">
                            Entrega: {fmtFecha(p.fecha_entrega_programada)}
                        </span>
                        <span className="ml-auto text-xs text-violet-500">
                            Se envía al depósito el {p.fecha_activacion ? fmtFecha(new Date(p.fecha_activacion).toISOString()) : '—'} a las 16:30
                        </span>
                    </div>
                )}
                <div className="flex justify-between items-start">
                    <div>
                        <p className="font-bold text-gray-800">{p.cliente_nombre_snapshot || 'Cliente Desconocido'}</p>
                        <p className="text-sm text-gray-600">{p.items?.length || 0} items</p>
                        <p className="text-xs text-gray-400">Creado: {new Date(p.fecha).toLocaleString()}</p>
                        <div className="mt-1">
                            <StatusBadge status={statusToShow} />
                        </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => handleView(p)} title="Ver" className="p-2 text-gray-400 hover:text-blue-600">
                            <EyeIcon className="h-5 w-5"/>
                        </button>
                        <button 
                            onClick={() => handleEdit(p)} 
                            title={puedeEditar ? "Editar" : "No editable"} 
                            className={`p-2 ${puedeEditar ? 'text-gray-400 hover:text-green-600' : 'text-gray-200 cursor-not-allowed'}`}
                            disabled={!puedeEditar}
                        >
                            <EditIcon className="h-5 w-5"/>
                        </button>
                        {p.status !== 'synced' && (
                            <button onClick={() => handleDelete(p.local_id, p.cliente_local_id)} title="Eliminar" className="p-2 text-gray-400 hover:text-red-600">
                                <TrashIcon className="h-5 w-5"/>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white p-4 shadow-md sticky top-0 z-10">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="text-blue-600"><ArrowLeftIcon className="h-6 w-6" /></button>
                        <h2 className="font-bold text-lg">Pedidos Guardados</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={handleFetchHistory} disabled={isFetchingHistory || isSyncing} className="p-2 text-gray-500 hover:text-blue-600 disabled:text-gray-300" aria-label="Ver historial de pedidos">
                            {isFetchingHistory ? <Spinner className="border-blue-600"/> : <HistoryIcon className="h-6 w-6" />}
                        </button>
                        <button onClick={runSync} disabled={isSyncing || isFetchingHistory} className="bg-blue-600 text-white font-bold py-2 px-3 rounded-lg flex items-center gap-2 disabled:bg-gray-400">
                            {isSyncing ? <Spinner /> : <SyncIcon className="h-5 w-5" />}
                            Sync
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('activos')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'activos' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        Activos ({pedidosActivos.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('programados')}
                        className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'programados' ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                        📅 Programados ({pedidosProgramados.length})
                    </button>
                </div>
            </header>

            <main className="p-4">
                {loading && <div className="text-center py-10"><Spinner className="border-blue-600 h-8 w-8 mx-auto" /></div>}
                
                {!loading && listaActual.map(p => renderPedido(p))}
                
                {!loading && listaActual.length === 0 && (
                    <div className="text-center text-gray-500 mt-8">
                        <ShoppingCartIcon className="h-12 w-12 mx-auto text-gray-400"/>
                        <p className="mt-2 font-semibold">
                            {activeTab === 'activos' ? 'No hay pedidos guardados.' : 'No hay pedidos programados.'}
                        </p>
                        {activeTab === 'activos' && (
                            <p className="text-sm mt-1">Presiona el ícono del reloj para cargar tu historial.</p>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default PedidosPage;