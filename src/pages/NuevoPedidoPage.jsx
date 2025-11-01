import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/db';
import { usePedidos } from '../context/PedidoContext';
import { ArrowLeftIcon, SearchIcon, ShoppingCartIcon, Spinner } from '../components/ui';

const NuevoPedidoPage = () => {
    const navigate = useNavigate();
    const { clienteLocalId } = useParams();
    const { openPedidos, updateCart } = usePedidos();

    const [cliente, setCliente] = useState(null);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const cart = openPedidos[clienteLocalId] || [];

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [clienteData, productosData] = await Promise.all([
                    db.clientes.get(clienteLocalId),
                    db.productos.where('archivado').equals(false).toArray()
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

    const handleProductSelect = (producto, cantidad) => {
        let newCart;
        const existingItem = cart.find(item => item.producto.id === producto.id);

        if (cantidad > 0) {
            if (existingItem) {
                newCart = cart.map(item => item.producto.id === producto.id ? { ...item, cantidad } : item);
            } else {
                newCart = [...cart, { producto, cantidad }];
            }
        } else {
            newCart = cart.filter(item => item.producto.id !== producto.id);
        }
        updateCart(clienteLocalId, newCart);
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
                        <div key={producto.id} onClick={() => handleProductSelect(producto, itemInCart ? 0 : 1)} className="bg-white p-3 rounded-lg shadow mb-3 flex items-center gap-4 active:bg-gray-200 cursor-pointer">
                            <img loading="lazy" src={producto.imagen_url || 'https://placehold.co/100x100/e2e8f0/e2e8f0?text=...'} alt={producto.nombre} className="w-16 h-16 rounded-md object-cover"/>
                            <div className="flex-1">
                                <p className="font-semibold text-gray-800">{producto.nombre}</p>
                                <p className="text-sm text-blue-600 font-bold">${producto.precio_unitario.toFixed(2)}</p>
                                <p className={`text-xs font-bold ${producto.stock === 'Sí' ? 'text-green-500' : 'text-red-500'}`}>
                                    Stock: {producto.stock}
                                </p>
                            </div>
                            {itemInCart && (
                                <div className="bg-blue-600 text-white rounded-full h-8 w-8 flex items-center justify-center font-bold text-sm">
                                    {itemInCart.cantidad}
                                </div>
                            )}
                        </div>
                    );
                })}
            </main>
            {cart.length > 0 && (
                <footer className="bg-white p-4 shadow-inner fixed bottom-0 w-full border-t">
                    <button onClick={() => navigate(`/pedidos/resumen/${clienteLocalId}`)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg flex justify-between items-center px-4">
                        <div className="flex items-center gap-2"><ShoppingCartIcon className="h-6 w-6"/><span>{cart.reduce((acc, item) => acc + item.cantidad, 0)} items</span></div>
                        <span>Ver Pedido</span><span>${totalPedido.toFixed(2)}</span>
                    </button>
                </footer>
            )}
        </div>
    );
};

export default NuevoPedidoPage;