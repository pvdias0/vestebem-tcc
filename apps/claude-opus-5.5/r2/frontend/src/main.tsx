import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router';
import { AuthProvider, useAuth } from './auth';
import { RequireAuth } from './components';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { AccountPage } from './pages/AccountPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { CatalogPage, EmployeeProductsPage, ProductDetailPage } from './pages/CatalogPages';
import { ProductFormPage } from './pages/ProductFormPage';
import { EmployeeOrdersPage, MyOrdersPage, OrderDetailPage } from './pages/OrderPages';
import './styles.css';

function Header() {
  const { user, loading } = useAuth();
  return (
    <header className="header">
      <Link to="/" className="brand">VesteBem</Link>
      <nav>
        <NavLink to="/" end>Catálogo</NavLink>
        {loading ? null : user ? (
          <>
            {user.role === 'customer' && (
              <>
                <NavLink to="/pedidos/novo">Novo pedido</NavLink>
                <NavLink to="/meus-pedidos" end>Meus pedidos</NavLink>
              </>
            )}
            {user.role === 'employee' && (
              <>
                <NavLink to="/painel/pedidos">Painel de pedidos</NavLink>
                <NavLink to="/painel/produtos">Painel de produtos</NavLink>
              </>
            )}
            <NavLink to="/minha-conta">Minha conta</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/entrar">Entrar</NavLink>
            <NavLink to="/cadastro">Criar conta</NavLink>
          </>
        )}
      </nav>
    </header>
  );
}

function App() {
  return (
    <>
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/produtos" element={<Navigate to="/" replace />} />
          <Route path="/produtos/:id" element={<ProductDetailPage />} />
          <Route path="/entrar" element={<LoginPage />} />
          <Route path="/cadastro" element={<RegisterPage />} />
          <Route path="/minha-conta" element={<AccountPage />} />
          <Route path="/pedidos/novo" element={<RequireAuth role="customer"><NewOrderPage /></RequireAuth>} />
          <Route path="/meus-pedidos" element={<RequireAuth role="customer"><MyOrdersPage /></RequireAuth>} />
          <Route path="/pedidos/:id" element={<RequireAuth><OrderDetailPage /></RequireAuth>} />
          <Route path="/painel/produtos" element={<RequireAuth role="employee"><EmployeeProductsPage /></RequireAuth>} />
          <Route path="/painel/produtos/novo" element={<RequireAuth role="employee"><ProductFormPage /></RequireAuth>} />
          <Route path="/painel/produtos/:id/editar" element={<RequireAuth role="employee"><ProductFormPage /></RequireAuth>} />
          <Route path="/painel/pedidos" element={<RequireAuth role="employee"><EmployeeOrdersPage /></RequireAuth>} />
          <Route path="*" element={<p className="center">Página não encontrada. <Link to="/">Voltar ao início</Link></p>} />
        </Routes>
      </main>
      <footer className="footer">© VesteBem</footer>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
