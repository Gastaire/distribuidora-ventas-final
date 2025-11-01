import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ArrowLeftIcon, PlusIcon, SearchIcon, Spinner, EditIcon } from '../components/ui';

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

const ClientesPage = () => {
    const navigate = useNavigate();
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
    }, []);

    const filteredClientes = clientes.filter(c =>
        c.nombre_comercio.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                <button onClick={() => navigate('/clientes/nuevo')} className="p-2 bg-blue-600 text-white rounded-full flex-shrink-0" aria-label="Añadir nuevo cliente">
                    <PlusIcon className="h-6 w-6" />
                </button>
            </header>
            <main className="p-4">
                {loading && <div className="text-center py-10"><Spinner className="border-blue-600 h-8 w-8 mx-auto" /></div>}
                {!loading && filteredClientes.length > 0 ? (
                    <div className="space-y-3">
                        {filteredClientes.map(cliente => (
                            <div key={cliente.local_id} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/pedidos/nuevo/${cliente.local_id}`)}>
                                    <p className="font-bold text-gray-800">{cliente.nombre_comercio}</p>
                                    <p className="text-sm text-gray-600">{cliente.direccion}</p>
                                    <StatusBadge status={cliente.status} />
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); navigate(`/clientes/editar/${cliente.local_id}`); }} className="p-2 text-gray-500 hover:text-blue-600" title="Editar cliente">
                                    <EditIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    !loading && <p className="text-center text-gray-500 mt-8">No se encontraron clientes.</p>
                )}
            </main>
        </div>
    );
};

export default ClientesPage;