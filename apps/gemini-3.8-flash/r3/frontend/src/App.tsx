import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext.js';
import { Navbar, type ActiveView } from './components/Navbar.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { AccountPage } from './pages/AccountPage.js';
import { MyOrdersPage } from './pages/MyOrdersPage.js';
import { CreateOrderPage } from './pages/CreateOrderPage.js';
import { OrderDetailsPage } from './pages/OrderDetailsPage.js';
import { EmployeeOrdersPage } from './pages/EmployeeOrdersPage.js';
import { CatalogPage } from './pages/CatalogPage.js';
import { ProductDetailsPage } from './pages/ProductDetailsPage.js';
import { EmployeeProductsPage } from './pages/EmployeeProductsPage.js';
import type { Product } from './services/api.js';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ActiveView>('catalog');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [preSelectedProduct, setPreSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        // Se deslogou e estava em telas autenticadas
        if (
          currentView === 'my-orders' ||
          currentView === 'create-order' ||
          currentView === 'employee-orders' ||
          currentView === 'employee-products' ||
          currentView === 'account'
        ) {
          setCurrentView('catalog');
        }
      }
    }
  }, [user, loading, currentView]);

  if (loading) {
    return (
      <div className="loading-container">
        <p>Carregando VesteBem...</p>
      </div>
    );
  }

  const handleSelectOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCurrentView('order-details');
  };

  const handleBackFromOrderDetails = () => {
    setSelectedOrderId(null);
    if (user?.role === 'employee') {
      setCurrentView('employee-orders');
    } else {
      setCurrentView('my-orders');
    }
  };

  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    setCurrentView('product-details');
  };

  const handleOrderProduct = (product: Product) => {
    setPreSelectedProduct(product);
    if (!user) {
      setCurrentView('login');
    } else {
      setCurrentView('create-order');
    }
  };

  return (
    <div className="app-container">
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          setSelectedOrderId(null);
          setSelectedProductId(null);
          setPreSelectedProduct(null);
          setCurrentView(view);
        }}
      />
      <main className="app-main">
        {/* Telas Públicas */}
        {currentView === 'catalog' && (
          <CatalogPage
            onSelectProduct={handleSelectProduct}
            onOrderProduct={handleOrderProduct}
          />
        )}

        {currentView === 'product-details' && selectedProductId && (
          <ProductDetailsPage
            productId={selectedProductId}
            onBack={() => {
              setSelectedProductId(null);
              setCurrentView('catalog');
            }}
            onOrderNow={handleOrderProduct}
          />
        )}

        {currentView === 'login' && (
          <LoginPage
            onSuccess={() => {
              if (preSelectedProduct) {
                setCurrentView('create-order');
              } else if (user?.role === 'employee') {
                setCurrentView('employee-orders');
              } else {
                setCurrentView('catalog');
              }
            }}
            onGoToRegister={() => setCurrentView('register')}
          />
        )}

        {currentView === 'register' && (
          <RegisterPage
            onSuccess={() => {
              if (preSelectedProduct) {
                setCurrentView('create-order');
              } else {
                setCurrentView('catalog');
              }
            }}
            onGoToLogin={() => setCurrentView('login')}
          />
        )}

        {/* Telas Autenticadas */}
        {user && (
          <>
            {currentView === 'account' && (
              <AccountPage
                onLoggedOut={() => setCurrentView('catalog')}
                onAddressUpdated={() => {
                  if (preSelectedProduct) {
                    setCurrentView('create-order');
                  }
                }}
              />
            )}

            {currentView === 'create-order' && user.role === 'customer' && (
              <CreateOrderPage
                initialProduct={preSelectedProduct}
                onOrderCreated={(orderId) => {
                  setPreSelectedProduct(null);
                  setSelectedOrderId(orderId);
                  setCurrentView('order-details');
                }}
                onCancel={() => {
                  setPreSelectedProduct(null);
                  setCurrentView('my-orders');
                }}
                onGoToAccount={() => setCurrentView('account')}
              />
            )}

            {currentView === 'my-orders' && user.role === 'customer' && (
              <MyOrdersPage
                onSelectOrder={handleSelectOrder}
                onCreateNewOrder={() => {
                  setPreSelectedProduct(null);
                  setCurrentView('create-order');
                }}
              />
            )}

            {currentView === 'order-details' && selectedOrderId && (
              <OrderDetailsPage
                orderId={selectedOrderId}
                onBack={handleBackFromOrderDetails}
              />
            )}

            {currentView === 'employee-orders' && user.role === 'employee' && (
              <EmployeeOrdersPage onSelectOrder={handleSelectOrder} />
            )}

            {currentView === 'employee-products' && user.role === 'employee' && (
              <EmployeeProductsPage />
            )}
          </>
        )}
      </main>
    </div>
  );
};
