import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute, AppLayout } from './components/routing';

// Importamos las páginas
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import ClientesPage from './pages/ClientesPage';
import ClienteFormPage from './pages/ClienteFormPage';
import NuevoPedidoPage from './pages/NuevoPedidoPage';
import PedidoSummaryPage from './pages/PedidoSummaryPage';
import PedidosPage from './pages/PedidosPage';
import ConfiguracionPage from './pages/ConfiguracionPage';
import PedidoEditPage from './pages/PedidoEditPage'; // <-- NUEVO

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/clientes" element={<ClientesPage />} />
          <Route path="/clientes/nuevo" element={<ClienteFormPage />} />
          <Route path="/clientes/editar/:localId" element={<ClienteFormPage />} />
          <Route path="/pedidos/nuevo/:clienteLocalId" element={<NuevoPedidoPage />} />
          
          {/* --- NUEVA RUTA DE EDICIÓN --- */}
          <Route path="/pedidos/editar/:pedidoLocalId" element={<PedidoEditPage />} />
          
          <Route path="/pedidos/resumen/:clienteLocalId" element={<PedidoSummaryPage />} />
          <Route path="/pedidos" element={<PedidosPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
    </Routes>
  );
}

export default App;