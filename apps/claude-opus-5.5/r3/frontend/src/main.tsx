import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router';
import { AuthProvider, useAuth } from './auth';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AccountPage } from "./pages/AccountPage";
import { NewOrderPage } from "./pages/NewOrderPage";
import { OrdersListPage } from "./pages/OrdersListPage";
import { OrderDetailPage } from "./pages/OrderDetailPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ProductPage } from "./pages/ProductPage";
import { StaffProductsPage } from "./pages/StaffProductsPage";
import { ProductFormPage } from "./pages/ProductFormPage";
import type { ReactNode } from "react";
import type { Role } from "./api";
import './styles.css';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <header className="header">
      <Link to="/" className="brand">VesteBem</Link>
      <nav>
        <NavLink to="/" end>Catálogo</NavLink>
        {user ? (
          <>
            {user.role === "cliente" ? (
              <>
                <NavLink to="/pedidos/novo">Novo pedido</NavLink>
                <NavLink to="/meus-pedidos" end>Meus pedidos</NavLink>
              </>
            ) : (
              <>
                <NavLink to="/painel" end>Pedidos</NavLink>
                <NavLink to="/painel/produtos">Produtos</NavLink>
              </>
            )}
            <NavLink to="/minha-conta">Minha conta</NavLink>
            <button className="link-button" onClick={async () => { await logout(); navigate('/entrar'); }}>
              Sair
            </button>
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

function homeFor(role: Role) {
  return role === "funcionario" ? "/painel" : "/meus-pedidos";
}

/** Exige login (e, opcionalmente, um perfil). Proteção apenas de navegação; o backend valida tudo. */
function Guard({ role, children }: { role?: Role; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/entrar" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function App() {
  const { user, loading } = useAuth();
  if (loading) return <p className="center">Carregando…</p>;
  return (
    <>
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/produtos/:id" element={<ProductPage />} />
          <Route path="/painel/produtos" element={<Guard role="funcionario"><StaffProductsPage /></Guard>} />
          <Route path="/painel/produtos/novo" element={<Guard role="funcionario"><ProductFormPage /></Guard>} />
          <Route path="/painel/produtos/:id" element={<Guard role="funcionario"><ProductFormPage /></Guard>} />
          <Route path="/entrar" element={user ? <Navigate to={homeFor(user.role)} replace /> : <LoginPage />} />
          <Route path="/cadastro" element={user ? <Navigate to={homeFor(user.role)} replace /> : <RegisterPage />} />
          <Route path="/minha-conta" element={<Guard><AccountPage /></Guard>} />
          <Route path="/pedidos/novo" element={<Guard role="cliente"><NewOrderPage /></Guard>} />
          <Route path="/meus-pedidos" element={<Guard role="cliente"><OrdersListPage staff={false} /></Guard>} />
          <Route path="/pedidos/:id" element={<Guard><OrderDetailPage /></Guard>} />
          <Route path="/painel" element={<Guard role="funcionario"><OrdersListPage staff /></Guard>} />
          <Route path="*" element={<p className="center">Página não encontrada.</p>} />
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
