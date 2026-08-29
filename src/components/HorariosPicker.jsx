import React, { useState, useEffect } from 'react';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Parsea el JSON string de la base de datos a un objeto.
 * Si es texto viejo o vacío, devuelve un objeto vacío.
 */
const parseHorarios = (jsonString) => {
    if (!jsonString) return {};
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        // Fallback por si hay datos viejos en la DB que son texto simple
        return {};
    }
};

const HorariosPicker = ({ value, onChange, label = "Horario", hint = "" }) => {
    // horarios es un objeto: { 'Lun': '09:00-18:00', ... }
    const [horarios, setHorarios] = useState(parseHorarios(value));
    const [lastGlobalHorario, setLastGlobalHorario] = useState('09:00-18:00');

    // Actualiza el componente padre cuando cambia localmente (serializando a JSON string)
    useEffect(() => {
        // Evitamos enviar si está vacío, o mandamos un JSON string
        if (Object.keys(horarios).length === 0) {
            onChange('');
        } else {
            onChange(JSON.stringify(horarios));
        }
    }, [horarios]);

    const handleCheckDia = (dia) => {
        setHorarios(prev => {
            const nuevo = { ...prev };
            if (nuevo[dia]) {
                delete nuevo[dia];
            } else {
                nuevo[dia] = lastGlobalHorario;
            }
            return nuevo;
        });
    };

    const handleHorarioChange = (dia, newVal) => {
        setHorarios(prev => ({
            ...prev,
            [dia]: newVal
        }));
        if (newVal.length > 0) {
            setLastGlobalHorario(newVal);
        }
    };

    return (
        <div className="bg-white p-3 border rounded-xl shadow-sm mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
            {hint && <p className="text-xs text-gray-500 mb-3">{hint}</p>}
            
            <div className="space-y-2">
                {DIAS.map(dia => {
                    const isChecked = !!horarios[dia];
                    return (
                        <div key={dia} className="flex items-center gap-3">
                            <label className="flex items-center gap-2 w-20 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleCheckDia(dia)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className={`text-sm font-medium ${isChecked ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {dia}
                                </span>
                            </label>
                            
                            {isChecked ? (
                                <input
                                    type="text"
                                    value={horarios[dia] || ''}
                                    onChange={(e) => handleHorarioChange(dia, e.target.value)}
                                    placeholder="Ej: 09:00-18:00"
                                    className="flex-1 p-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
                                />
                            ) : (
                                <div className="flex-1 text-sm text-gray-300 italic py-1.5">
                                    Cerrado
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default HorariosPicker;
