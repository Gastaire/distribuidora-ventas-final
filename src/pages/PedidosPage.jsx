import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { useSync } from '../context/SyncContext';
import { usePedidos } from '../context/PedidoContext'; // Importamos el contexto de pedidos
import { ArrowLeftIcon, SyncIcon, Spinner, EditIcon, EyeIcon, TrashIcon } from '../components/ui';

const StatusBadge = ({ status }) => {
    const styles = {
        pending_sync: { text: 'Pendiente', bg: 'bg-yellow-100', textColor: 'text-yellow-800' },
        synced: { text: 'Sincronizado', bg: 'bg-green-100', textColor: 'text-green-800' },
        sync_failed: { text: 'Falló', bg: 'bg-red-100', textColor: 'text-red-800' },
    };
    const style = styles[status] || { text: status, bg: 'bg-gray-100', textColor: 'text-gray-800' };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style.bg} ${style.textColor}`}>{style.text}</span>;
};

const PedidosPage = () => {
    const navigate = useNavigate();
    const { isSyncing, runSync } = useSync();
    const { loadPedidoForEdit } = usePedidos(); // Obtenemos la función para editar
    const [pedidos, setPedidos] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPedidos = async () => {
            setLoading(true);
            const data = await db.pedidos.orderBy('fecha').reverse().toArray();
            setPedidos(data);
            setLoading(false);
        };
        fetchPedidos();
    }, [isSyncing]);

    const handleDelete = async (localId) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este pedido local? Esta acción no se puede deshacer.')) {
            await db.pedidos.delete(localId);
            setPedidos(prev => prev.filter(p => p.local_id !== localId));
        }
    };

    const handleEdit = async (pedido) => {
        const success = await loadPedidoForEdit(pedido);
        if (success) {
            navigate(`/pedidos/editar/${pedido.local_id}`);
        } else {
            alert('No se pudo cargar el pedido para editar.');
        }
    };

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white p-4 shadow-md sticky top-0 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-blue-600"><ArrowLeftIcon className="h-6 w-6" /></button>
                    <h2 className="font-bold text-lg">Pedidos Guardados</h2>
                </div>
                <button onClick={runSync} disabled={isSyncing} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:bg-gray-400">
                    {isSyncing ? <Spinner /> : <SyncIcon className="h-5 w-5" />}
                    Sincronizar
                </button>
            </header>
            <main className="p-4">
                {loading && <div className="text-center py-10"><Spinner className="border-blue-600 h-8 w-8 mx-auto" /></div>}
                {!loading && pedidos.map(p => {
                    const isBlocked = p.status !== 'synced' && !p.cliente_id;
                    return (
                        <div key={p.local_id} className="bg-white p-4 rounded-lg shadow mb-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-gray-800">{p.cliente_nombre_snapshot || 'Cliente Desconocido'}</p>
                                    <p className="text-sm text-gray-600">{p.items?.length || 0} items</p>
                                    <p className="text-xs text-gray-400">Creado: {new Date(p.fecha).toLocaleString()}</p>
                                    <StatusBadge status={p.status} />
                                </div>
                                <div className="flex gap-1 flex-shrink-0">
                                    <button title="Ver" className="p-2 text-gray-400 hover:text-blue-600"><EyeIcon className="h-5 w-5"/></button>
                                    {p.status !== 'synced' && (
                                        <>
                                            {/* El botón de editar ahora llama a handleEdit */}
                                            <button onClick={() => handleEdit(p)} title="Editar" className="p-2 text-gray-400 hover:text-green-600"><EditIcon className="h-5 w-5"/></button>
                                            <button onClick={() => handleDelete(p.local_id)} title="Eliminar" className="p-2 text-gray-400 hover:text-red-600"><TrashIcon className="h-5 w-5"/></button>
                                        </>
                                    )}
                                </div>
                            </div>
                            {isBlocked && (
                                <div className="mt-2 text-xs font-semibold text-orange-600 bg-orange-100 p-2 rounded-lg">
                                    Este pedido está esperando que su cliente se sincronice primero.
                                </div>
                            )}
                        </div>
                    );
                })}
                 {!loading && pedidos.length === 0 && <p className="text-center text-gray-500 mt-8">No hay pedidos guardados.</p>}
            </main>
        </div>
    );
};

export default PedidosPage;