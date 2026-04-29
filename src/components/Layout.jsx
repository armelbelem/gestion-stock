import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { LayoutDashboard, Tags, Package, ArrowRightLeft, LogOut, Users, ShoppingCart, Sun, Moon, UserCog, Coins, BarChart3, Truck, Menu, X, Wallet, AlertCircle, Calendar, Store, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../store/storage';
import AlertModal from './AlertModal';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeYear, setActiveYear] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState(localStorage.getItem('selectedStore') || '');

  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Check for critical stock changes periodically
  useEffect(() => {
    const checkStock = async () => {
      const articles = await storage.get('articles');
      const lowStock = articles.filter(a => a.currentStock <= a.minStock);
      
      if (lowStock.length > 0 && lowStock.length !== lowStockCount) {
        addToast(`Attention : ${lowStock.length} articles en stock critique !`, 'danger');
      }
      
      console.debug(`[StockCheck] Found ${lowStock.length} low stock articles.`);
      setLowStockCount(lowStock.length);
    };

    checkStock();
    // Listen for storage changes if necessary, but for now we poll or check on navigation
    const interval = setInterval(checkStock, 10000); // Check every 10s
    return () => clearInterval(interval);
  }, [location.pathname, lowStockCount]); // Re-check on each page navigation or stock change

  useEffect(() => {
    const fetchActiveYear = async () => {
      try {
        const years = await storage.get('fiscal-years');
        const active = years.find(y => y.status === 'active');
        setActiveYear(active);
      } catch (err) {
        console.error("Error fetching active year:", err);
      }
    };
    fetchActiveYear();

    if (user?.role === 'admin') {
      const fetchStores = async () => {
        const data = await storage.get('stores');
        setStores(data);
      };
      fetchStores();
    }
  }, [location.pathname, user]);

  const handleStoreChange = (storeId) => {
    setSelectedStore(storeId);
    if (storeId) {
      localStorage.setItem('selectedStore', storeId);
    } else {
      localStorage.removeItem('selectedStore');
    }
    // Refresh page to apply filter to all requests via storage.get query params
    window.location.reload();
  };

  // Close sidebar when navigating on mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const handleLogoutClick = () => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Se déconnecter ?',
      message: 'Voulez-vous vraiment vous déconnecter de votre session ?',
      onConfirm: () => {
        logout();
      }
    });
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  return (
    <div className="app-container">
      {/* Mobile Overlay */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>StockFlow</h2>
          <button 
            className="menu-toggle" 
            style={{ marginLeft: 'auto', display: 'flex' }}
            onClick={() => setIsSidebarOpen(false)}
          >
            <X size={24} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {user?.role === 'admin' && (
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
              <LayoutDashboard className="nav-icon" size={20} />
              <span>Tableau de Bord</span>
              {lowStockCount > 0 && <span className="badge-alert">!</span>}
            </NavLink>
          )}

          {(user?.role === 'admin' || user?.role === 'vendeur') && (
            <NavLink to="/categories" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Tags className="nav-icon" size={20} />
              <span>Catégories</span>
            </NavLink>
          )}

          {user?.role === 'admin' && (
            <>
              <NavLink to="/articles" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Package className="nav-icon" size={20} />
                <span>Articles</span>
                {lowStockCount > 0 && <span className="badge-alert">{lowStockCount}</span>}
              </NavLink>
              <NavLink to="/mouvements" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <ArrowRightLeft className="nav-icon" size={20} />
                <span>Mouvements</span>
              </NavLink>
              <NavLink to="/transfers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <ArrowRightLeft className="nav-icon" size={20} />
                <span>Transferts</span>
              </NavLink>
              <NavLink to="/fournisseurs" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Truck className="nav-icon" size={20} />
                <span>Fournisseurs</span>
              </NavLink>
              <NavLink to="/finances" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Coins className="nav-icon" size={20} />
                <span>Finances</span>
              </NavLink>
              <NavLink to="/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Wallet className="nav-icon" size={20} />
                <span>Règlements</span>
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <BarChart3 className="nav-icon" size={20} />
                <span>Rapports</span>
              </NavLink>
              <NavLink to="/exercices" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Calendar className="nav-icon" size={20} />
                <span>Exercices</span>
              </NavLink>
            </>
          )}
          <NavLink to="/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Users className="nav-icon" size={20} />
            <span>Clients</span>
          </NavLink>
          <NavLink to="/sales" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <ShoppingCart className="nav-icon" size={20} />
            <span>Ventes</span>
          </NavLink>
          {user?.role === 'admin' && (
            <>
              <NavLink to="/stores" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Store className="nav-icon" size={20} />
                <span>Magasins</span>
              </NavLink>
              <NavLink to="/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <UserCog className="nav-icon" size={20} />
                <span>Utilisateurs</span>
              </NavLink>
              <NavLink to="/audit" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <ShieldAlert className="nav-icon" size={20} />
                <span>Journal d'Audit</span>
              </NavLink>
            </>
          )}
        </nav>
      </aside>
      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="menu-toggle" onClick={toggleSidebar}>
              <Menu size={24} />
            </button>
            <div className="header-title">Gestion de Stock</div>
            {activeYear && (
              <div className="badge badge-primary" style={{ marginLeft: '1rem', fontSize: '0.8rem', padding: '4px 10px' }}>
                <Calendar size={12} style={{ marginRight: '4px' }} />
                {activeYear.name}
              </div>
            )}
            
            {user?.role === 'admin' && (
              <div className="store-selector" style={{ marginLeft: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Store size={18} className="text-muted" />
                <select 
                  className="form-control" 
                  style={{ width: '200px', height: '36px', padding: '0 10px' }}
                  value={selectedStore}
                  onChange={(e) => handleStoreChange(e.target.value)}
                >
                  <option value="">Tous les magasins (Global)</option>
                  {stores.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <button 
              onClick={toggleTheme}
              className="btn btn-secondary"
              style={{ padding: '0.5rem', borderRadius: '8px', display: 'flex' }}
              title={theme === 'light' ? 'Passer au mode sombre' : 'Passer au mode clair'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="user-profile" style={{ gap: '0.5rem' }}>
              <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.8rem', backgroundColor: user?.role === 'admin' ? 'var(--primary)' : 'var(--success)' }}>
                {user ? user.username[0].toUpperCase() : 'A'}
              </div>
              <div style={{ display: 'none', flexDirection: 'column' }} className="desktop-only-flex">
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user ? user.username : 'Admin'}</span>
              </div>
            </div>
            <button 
              onClick={handleLogoutClick}
              className="btn btn-secondary" 
              style={{ padding: '0.5rem', borderRadius: '8px', color: 'var(--danger)', display: 'flex' }}
              title="Déconnexion"
            >
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <div className="page-content">
          {lowStockCount > 0 && (
            <div className="sticky-alert-banner">
              <AlertCircle size={20} />
              <span>ALERTE STOCK CRITIQUE : {lowStockCount} article(s) à réapprovisionner</span>
              <NavLink to="/mouvements" style={{ color: 'white', marginLeft: 'auto', textDecoration: 'underline', fontSize: '0.8rem' }}>
                Gérer le stock
              </NavLink>
            </div>
          )}
          <Outlet />
        </div>
      </main>

      <AlertModal 
        isOpen={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={alertModal.onConfirm}
        onClose={() => setAlertModal({ ...alertModal, open: false, onConfirm: null })}
      />

      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <AlertCircle size={20} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1025px) {
          .desktop-only-flex { display: flex !important; }
        }
      `}} />
    </div>
  );
};

export default Layout;
