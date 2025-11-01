import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/db';
import { ArrowLeftIcon, Spinner } from '../components/ui';
import { createCliente, updateCliente } from '../services/api'; 
import { useAuth } from '../context/AuthContext';

const ClienteFormPage = () => {
    const navigate = useNavigate();
    const { localId } = useParams(); // Obtenemos el ID de la URL si estamos editando
    const { token } = useAuth();

    const [formData, setFormData] = useState({
        nombre_comercio: '', nombre_contacto: '', direccion: '', telefono: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isEditing = !!localId;

    useEffect(() => {
        if (isEditing) {
            setLoading(true);
            db.clientes.get(localId).then(cliente => {
                if (cliente) {
                    setFormData(cliente);
                } else {
                    setError('Cliente no encontrado localmente.');
                }
                setLoading(false);
            });
        }
    }, [localId, isEditing]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.nombre_comercio.trim()) {
            setError('El nombre del comercio es obligatorio.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            if (isEditing) {
                // Lógica de edición
                await updateCliente(formData, token);
                await db.clientes.update(localId, { ...formData, status: 'synced' });
            } else {
                // Lógica de creación
                const newCliente = {
                    ...formData,
                    local_id: `local_${Date.now()}`,
                    status: 'pending_sync'
                };
                const createdCliente = await createCliente(newCliente, token);
                await db.clientes.put({ ...newCliente, id: createdCliente.id, status: 'synced' });
            }
            navigate('/clientes', { replace: true }); // Usamos replace para no añadir al historial
        } catch (err) {
            setError(err.message);
            // Fallback: guardar localmente si falla la API
            if (!isEditing) {
                await db.clientes.add({ ...formData, local_id: `local_${Date.now()}`, status: 'pending_sync' });
                navigate('/clientes', { replace: true });
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing) {
        return <div className="flex h-screen items-center justify-center"><Spinner className="border-blue-600 h-10 w-10"/></div>;
    }

    return (
        <div className="bg-gray-100 min-h-screen">
            <header className="bg-white p-4 shadow-md sticky top-0 flex items-center gap-4 z-10">
                <button onClick={() => navigate('/clientes')} className="text-blue-600" aria-label="Volver">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <h2 className="font-bold text-lg">{isEditing ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
            </header>
            <main className="p-4">
                <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow">
                    <div>
                        <label htmlFor="nombre_comercio" className="text-sm font-medium text-gray-700">Nombre del Comercio</label>
                        <input id="nombre_comercio" type="text" name="nombre_comercio" value={formData.nombre_comercio} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" required />
                    </div>
                    <div>
                        <label htmlFor="nombre_contacto" className="text-sm font-medium text-gray-700">Nombre del Contacto</label>
                        <input id="nombre_contacto" type="text" name="nombre_contacto" value={formData.nombre_contacto} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" />
                    </div>
                    <div>
                        <label htmlFor="direccion" className="text-sm font-medium text-gray-700">Dirección</label>
                        <input id="direccion" type="text" name="direccion" value={formData.direccion} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" />
                    </div>
                    <div>
                        <label htmlFor="telefono" className="text-sm font-medium text-gray-700">Teléfono</label>
                        <input id="telefono" type="tel" name="telefono" value={formData.telefono} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" />
                    </div>
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-4 flex items-center justify-center disabled:bg-blue-400">
                        {loading ? <Spinner /> : 'Guardar Cliente'}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default ClienteFormPage;