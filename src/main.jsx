import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './index.css';
import { AuthProvider } from './context/AuthContext';
import { PedidoProvider } from './context/PedidoContext';
import { SyncProvider } from './context/SyncContext'; // 1. Importar

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SyncProvider> {/* 2. Envolver con SyncProvider */}
          <PedidoProvider>
            <App />
          </PedidoProvider>
        </SyncProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);