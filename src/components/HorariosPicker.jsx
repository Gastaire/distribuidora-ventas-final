import React, { useState, useEffect } from 'react';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

/**
 * Parsea el JSON string de la base de datos a un objeto.
 * Convierte el formato antiguo de string a array de turnos.
 */
const parseHorarios = (jsonString) => {
    if (!jsonString) return {};
    try {
        const obj = JSON.parse(jsonString);
        const migrated = {};
        for (const dia in obj) {
            const val = obj[dia];
            if (typeof val === 'string') {
                // Formato viejo: "09:00-18:00"
                const parts = val.split('-');
                migrated[dia] = [{ desde: parts[0] || '', hasta: parts[1] || '' }];
            } else if (Array.isArray(val)) {
                // Formato nuevo: [{ desde: '09:00', hasta: '13:00' }]
                migrated[dia] = val;
            }
        }
        return migrated;
    } catch (e) {
        return {};
    }
};

const HorariosPicker = ({ value, onChange, label = "Horario", hint = "" }) => {
    // horarios: { 'Lun': [{desde: '09:00', hasta: '13:00'}], ... }
    const [horarios, setHorarios] = useState(parseHorarios(value));

    // Para no empezar en blanco si agregan un día, usamos un default
    const defaultTurno = { desde: '09:00', hasta: '18:00' };

    useEffect(() => {
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
                nuevo[dia] = [{ ...defaultTurno }];
            }
            return nuevo;
        });
    };

    const handleAddTurno = (dia) => {
        setHorarios(prev => {
            const turnosDia = prev[dia] || [];
            if (turnosDia.length >= 2) return prev; // max 2 turnos
            return {
                ...prev,
                [dia]: [...turnosDia, { desde: '16:00', hasta: '20:00' }]
            };
        });
    };

    const handleRemoveTurno = (dia, index) => {
        setHorarios(prev => {
            const turnosDia = prev[dia] ? [...prev[dia]] : [];
            turnosDia.splice(index, 1);
            if (turnosDia.length === 0) {
                const nuevo = { ...prev };
                delete nuevo[dia];
                return nuevo;
            }
            return { ...prev, [dia]: turnosDia };
        });
    };

    const handleChangeTime = (dia, index, field, val) => {
        setHorarios(prev => {
            const turnosDia = prev[dia] ? [...prev[dia]] : [];
            if (turnosDia[index]) {
                turnosDia[index][field] = val;
            }
            return { ...prev, [dia]: turnosDia };
        });
    };

    return (
        <div className="bg-white p-4 border rounded-xl shadow-sm mb-3">
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
            {hint && <p className="text-xs text-gray-500 mb-4">{hint}</p>}
            
            <div className="space-y-4">
                {DIAS.map(dia => {
                    const isChecked = !!horarios[dia];
                    const turnos = horarios[dia] || [];

                    return (
                        <div key={dia} className="flex flex-col sm:flex-row sm:items-start gap-2 border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                            {/* Checkbox y Día */}
                            <label className="flex items-center gap-2 w-24 cursor-pointer pt-1">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleCheckDia(dia)}
                                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className={`text-sm font-bold ${isChecked ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {dia}
                                </span>
                            </label>
                            
                            {/* Inputs de turnos */}
                            {isChecked ? (
                                <div className="flex-1 space-y-2">
                                    {turnos.map((turno, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                                            <span className="text-xs font-semibold text-gray-500 w-14">Turno {i + 1}</span>
                                            <input
                                                type="time"
                                                value={turno.desde}
                                                onChange={(e) => handleChangeTime(dia, i, 'desde', e.target.value)}
                                                className="p-1 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                                            />
                                            <span className="text-gray-400 text-sm">a</span>
                                            <input
                                                type="time"
                                                value={turno.hasta}
                                                onChange={(e) => handleChangeTime(dia, i, 'hasta', e.target.value)}
                                                className="p-1 text-sm border rounded bg-white focus:ring-2 focus:ring-blue-400 outline-none"
                                            />
                                            {turnos.length > 1 && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleRemoveTurno(dia, i)}
                                                    className="ml-auto text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                                    title="Quitar turno"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {turnos.length < 2 && (
                                        <button 
                                            type="button" 
                                            onClick={() => handleAddTurno(dia)}
                                            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1 ml-1"
                                        >
                                            <span>+ Añadir turno (ej: tarde)</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex-1 text-sm text-gray-300 italic py-1">
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
