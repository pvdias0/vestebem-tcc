import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ActiveView } from '../types';

interface HeaderProps {
  currentView: ActiveView;
  onNavigate: (view: ActiveView) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
  const { user, logoutUser } = useAuth();

  return (
    <header className="header">
      <div className="logo-area" onClick={() => onNavigate('catalog')}>
        <span className="logo-title">VesteBem</span>
        <span className="logo-badge">Loja de Roupas</span>
      </div>

      <nav className="header-nav">
        {/* Catálogo público acessível a todos */}
        <button
          type="button"
          className={`btn ${currentView === 'catalog' ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => onNavigate('catalog')}
        >
          Catálogo
        </button>

        {user ? (
          <>
            {user.role === 'customer' && (
              <>
                <button
                  type="button"
                  className={`btn ${currentView === 'new-order' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => onNavigate('new-order')}
                >
                  Novo Pedido
                </button>
                <button
                  type="button"
                  className={`btn ${currentView === 'my-orders' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => onNavigate('my-orders')}
                >
                  Meus Pedidos
                </button>
              </>
            )}

            {user.role === 'employee' && (
              <>
                <button
                  type="button"
                  className={`btn ${currentView === 'employee-orders' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => onNavigate('employee-orders')}
                >
                  Gestão de Pedidos
                </button>
                <button
                  type="button"
                  className={`btn ${currentView === 'employee-products' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => onNavigate('employee-products')}
                >
                  Gestão de Produtos
                </button>
              </>
            )}

            <button
              type="button"
              className={`btn ${currentView === 'account' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onNavigate('account')}
            >
              Minha Conta
            </button>

            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginLeft: '0.25rem' }}>
              <strong>{user.name}</strong> ({user.role === 'employee' ? 'Funcionário' : 'Cliente'})
            </span>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => logoutUser()}
            >
              Sair
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`btn ${currentView === 'login' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onNavigate('login')}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`btn ${currentView === 'register' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => onNavigate('register')}
            >
              Cadastrar
            </button>
          </>
        )}
      </nav>
    </header>
  );
};
