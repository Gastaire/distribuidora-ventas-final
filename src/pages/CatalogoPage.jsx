import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/db';
import { ArrowLeftIcon } from '../components/ui';

// Icono libro para el catálogo
const BookIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
);

const GridIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
);

const ListIcon = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
);

const formatPrice = (price) => {
    const n = Number(price);
    if (isNaN(n)) return '$0';
    return n % 1 === 0 ? `$${n}` : `$${n.toFixed(2)}`;
};

const CatalogoPage = () => {
    const navigate = useNavigate();
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState('lista'); // 'lista' | 'catalogo'

    useEffect(() => {
        const fetchProductos = async () => {
            setLoading(true);
            try {
                // Solo productos en stock, no archivados
                const data = await db.productos
                    .filter(p => p.archivado === false && p.stock === 'Sí')
                    .toArray();
                // Ordenar por categoría y luego nombre
                data.sort((a, b) => {
                    const catA = (a.categoria || 'Sin Categoría').localeCompare(b.categoria || 'Sin Categoría');
                    if (catA !== 0) return catA;
                    return (a.nombre || '').localeCompare(b.nombre || '');
                });
                setProductos(data);
            } catch (err) {
                console.error('Error cargando catálogo:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchProductos();
    }, []);

    // Agrupar por categoría
    const categorias = productos.reduce((acc, p) => {
        const cat = p.categoria || 'Sin Categoría';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(p);
        return acc;
    }, {});

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <div className="border-4 border-blue-600 border-t-transparent rounded-full h-10 w-10 animate-spin"/>
            </div>
        );
    }

    return (
        <>
            {/* Estilos de impresión inline */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .print-header-info { display: block !important; }
                    body { background: white; }
                    .catalogo-grid { 
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 8px !important;
                        break-inside: avoid;
                    }
                    .product-card { 
                        page-break-inside: avoid;
                        break-inside: avoid;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        padding: 8px;
                        margin-bottom: 8px;
                    }
                    .category-header {
                        page-break-before: auto;
                        break-before: auto;
                    }
                    .product-list-row {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
                .print-header-info { display: none; }
            `}</style>

            <div className="bg-gray-100 min-h-screen">
                {/* Header — no se imprime */}
                <header className="no-print bg-white p-4 shadow-md sticky top-0 flex items-center justify-between z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate('/')} className="text-blue-600" aria-label="Volver">
                            <ArrowLeftIcon className="h-6 w-6" />
                        </button>
                        <div>
                            <h2 className="font-bold text-lg">Catálogo</h2>
                            <p className="text-xs text-gray-500">{productos.length} productos en stock</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Toggle lista / cuadrícula */}
                        <div className="flex bg-gray-100 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('lista')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'lista' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                title="Vista lista"
                            >
                                <ListIcon className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('catalogo')}
                                className={`p-1.5 rounded-md transition-colors ${viewMode === 'catalogo' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                                title="Vista catálogo"
                            >
                                <GridIcon className="h-5 w-5" />
                            </button>
                        </div>
                        {/* Botón imprimir / compartir como PDF */}
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg text-sm flex items-center gap-2 active:bg-blue-700"
                        >
                            <BookIcon className="h-4 w-4" />
                            Compartir PDF
                        </button>
                    </div>
                </header>

                {/* Encabezado que solo se ve al imprimir */}
                <div className="print-header-info p-4 border-b mb-4">
                    <h1 className="text-2xl font-bold">Lista de Precios</h1>
                    <p className="text-sm text-gray-500">Generado el {new Date().toLocaleDateString('es-AR')} · Solo productos en stock</p>
                </div>

                {/* Contenido */}
                <main className="p-4">
                    {Object.entries(categorias).map(([categoria, prods]) => (
                        <div key={categoria} className="mb-6">
                            {/* Encabezado de categoría */}
                            <div className="category-header bg-blue-600 text-white rounded-lg px-4 py-2 mb-3 flex items-center justify-between">
                                <h3 className="font-bold text-sm uppercase tracking-wide">{categoria}</h3>
                                <span className="text-xs opacity-80">{prods.length} productos</span>
                            </div>

                            {viewMode === 'lista' ? (
                                /* Vista Lista */
                                <div className="space-y-2">
                                    {prods.map(p => (
                                        <div key={p.id} className="product-card product-list-row bg-white rounded-lg shadow-sm p-3 flex items-center gap-3">
                                            <img
                                                loading="lazy"
                                                src={p.imagen_url || 'https://placehold.co/48x48/f1f5f9/94a3b8?text=...'}
                                                alt={p.nombre}
                                                className="w-12 h-12 rounded-md object-cover flex-shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-gray-800 text-sm truncate">{p.nombre}</p>
                                                {p.codigo_sku && <p className="text-xs text-gray-400">SKU: {p.codigo_sku}</p>}
                                            </div>
                                            <p className="font-bold text-blue-600 text-base flex-shrink-0">{formatPrice(p.precio_unitario)}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                /* Vista Catálogo (cuadrícula) */
                                <div className="catalogo-grid grid grid-cols-2 gap-3">
                                    {prods.map(p => (
                                        <div key={p.id} className="product-card bg-white rounded-lg shadow-sm p-3 flex flex-col items-center text-center">
                                            <img
                                                loading="lazy"
                                                src={p.imagen_url || 'https://placehold.co/120x120/f1f5f9/94a3b8?text=...'}
                                                alt={p.nombre}
                                                className="w-full h-28 rounded-md object-contain mb-2"
                                            />
                                            <p className="font-semibold text-gray-800 text-xs leading-tight mb-1 line-clamp-2">{p.nombre}</p>
                                            <p className="font-bold text-blue-600 text-sm mt-auto">{formatPrice(p.precio_unitario)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {Object.keys(categorias).length === 0 && (
                        <div className="text-center text-gray-500 mt-12">
                            <BookIcon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                            <p className="font-semibold">No hay productos en stock.</p>
                            <p className="text-sm mt-1">Sincronizá la app para actualizar el catálogo.</p>
                        </div>
                    )}
                </main>
            </div>
        </>
    );
};

export default CatalogoPage;
