import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/db';
import { ArrowLeftIcon, Spinner } from '../components/ui';
import { createCliente, updateCliente } from '../services/api'; 
import { useAuth } from '../context/AuthContext';

import LocationPicker from '../components/LocationPicker';
import HorariosPicker from '../components/HorariosPicker';

const ClienteFormPage = () => {
    const navigate = useNavigate();
    const { localId } = useParams(); // Obtenemos el ID de la URL si estamos editando
    const { token, user } = useAuth();

    const [formData, setFormData] = useState({
        nombre_comercio: '', nombre_contacto: '', direccion: '', telefono: '',
        latitud: null, longitud: null, horario_atencion: '', horario_entrega: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState('');
    const [mapVisible, setMapVisible] = useState(false);
    const [showEntrega, setShowEntrega] = useState(false);
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

    const handleGetGPS = () => {
        if (!navigator.geolocation) {
            setGpsError('Tu navegador no soporta geolocalización.');
            return;
        }
        setGpsLoading(true);
        setGpsError('');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setFormData(prev => ({
                    ...prev,
                    latitud: position.coords.latitude,
                    longitud: position.coords.longitude,
                }));
                setMapVisible(true);
                setGpsLoading(false);
            },
            (err) => {
                setGpsError('No se pudo obtener ubicación. Verificá que el GPS esté habilitado.');
                setGpsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
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
                    status: 'pending_sync',
                    vendedor_id: user?.id || null,
                    vendedor_nombre: user?.nombre || null
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
                        <label htmlFor="direccion" className="text-sm font-medium text-gray-700">Detalles / Referencias</label>
                        <input id="direccion" type="text" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Ej: Al lado de la barbería, portón negro..." className="w-full p-2 border rounded-lg mt-1" />
                    </div>
                    <div>
                        <label htmlFor="telefono" className="text-sm font-medium text-gray-700">Teléfono</label>
                        <input id="telefono" type="tel" name="telefono" value={formData.telefono} onChange={handleChange} className="w-full p-2 border rounded-lg mt-1" />
                    </div>

                    {/* Sección de ubicación */}
                    <div className="border-t pt-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">📍 Ubicación del cliente</p>
                        
                        {formData.latitud && formData.longitud ? (
                            <div className="mb-2 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center justify-between">
                                <span className="text-xs text-green-700 font-medium">
                                    ✓ Ubicación guardada ({formData.latitud.toFixed(5)}, {formData.longitud.toFixed(5)})
                                </span>
                                <button type="button" onClick={() => setMapVisible(v => !v)}
                                    className="text-xs text-blue-600 font-medium">
                                    {mapVisible ? 'Ocultar mapa' : 'Ajustar'}
                                </button>
                            </div>
                        ) : null}
                        
                        {mapVisible && (
                            <div className="mb-3">
                                <LocationPicker
                                    lat={formData.latitud}
                                    lng={formData.longitud}
                                    onChange={(lat, lng) => setFormData(prev => ({ ...prev, latitud: lat, longitud: lng }))}
                                />
                            </div>
                        )}
                        
                        <button
                            type="button"
                            onClick={handleGetGPS}
                            disabled={gpsLoading}
                            className="w-full border-2 border-blue-300 text-blue-600 font-semibold py-2 rounded-lg flex items-center justify-center gap-2 active:bg-blue-50"
                        >
                            {gpsLoading ? <Spinner /> : '📍'}
                            {gpsLoading ? 'Obteniendo...' : (formData.latitud ? 'Actualizar mi ubicación actual' : 'Usar mi ubicación actual (GPS)')}
                        </button>
                        {gpsError && <p className="text-red-500 text-xs mt-1">{gpsError}</p>}
                    </div>

                    {/* Horarios */}
                    <div className="border-t pt-4">
                        <p className="text-sm font-semibold text-gray-700 mb-2">🕐 Horarios del comercio</p>
                        
                        <HorariosPicker 
                            label="Horario de atención" 
                            hint="Seleccioná los días y el rango de horas."
                            value={formData.horario_atencion}
                            onChange={(val) => setFormData(prev => ({ ...prev, horario_atencion: val }))}
                        />

                        {!showEntrega && (
                            <button 
                                type="button" 
                                onClick={() => setShowEntrega(true)}
                                className="text-blue-600 text-sm font-medium mt-2 mb-4 block"
                            >
                                + Agregar horario especial de recepción de pedidos
                            </button>
                        )}
                        {showEntrega && (
                            <HorariosPicker 
                                label="Horario de recepción de pedidos" 
                                hint="Solo si difiere del horario de atención."
                                value={formData.horario_entrega}
                                onChange={(val) => setFormData(prev => ({ ...prev, horario_entrega: val }))}
                            />
                        )}
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