import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { AuthProvider } from './context/AuthContext.js';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Elemento root não encontrado no documento.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);
