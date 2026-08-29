import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { useAuth } from '../context/AuthContext';
import LocationPicker from './LocationPicker';
import { Spinner } from './ui';
import { updateCliente } from '../services/api';

const FaltantesModal = ({ cliente, onComplete, onCancel }) => {
    const { user, token } = useAuth();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    
    const [formData, setFormData] = useState({
        latitud: cliente.latitud || null,
        longitud: cliente.longitud || null,
        horario_atencion: cliente.horario_atencion || '',
        horario_entrega: cliente.horario_entrega || '',
        vendedor_id: cliente.vendedor_id || null,
        vendedor_nombre: cliente.vendedor_nombre || ''
    });

    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState('');
    const [showEntrega, setShowEntrega] = useState(false);

    // Determinar qué pasos faltan
    const needsLocation = !cliente.latitud || !cliente.longitud;
    const needsHorarios = !cliente.horario_atencion;
    const needsVendedor = !cliente.vendedor_id;

    const steps = [];
    if (needsLocation) steps.push('location');
    if (needsHorarios) steps.push('horarios');
    if (needsVendedor) steps.push('vendedor');

    useEffect(() => {
        // Si no falta nada, completamos inmediatamente (aunque no deberíamos haber llegado aquí)
        if (steps.length === 0) {
            onComplete();
        }
    }, [steps.length, onComplete]);

    const handleNext = async () => {
        if (step < steps.length - 1) {
            setStep(step + 1);
        } else {
            // Guardar cambios
            setLoading(true);
            try {
                const updatedCliente = { ...cliente, ...formData };
                
                // Si el cliente ya está en la BD remota, lo actualizamos por API
                if (updatedCliente.id) {
                    await updateCliente(updatedCliente, token);
                    await db.clientes.update(cliente.local_id, { ...updatedCliente, status: 'synced' });
                } else {
                    // Solo actualizamos local, se sincronizará luego
                    await db.clientes.update(cliente.local_id, { ...updatedCliente, status: 'pending_sync' });
                }
                
                onComplete();
            } catch (err) {
                console.error("Error guardando datos faltantes:", err);
                // Si falla la API, guardamos localmente
                const updatedCliente = { ...cliente, ...formData, status: 'pending_sync' };
                await db.clientes.update(cliente.local_id, updatedCliente);
                onComplete();
            } finally {
                setLoading(false);
            }
        }
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
                setGpsLoading(false);
            },
            (err) => {
                setGpsError('No se pudo obtener ubicación. Verificá que el GPS esté habilitado.');
                setGpsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const currentStep = steps[step];

    if (steps.length === 0) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
                <div className="mb-4 text-center">
                    <h3 className="text-xl font-bold text-gray-800">Faltan datos de {cliente.nombre_comercio}</h3>
                    <p className="text-sm text-gray-500 mt-1">Paso {step + 1} de {steps.length}</p>
                </div>

                {currentStep === 'location' && (
                    <div className="space-y-4">
                        <p className="font-semibold text-gray-700">📍 Necesitamos la ubicación de este cliente</p>
                        <LocationPicker 
                            lat={formData.latitud} 
                            lng={formData.longitud} 
                            onChange={(lat, lng) => setFormData(prev => ({ ...prev, latitud: lat, longitud: lng }))}
                        />
                        <button
                            type="button"
                            onClick={handleGetGPS}
                            disabled={gpsLoading}
                            className="w-full border-2 border-blue-300 text-blue-600 font-semibold py-2 rounded-lg flex items-center justify-center gap-2 active:bg-blue-50"
                        >
                            {gpsLoading ? <Spinner /> : '📍'}
                            {gpsLoading ? 'Obteniendo ubicación...' : (formData.latitud ? 'Actualizar a mi ubicación actual' : 'Usar mi ubicación actual (GPS)')}
                        </button>
                        {gpsError && <p className="text-red-500 text-xs text-center">{gpsError}</p>}
                    </div>
                )}

                {currentStep === 'horarios' && (
                    <div className="space-y-4">
                        <p className="font-semibold text-gray-700">🕐 Horarios del comercio</p>
                        <div>
                            <label className="text-sm font-medium text-gray-600">Horario de atención</label>
                            <input
                                type="text"
                                value={formData.horario_atencion}
                                onChange={(e) => setFormData(prev => ({ ...prev, horario_atencion: e.target.value }))}
                                placeholder="Ej: Lun-Vie 09:00-18:00"
                                className="w-full p-2 border rounded-lg mt-1"
                            />
                        </div>
                        {!showEntrega && (
                            <button 
                                type="button" 
                                onClick={() => setShowEntrega(true)}
                                className="text-blue-600 text-sm font-medium"
                            >
                                + Agregar horario especial de recepción de pedidos
                            </button>
                        )}
                        {showEntrega && (
                            <div className="mt-3 bg-gray-50 p-3 rounded-lg border">
                                <label className="text-sm font-medium text-gray-600">Horario de recepción</label>
                                <p className="text-xs text-gray-400 mb-2">Solo si es distinto al de atención</p>
                                <input
                                    type="text"
                                    value={formData.horario_entrega}
                                    onChange={(e) => setFormData(prev => ({ ...prev, horario_entrega: e.target.value }))}
                                    placeholder="Ej: Lun-Vie 10:00-16:00"
                                    className="w-full p-2 border rounded-lg"
                                />
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 'vendedor' && (
                    <div className="space-y-4 text-center py-4">
                        <p className="font-semibold text-gray-700 text-lg">👤 ¿A quién pertenece este cliente?</p>
                        <p className="text-sm text-gray-500">No hay un vendedor asignado a {cliente.nombre_comercio}.</p>
                        <div className="flex flex-col gap-3 mt-6">
                            <button 
                                onClick={() => {
                                    setFormData(prev => ({ ...prev, vendedor_id: user.id, vendedor_nombre: user.nombre }));
                                    // Hacky but simple logic: when clicked, we simulate "next" in next tick
                                    setTimeout(() => handleNext(), 50);
                                }}
                                className="bg-blue-600 text-white font-bold py-3 rounded-lg"
                            >
                                Es mío ({user.nombre})
                            </button>
                            <button 
                                onClick={() => {
                                    setFormData(prev => ({ ...prev, vendedor_id: null, vendedor_nombre: 'Otro / Sin Asignar' }));
                                    setTimeout(() => handleNext(), 50);
                                }}
                                className="bg-gray-200 text-gray-800 font-bold py-3 rounded-lg"
                            >
                                Es de otro vendedor
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-6 flex gap-3">
                    <button 
                        onClick={onCancel}
                        disabled={loading}
                        className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-lg disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    {currentStep !== 'vendedor' && (
                        <button 
                            onClick={handleNext}
                            disabled={loading || (currentStep === 'location' && !formData.latitud)}
                            className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-blue-400 flex items-center justify-center"
                        >
                            {loading ? <Spinner /> : (step === steps.length - 1 ? 'Guardar y Continuar' : 'Siguiente')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FaltantesModal;
