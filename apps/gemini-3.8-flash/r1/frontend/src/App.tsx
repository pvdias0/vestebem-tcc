import { useState, useEffect } from 'react';
import { User, Order } from './types';
import { apiGetProfile } from './api';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { AccountPage } from './AccountPage';
import { CreateOrderView } from './CreateOrderView';
import { OrderListView } from './OrderListView';
import { OrderDetailView } from './OrderDetailView';
import { EmployeeOrdersView } from './EmployeeOrdersView';
import { ProductCatalogView } from './ProductCatalogView';
import { ProductDetailView } from './ProductDetailView';
import { EmployeeProductsView } from './EmployeeProductsView';

type ViewMode =
  | 'catalog'
  | 'product_detail'
  | 'login'
  | 'register'
  | 'account'
  | 'create_order'
  | 'my_orders'
  | 'order_detail'
  | 'employee_orders'
  | 'employee_products';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewMode>('catalog');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [orderInitialProductId, setOrderInitialProductId] = useState<number | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Checa se o usuário já possui sessão ativa ao abrir a página
  useEffect(() => {
    async function checkAuth() {
      try {
        const user = await apiGetProfile();
        if (user) {
          setCurrentUser(user);
        } else {
          setCurrentUser(null);
        }
      } catch {
        setCurrentUser(null);
      } finally {
        setInitialLoading(false);
      }
    }

    checkAuth();
  }, []);

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role === 'employee') {
      setView('employee_orders');
    } else {
      setView('catalog');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedOrderId(null);
    setView('catalog');
  };

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    setView('order_detail');
  };

  const handleOrderCreated = (order: Order) => {
    setSelectedOrderId(order.id);
    setOrderInitialProductId(null);
    setView('order_detail');
  };

  const handleSelectProduct = (productId: number) => {
    setSelectedProductId(productId);
    setView('product_detail');
  };

  const handleGoToOrderWithProduct = (productId: number) => {
    if (!currentUser) {
      setView('login');
      return;
    }
    setOrderInitialProductId(productId);
    setView('create_order');
  };

  const handleUserUpdated = (updatedUser: User) => {
    setCurrentUser(updatedUser);
  };

  if (initialLoading) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <span className="brand-link">
              VesteBem <span className="brand-tag">Loja de Roupas</span>
            </span>
          </div>
        </header>
        <main className="main-content">
          <div className="loading-state">Carregando informações da loja...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <button
            type="button"
            className="brand-link"
            onClick={() => setView('catalog')}
          >
            VesteBem <span className="brand-tag">Loja de Roupas</span>
          </button>

          <nav className="nav-group">
            {/* Navegação Pública */}
            <button
              type="button"
              className={`nav-btn ${view === 'catalog' ? 'primary' : 'secondary'}`}
              onClick={() => setView('catalog')}
            >
              Catálogo de Peças
            </button>

            {currentUser ? (
              <>
                {currentUser.role === 'customer' && (
                  <>
                    <button
                      type="button"
                      className={`nav-btn ${view === 'create_order' ? 'primary' : 'secondary'}`}
                      onClick={() => {
                        setOrderInitialProductId(null);
                        setView('create_order');
                      }}
                    >
                      + Fazer Pedido
                    </button>
                    <button
                      type="button"
                      className={`nav-btn ${view === 'my_orders' ? 'primary' : 'secondary'}`}
                      onClick={() => setView('my_orders')}
                    >
                      Meus Pedidos
                    </button>
                  </>
                )}

                {currentUser.role === 'employee' && (
                  <>
                    <button
                      type="button"
                      className={`nav-btn ${view === 'employee_products' ? 'primary' : 'secondary'}`}
                      onClick={() => setView('employee_products')}
                    >
                      Gerenciar Produtos
                    </button>
                    <button
                      type="button"
                      className={`nav-btn ${view === 'employee_orders' ? 'primary' : 'secondary'}`}
                      onClick={() => setView('employee_orders')}
                    >
                      Painel de Pedidos
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className={`nav-btn ${view === 'account' ? 'primary' : 'secondary'}`}
                  onClick={() => setView('account')}
                >
                  Minha Conta ({currentUser.name.split(' ')[0]})
                </button>

                <button
                  type="button"
                  className="nav-btn danger"
                  onClick={handleLogout}
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`nav-btn ${view === 'login' ? 'primary' : 'secondary'}`}
                  onClick={() => setView('login')}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  className={`nav-btn ${view === 'register' ? 'primary' : 'secondary'}`}
                  onClick={() => setView('register')}
                >
                  Cadastre-se
                </button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="main-content">
        {/* Catálogo Público */}
        {view === 'catalog' && (
          <ProductCatalogView
            onSelectProduct={handleSelectProduct}
            onGoToOrderWithProduct={currentUser?.role === 'customer' ? handleGoToOrderWithProduct : undefined}
          />
        )}

        {/* Detalhes do Produto */}
        {view === 'product_detail' && selectedProductId && (
          <ProductDetailView
            productId={selectedProductId}
            onBack={() => setView('catalog')}
            onGoToOrderWithProduct={currentUser?.role === 'customer' ? handleGoToOrderWithProduct : undefined}
            canEdit={currentUser?.role === 'employee'}
            onEditProduct={() => setView('employee_products')}
          />
        )}

        {/* Autenticação e Conta */}
        {view === 'login' && (
          <LoginForm
            onSuccess={handleAuthSuccess}
            onNavigateToRegister={() => setView('register')}
          />
        )}

        {view === 'register' && (
          <RegisterForm
            onSuccess={handleAuthSuccess}
            onNavigateToLogin={() => setView('login')}
          />
        )}

        {view === 'account' && currentUser && (
          <AccountPage
            user={currentUser}
            onUserUpdated={handleUserUpdated}
            onLogout={handleLogout}
            onGoToOrders={() => setView('my_orders')}
            onGoToEmployeePanel={() => setView('employee_orders')}
          />
        )}

        {/* Gestão e Pedidos (Cliente) */}
        {view === 'create_order' && currentUser?.role === 'customer' && (
          <CreateOrderView
            currentUser={currentUser}
            onOrderCreated={handleOrderCreated}
            onCancel={() => setView('catalog')}
            onGoToAddressSettings={() => setView('account')}
            initialProductId={orderInitialProductId}
          />
        )}

        {view === 'my_orders' && currentUser?.role === 'customer' && (
          <OrderListView
            onSelectOrder={handleSelectOrder}
            onCreateNewOrder={() => {
              setOrderInitialProductId(null);
              setView('create_order');
            }}
          />
        )}

        {/* Gestão (Funcionário) */}
        {view === 'employee_products' && currentUser?.role === 'employee' && (
          <EmployeeProductsView />
        )}

        {view === 'employee_orders' && currentUser?.role === 'employee' && (
          <EmployeeOrdersView onSelectOrder={handleSelectOrder} />
        )}

        {/* Detalhes do Pedido */}
        {view === 'order_detail' && selectedOrderId && currentUser && (
          <OrderDetailView
            orderId={selectedOrderId}
            userRole={currentUser.role}
            onBack={() => {
              if (currentUser.role === 'employee') {
                setView('employee_orders');
              } else {
                setView('my_orders');
              }
            }}
            onSelectProduct={handleSelectProduct}
          />
        )}
      </main>

      <footer className="app-footer">
        © {new Date().getFullYear()} VesteBem. Todos os direitos reservados.
      </footer>
    </div>
  );
}

export default App;
