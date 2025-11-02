import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/db';
import { usePedidos } from '../context/PedidoContext';
import { ArrowLeftIcon, SearchIcon, ShoppingCartIcon, Spinner } from '../components/ui';

// --- INICIO DE LA MODIFICACIÓN: Función para formatear precios ---
const formatPrice = (price) => {
    const numPrice = Number(price);
    if (isNaN(numPrice)) return '$0';
    // Si el número es entero, no muestra decimales. Si no, muestra 2.
    return numPrice % 1 === 0 ? `$${numPrice}` : `$${numPrice.toFixed(2)}`;
};
// --- FIN DE LA MODIFICACIÓN ---

const NuevoPedidoPage = () => {
    const navigate = useNavigate();
    const { clienteLocalId } = useParams();
    const { openPedidos, updateCart } = usePedidos();

    const [cliente, setCliente] = useState(null);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [modalQuantity, setModalQuantity] = useState('1');

    const timerRef = useRef(null);
    const speedRef = useRef(200);

    const cart = openPedidos[clienteLocalId] || [];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [clienteData, productosData] = await Promise.all([
                    db.clientes.get(clienteLocalId),
                    db.productos.filter(p => p.archivado === false).toArray()
                ]);

                if (!clienteData) {
                    navigate('/clientes', { replace: true });
                    return;
                }
                setCliente(clienteData);
                setProductos(productosData);
            } catch (error) {
                console.error("Error cargando datos para el pedido:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [clienteLocalId, navigate]);

    const openModal = (producto) => {
        const itemInCart = cart.find(item => item.producto.id === producto.id);
        setSelectedProduct(producto);
        setModalQuantity(itemInCart ? String(itemInCart.cantidad) : '1');
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedProduct(null);
    };

    const handleUpdateCart = (producto, cantidad) => {
        let newCart;
        const existingItem = cart.find(item => item.producto.id === producto.id);
        const numCantidad = parseFloat(String(cantidad).replace(',', '.')) || 0;

        if (numCantidad > 0) {
            if (existingItem) {
                newCart = cart.map(item => item.producto.id === producto.id ? { ...item, cantidad: numCantidad } : item);
            } else {
                newCart = [...cart, { producto, cantidad: numCantidad }];
            }
        } else {
            newCart = cart.filter(item => item.producto.id !== producto.id);
        }
        updateCart(clienteLocalId, newCart);
    };
    
    const handleAcceptModal = () => {
        if (!selectedProduct) return;
        handleUpdateCart(selectedProduct, modalQuantity);
        closeModal();
    };

    const handleQuantityChange = (e) => {
        const value = e.target.value;
        if (/^[0-9,.]*$/.test(value)) {
            setModalQuantity(value);
        }
    };

    const adjustQuantity = (amount) => {
        setModalQuantity(prev => {
            const current = parseFloat(String(prev).replace(',', '.')) || 0;
            const newAmount = Math.max(0, current + amount);
            return String(newAmount);
        });
    };

    const startAdjusting = (amount) => {
        adjustQuantity(amount); 
        speedRef.current = 200; 
        
        timerRef.current = setTimeout(() => {
            const accelerate = () => {
                adjustQuantity(amount);
                speedRef.current = Math.max(50, speedRef.current * 0.9);
                timerRef.current = setTimeout(accelerate, speedRef.current);
            };
            accelerate();
        }, 400); 
    };

    const stopAdjusting = () => {
        clearTimeout(timerRef.current);
    };

    const filteredProductos = productos.filter(p =>
        p.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.codigo_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalPedido = cart.reduce((acc, item) => {
        return acc + ((item.producto.precio_unitario || 0) * item.cantidad);
    }, 0);

    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Spinner className="border-blue-600 h-10 w-10"/></div>;
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100">
            <header className="bg-white p-4 shadow-md sticky top-0 flex items-center gap-4 z-10">
                <button onClick={() => navigate('/clientes')} className="text-blue-600" aria-label="Volver a clientes">
                    <ArrowLeftIcon className="h-6 w-6" />
                </button>
                <div>
                    <h2 className="font-bold text-lg">{cliente?.nombre_comercio}</h2>
                    <p className="text-xs text-gray-500">Nuevo Pedido</p>
                </div>
            </header>
            <div className="p-4">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                        type="search"
                        placeholder="Buscar por nombre o SKU..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
            <main className="flex-1 overflow-y-auto p-4 pt-0 pb-24">
                {filteredProductos.map(producto => {
                    const itemInCart = cart.find(item => item.producto.id === producto.id);
                    return (
                        <div key={producto.id} onClick={() => openModal(producto)} className="bg-white p-3 rounded-lg shadow mb-3 flex items-center gap-4 active:bg-gray-200 cursor-pointer">
                            <img loading="lazy" src={producto.imagen_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=...'} alt={producto.nombre} className="w-16 h-16 rounded-md object-cover"/>
                            <div className="flex-1 overflow-hidden">
                                <p className="font-semibold text-gray-800 truncate">{producto.nombre}</p>
                                {/* --- MODIFICACIÓN: Usar la nueva función de formato de precio --- */}
                                <p className="text-sm text-blue-600 font-bold">{formatPrice(producto.precio_unitario)}</p>
                                <p className={`text-xs font-bold ${producto.stock === 'Sí' ? 'text-green-500' : 'text-red-500'}`}>
                                    Stock: {producto.stock}
                                </p>
                            </div>
                            {itemInCart && (
                                <div className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm flex-shrink-0">
                                    {itemInCart.cantidad}
                                </div>
                            )}
                        </div>
                    );
                })}
                 {filteredProductos.length === 0 && !loading && (
                    <p className="text-center text-gray-500 mt-8">No se encontraron productos.</p>
                )}
            </main>
            {cart.length > 0 && (
                <footer className="bg-white p-4 shadow-inner fixed bottom-0 w-full border-t">
                    <button onClick={() => navigate(`/pedidos/resumen/${clienteLocalId}`)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg flex justify-between items-center px-4">
                        <div className="flex items-center gap-2"><ShoppingCartIcon className="h-6 w-6"/><span>{cart.reduce((acc, item) => acc + item.cantidad, 0)} items</span></div>
                        <span>Ver Pedido</span><span>${totalPedido.toFixed(2)}</span>
                    </button>
                </footer>
            )}

            {isModalOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" 
                    onClick={closeModal}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="modal-title"
                >
                    <div 
                        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* --- INICIO DE LA MODIFICACIÓN: Añadir imagen al modal --- */}
                        <img loading="lazy" src={selectedProduct?.imagen_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=...'} alt={selectedProduct?.nombre} className="w-24 h-24 rounded-lg object-cover mx-auto mb-4"/>
                        <h3 id="modal-title" className="text-lg font-bold text-gray-800 mb-1 truncate">{selectedProduct?.nombre}</h3>
                        <p className="text-sm text-blue-600 font-bold mb-4">{formatPrice(selectedProduct?.precio_unitario)} c/u</p>
                        {/* --- FIN DE LA MODIFICACIÓN --- */}
                        
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <button 
                                onMouseDown={() => startAdjusting(-1)}
                                onMouseUp={stopAdjusting}
                                onMouseLeave={stopAdjusting}
                                onTouchStart={(e) => { e.preventDefault(); startAdjusting(-1); }}
                                onTouchEnd={stopAdjusting}
                                className="bg-gray-200 rounded-full h-12 w-12 text-3xl font-bold text-blue-600 active:bg-gray-300 select-none"
                            >-</button>
                            <input 
                                type="text" 
                                inputMode="decimal"
                                value={modalQuantity} 
                                onChange={handleQuantityChange}
                                className="w-24 text-center text-3xl font-bold border-b-2 border-blue-500 focus:outline-none bg-transparent"
                                autoFocus
                                onFocus={e => e.target.select()}
                            />
                            <button 
                                onMouseDown={() => startAdjusting(1)}
                                onMouseUp={stopAdjusting}
                                onMouseLeave={stopAdjusting}
                                onTouchStart={(e) => { e.preventDefault(); startAdjusting(1); }}
                                onTouchEnd={stopAdjusting}
                                className="bg-gray-200 rounded-full h-12 w-12 text-3xl font-bold text-blue-600 active:bg-gray-300 select-none"
                            >+</button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button onClick={closeModal} className="bg-gray-200 text-gray-800 font-bold py-3 rounded-lg active:bg-gray-300">
                                Cancelar
                            </button>
                            <button onClick={handleAcceptModal} className="bg-blue-600 text-white font-bold py-3 rounded-lg active:bg-blue-700">
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NuevoPedidoPage;