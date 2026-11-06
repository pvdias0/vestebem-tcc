import React from 'react';
import { useAuth } from '../context/AuthContext.js';

export type ActiveView =
  | 'catalog'
  | 'product-details'
  | 'login'
  | 'register'
  | 'account'
  | 'my-orders'
  | 'create-order'
  | 'order-details'
  | 'employee-orders'
  | 'employee-products';

interface NavbarProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate }) => {
  const { user, logout } = useAuth();

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => onNavigate('catalog')}>
          <span className="brand-logo">👗</span>
          <span className="brand-name">VesteBem</span>
        </div>

        <nav className="navbar-nav">
          {/* Link público sempre visível */}
          <button
            type="button"
            className={`nav-link ${currentView === 'catalog' || currentView === 'product-details' ? 'active' : ''}`}
            onClick={() => onNavigate('catalog')}
          >
            Catálogo
          </button>

          {user ? (
            <div className="nav-user-actions">
              {user.role === 'customer' && (
                <>
                  <button
                    type="button"
                    className={`nav-link ${currentView === 'my-orders' || currentView === 'order-details' ? 'active' : ''}`}
                    onClick={() => onNavigate('my-orders')}
                  >
                    Meus pedidos
                  </button>
                  <button
                    type="button"
                    className={`nav-link ${currentView === 'create-order' ? 'active' : ''}`}
                    onClick={() => onNavigate('create-order')}
                  >
                    + Novo pedido
                  </button>
                </>
              )}

              {user.role === 'employee' && (
                <>
                  <button
                    type="button"
                    className={`nav-link ${currentView === 'employee-orders' || currentView === 'order-details' ? 'active' : ''}`}
                    onClick={() => onNavigate('employee-orders')}
                  >
                    Painel de Pedidos
                  </button>
                  <button
                    type="button"
                    className={`nav-link ${currentView === 'employee-products' ? 'active' : ''}`}
                    onClick={() => onNavigate('employee-products')}
                  >
                    Gerenciar Produtos
                  </button>
                </>
              )}

              <button
                type="button"
                className={`nav-link ${currentView === 'account' ? 'active' : ''}`}
                onClick={() => onNavigate('account')}
              >
                Minha conta
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => logout()}
              >
                Sair
              </button>
            </div>
          ) : (
            <div className="nav-auth-actions">
              <button
                type="button"
                className={`btn btn-link ${currentView === 'login' ? 'active' : ''}`}
                onClick={() => onNavigate('login')}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`btn btn-primary ${currentView === 'register' ? 'active' : ''}`}
                onClick={() => onNavigate('register')}
              >
                Criar conta
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};
