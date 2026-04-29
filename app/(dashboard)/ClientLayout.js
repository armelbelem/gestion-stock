'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Tags, Package, ArrowRightLeft, LogOut, 
  Users, ShoppingCart, Sun, Moon, UserCog, Coins, BarChart3, 
  Truck, Menu, X, Wallet, AlertCircle, Calendar, Store, ShieldAlert, PackageOpen
} from 'lucide-react';
import { useAuth } from '../providers';
import { storage } from '../lib/storage';
import AlertModal from '../components/AlertModal';

export default function ClientLayout({ children }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeYear, setActiveYear] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedStore = localStorage.getItem('selectedStore') || '';
    setTheme(savedTheme);
    setSelectedStore(savedStore);
  }, []);

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

  useEffect(() => {
    const checkStock = async () => {
      const articles = await storage.get('articles');
      const lowStock = articles.filter(a => a.currentStock <= a.minStock);
      if (lowStock.length > 0 && lowStock.length !== lowStockCount) {
        addToast(`Attention : ${lowStock.length} articles en stock critique !`, 'danger');
      }
      setLowStockCount(lowStock.length);
    };

    checkStock();
    const interval = setInterval(checkStock, 30000); 
    return () => clearInterval(interval);
  }, [pathname, lowStockCount]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const years = await storage.get('fiscal-years');
        const active = years.find(y => y.status === 'active');
        setActiveYear(active);

        if (user?.role === 'admin') {
          const data = await storage.get('stores');
          setStores(data);
        }
      } catch (err) {
        console.error("Error fetching initial layout data:", err);
      }
    };
    fetchData();
  }, [pathname, user]);

  const handleStoreChange = (storeId) => {
    setSelectedStore(storeId);
    if (storeId) {
      localStorage.setItem('selectedStore', storeId);
    } else {
      localStorage.removeItem('selectedStore');
    }
    window.location.reload();
  };

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

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

  const NavItem = ({ href, icon: Icon, label, badge, end = false }) => {
    const isActive = end ? pathname === href : pathname.startsWith(href) && (href !== '/' || pathname === '/');
    return (
      <Link href={href} className={`nav-item ${isActive ? 'active' : ''}`}>
        <Icon className="nav-icon" size={20} />
        <span>{label}</span>
        {badge > 0 && <span className="badge-alert">{badge === true ? '!' : badge}</span>}
      </Link>
    );
  };

  return (
    <div className="app-container">
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>StockFlow</h2>
          <button className="menu-toggle" onClick={() => setIsSidebarOpen(false)}>
            <X size={24} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {user?.role === 'admin' && (
            <NavItem href="/" icon={LayoutDashboard} label="Tableau de Bord" badge={lowStockCount > 0} end />
          )}

          {user?.role === 'admin' && (
            <>
              <NavItem href="/articles" icon={Package} label="Articles" badge={lowStockCount} />
              <NavItem href="/mouvements" icon={ArrowRightLeft} label="Mouvements" />
              <NavItem href="/transfers" icon={ArrowRightLeft} label="Transferts" />
              <NavItem href="/fournisseurs" icon={Truck} label="Fournisseurs" />
              <NavItem href="/external-orders" icon={PackageOpen} label="Cmds Externes" />
              <NavItem href="/finances" icon={Coins} label="Finances" />
              <NavItem href="/payments" icon={Wallet} label="Règlements" />
              <NavItem href="/reports" icon={BarChart3} label="Rapports" />
              <NavItem href="/exercices" icon={Calendar} label="Exercices" />
            </>
          )}
          <NavItem href="/clients" icon={Users} label="Clients" />
          <NavItem href="/sales" icon={ShoppingCart} label="Ventes" />
          {user?.role === 'admin' && (
            <>
              <NavItem href="/stores" icon={Store} label="Magasins" />
              <NavItem href="/users" icon={UserCog} label="Utilisateurs" />
              <NavItem href="/audit" icon={ShieldAlert} label="Journal d'Audit" />
            </>
          )}
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
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
            <button onClick={toggleTheme} className="btn btn-secondary">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="user-profile">
              <div className="avatar" style={{ backgroundColor: user?.role === 'admin' ? 'var(--primary)' : 'var(--success)' }}>
                {user ? user.username[0].toUpperCase() : 'A'}
              </div>
              <span className="desktop-only" style={{ fontWeight: 600 }}>{user ? user.username : 'Admin'}</span>
            </div>
            <button onClick={handleLogoutClick} className="btn btn-secondary" style={{ color: 'var(--danger)' }}>
              <LogOut size={18} />
            </button>
          </div>
        </header>

        <div className="page-content">
          {lowStockCount > 0 && (
            <div className="sticky-alert-banner">
              <AlertCircle size={20} />
              <span>ALERTE STOCK CRITIQUE : {lowStockCount} article(s) à réapprovisionner</span>
              <Link href="/mouvements" style={{ color: 'white', marginLeft: 'auto', textDecoration: 'underline' }}>
                Gérer le stock
              </Link>
            </div>
          )}
          {children}
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
    </div>
  );
}
