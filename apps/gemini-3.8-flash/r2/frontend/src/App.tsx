import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AccountPage } from './pages/AccountPage';
import { NewOrderPage } from './pages/NewOrderPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { OrderDetailsPage } from './pages/OrderDetailsPage';
import { EmployeeOrdersPage } from './pages/EmployeeOrdersPage';
import { EmployeeProductsPage } from './pages/EmployeeProductsPage';
import { CatalogPage } from './pages/CatalogPage';
import { ProductDetailsPage } from './pages/ProductDetailsPage';
import { ActiveView } from './types';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = useState<ActiveView>('catalog');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);

  // Navegação
  const handleNavigate = (view: ActiveView) => {
    setCurrentView(view);
  };

  const handleSelectProduct = (productId: number) => {
    setSelectedProductId(productId);
    setCurrentView('product-details');
  };

  const handleOrderCreated = (orderId: number) => {
    setSelectedOrderId(orderId);
    setCurrentView('order-details');
  };

  const handleSelectOrder = (orderId: number) => {
    setSelectedOrderId(orderId);
    setCurrentView('order-details');
  };

  const handleBackFromOrderDetails = () => {
    if (user?.role === 'employee') {
      setCurrentView('employee-orders');
    } else {
      setCurrentView('my-orders');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-box">
          <div className="spinner"></div>
          <span>Carregando informações...</span>
        </div>
      );
    }

    // Telas públicas (Catálogo e Detalhes de Produto)
    if (currentView === 'catalog') {
      return (
        <CatalogPage
          onSelectProduct={handleSelectProduct}
          onNavigate={handleNavigate}
        />
      );
    }

    if (currentView === 'product-details' && selectedProductId) {
      return (
        <ProductDetailsPage
          productId={selectedProductId}
          onBack={() => setCurrentView('catalog')}
          onNavigate={handleNavigate}
        />
      );
    }

    // Telas para visitantes (Login / Cadastro)
    if (!user) {
      if (currentView === 'register') {
        return <RegisterPage onNavigateToLogin={() => setCurrentView('login')} />;
      }
      return <LoginPage onNavigateToRegister={() => setCurrentView('register')} />;
    }

    // Telas restritas a usuários autenticados
    switch (currentView) {
      case 'account':
        return <AccountPage onNavigate={handleNavigate} />;
      case 'new-order':
        return (
          <NewOrderPage
            onOrderCreated={handleOrderCreated}
            onNavigate={handleNavigate}
          />
        );
      case 'my-orders':
        return (
          <MyOrdersPage
            onSelectOrder={handleSelectOrder}
            onNavigate={handleNavigate}
          />
        );
      case 'order-details':
        return selectedOrderId ? (
          <OrderDetailsPage
            orderId={selectedOrderId}
            onBack={handleBackFromOrderDetails}
            onNavigate={handleNavigate}
          />
        ) : (
          <MyOrdersPage
            onSelectOrder={handleSelectOrder}
            onNavigate={handleNavigate}
          />
        );
      case 'employee-orders':
        return user.role === 'employee' ? (
          <EmployeeOrdersPage
            onSelectOrder={handleSelectOrder}
            onNavigate={handleNavigate}
          />
        ) : (
          <MyOrdersPage
            onSelectOrder={handleSelectOrder}
            onNavigate={handleNavigate}
          />
        );
      case 'employee-products':
        return user.role === 'employee' ? (
          <EmployeeProductsPage />
        ) : (
          <CatalogPage
            onSelectProduct={handleSelectProduct}
            onNavigate={handleNavigate}
          />
        );
      default:
        return (
          <CatalogPage
            onSelectProduct={handleSelectProduct}
            onNavigate={handleNavigate}
          />
        );
    }
  };

  return (
    <div className="app-container">
      <Header currentView={currentView} onNavigate={handleNavigate} />

      <main className="main-content">{renderContent()}</main>

      <footer className="footer">
        <p>&copy; {new Date().getFullYear()} VesteBem - Loja de Roupas. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};
