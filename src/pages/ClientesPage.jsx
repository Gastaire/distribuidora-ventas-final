import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ArrowLeftIcon, PlusIcon, SearchIcon, Spinner, EditIcon, ShoppingCartIcon } from '../components/ui';
import { usePedidos } from '../context/PedidoContext';
import { useAuth } from '../context/AuthContext';
import FaltantesModal from '../components/FaltantesModal';

const StatusBadge = ({ status }) => {
    const styles = {
        pending_sync: { text: 'Pendiente', bg: 'bg-yellow-100', textColor: 'text-yellow-800' },
        synced: { text: 'Sincronizado', bg: 'bg-green-100', textColor: 'text-green-800' },
        sync_failed: { text: 'Falló', bg: 'bg-red-100', textColor: 'text-red-800' },
    };
    const style = styles[status] || { text: 'Local', bg: 'bg-gray-100', textColor: 'text-gray-800' };
    return (
        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${style.bg} ${style.textColor}`}>
            {style.text}
        </span>
    );
};

const ZONA_COLORS = {
    'Tucumán Capital': { bg: 'rgba(99,102,241,0.15)', text: '#4338ca' },
    'Lules':            { bg: 'rgba(59,130,246,0.15)', text: '#1d4ed8' },
    'La Reducción':    { bg: 'rgba(34,197,94,0.15)',  text: '#15803d' },
    'Famaillá':        { bg: 'rgba(234,179,8,0.15)',  text: '#a16207' },
    'Leales':           { bg: 'rgba(168,85,247,0.15)', text: '#7e22ce' },
    'Bella Vista':      { bg: 'rgba(236,72,153,0.15)', text: '#be185d' },
    'San Pablo':        { bg: 'rgba(249,115,22,0.15)', text: '#c2410c' },
    'Otra':             { bg: 'rgba(156,163,175,0.15)', text: '#4b5563' },
};

const ZonaChip = ({ zona }) => {
    if (!zona) return null;
    const colors = ZONA_COLORS[zona] || ZONA_COLORS['Otra'];
    return (
        <span
            style={{ backgroundColor: colors.bg, color: colors.text }}
            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        >
            📍 {zona}
        </span>
    );
};

const ClientesPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { openPedidos } = usePedidos();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [zonaFilter, setZonaFilter] = useState(''); // filtro por zona
    
    // Modal state
    const [selectedClientForOrder, setSelectedClientForOrder] = useState(null);

    useEffect(() => {
        const fetchClientes = async () => {
            setLoading(true);
            try {
                const data = await db.clientes.orderBy('nombre_comercio').toArray();
                setClientes(data);
            } catch (error) {
                console.error("Error al cargar clientes desde Dexie:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClientes();
    }, [selectedClientForOrder]); // Reload if we close modal to show new icons

    const filteredClientes = clientes.filter(c => {
        const matchesSearch = c.nombre_comercio.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesZona = !zonaFilter || c.zona === zonaFilter;
        return matchesSearch && matchesZona;
    });

    // Lista de zonas presentes en los clientes para el dropdown
    const zonasPresentes = [...new Set(clientes.map(c => c.zona).filter(Boolean))].sort();

    const handleClientClick = (cliente) => {
        if (cliente.vendedor_id && user && cliente.vendedor_id != user.id) {
            const confirmed = window.confirm(`ATENCIÓN: Este cliente pertenece al vendedor ${cliente.vendedor_nombre || 'otro vendedor'}.\n\n¿Estás seguro que querés tomarle un pedido?`);
            if (!confirmed) return;
        }

        const needsData = !cliente.latitud || !cliente.longitud || !cliente.horario_atencion || !cliente.vendedor_id;
        if (needsData) {
            setSelectedClientForOrder(cliente);
        } else {
            navigate(`/pedidos/nuevo/${cliente.local_id}`);
        }
    };

    const handleModalComplete = () => {
        const localId = selectedClientForOrder.local_id;
        setSelectedClientForOrder(null);
        navigate(`/pedidos/nuevo/${localId}`);
    };

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white p-4 shadow-md sticky top-0 flex items-center gap-4 z-10">
                <button onClick={() => navigate('/')} className="text-blue-600" aria-label="Volver">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <div className="relative flex-1">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="search"
                        placeholder="Buscar cliente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                {/* Filtro por zona */}
                {zonasPresentes.length > 0 && (
                    <select
                        value={zonaFilter}
                        onChange={e => setZonaFilter(e.target.value)}
                        className="py-2 px-2 rounded-lg bg-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[130px]"
                    >
                        <option value="">Todas</option>
                        {zonasPresentes.map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                )}
                <button onClick={() => navigate('/clientes/nuevo')} className="p-2 bg-blue-600 text-white rounded-full flex-shrink-0" aria-label="Añadir nuevo cliente">
                    <PlusIcon className="h-6 w-6" />
                </button>
            </header>
            <main className="p-4">
                {loading && <div className="text-center py-10"><Spinner className="border-blue-600 h-8 w-8 mx-auto" /></div>}
                {!loading && filteredClientes.length > 0 ? (
                    <div className="space-y-3">
                        {filteredClientes.map(cliente => {
                            const tienePedidoAbierto = openPedidos[cliente.local_id] && openPedidos[cliente.local_id].length > 0;
                            return (
                                <div key={cliente.local_id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                                    <div className="flex-1 cursor-pointer" onClick={() => handleClientClick(cliente)}>
                                        <div className="flex items-center gap-2">
                                            {tienePedidoAbierto && <ShoppingCartIcon className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                                            <p className="font-bold text-gray-800 truncate">{cliente.nombre_comercio}</p>
                                        </div>
                                        {cliente.vendedor_nombre && (
                                            <p className="text-xs text-gray-400 pl-7 mt-0.5">Vendedor: {cliente.vendedor_nombre}</p>
                                        )}
                                        <p className="text-sm text-gray-600 pl-7 mt-0.5">{cliente.direccion || 'Sin dirección'}</p>
                                        <div className="pl-7 mt-1.5 flex items-center gap-2 flex-wrap">
                                            <StatusBadge status={cliente.status} />
                                            {(cliente.latitud && cliente.longitud) && (
                                                <span className="inline-block bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full">📍 GPS</span>
                                            )}
                                            <ZonaChip zona={cliente.zona} />
                                        </div>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); navigate(`/clientes/editar/${cliente.local_id}`); }} className="p-2 text-gray-500 hover:text-blue-600" title="Editar cliente">
                                        <EditIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    !loading && <p className="text-center text-gray-500 mt-8">No se encontraron clientes.</p>
                )}
            </main>
            {selectedClientForOrder && (
                <FaltantesModal 
                    cliente={selectedClientForOrder} 
                    onComplete={handleModalComplete} 
                    onCancel={() => setSelectedClientForOrder(null)} 
                />
            )}
        </div>
    );
};

export default ClientesPage;