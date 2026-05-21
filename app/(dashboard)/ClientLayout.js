'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Tags, Package, ArrowRightLeft, LogOut, 
  Users, ShoppingCart, Sun, Moon, UserCog, Coins, BarChart3, 
  Truck, Menu, X, Wallet, AlertCircle, Calendar, Store, ShieldAlert, PackageOpen, Settings, Brain, TrendingDown, Globe, Archive, Search,
  FileText
} from 'lucide-react';
import { useAuth } from '../providers';
import { storage } from '../lib/storage';
import { hasPermission } from '../lib/auth';
import AlertModal from '../components/AlertModal';
import GlobalSearch from '../components/GlobalSearch';

const routePermissions = [
  { path: '/articles', category: 'stock', action: 'view' },
  { path: '/mouvements', category: 'stock', action: 'move' },
  { path: '/transfers', category: 'stock', action: 'move' },
  { path: '/fournisseurs', category: 'procurement', action: 'view' },
  { path: '/external-orders', category: 'procurement', action: 'view' },
  { path: '/contract-gateway', category: 'procurement', action: 'view' },
  { path: '/documents-bl-bc', category: 'procurement', action: 'view' },
  { path: '/finances', category: 'finances', action: 'view' },
  { path: '/payments', category: 'finances', action: 'view' },
  { path: '/reports', category: 'finances', action: 'view' },
  { path: '/intelligence', category: 'finances', action: 'view' },
  { path: '/archives', category: 'admin', action: 'settings' },
  { path: '/exercices', category: 'admin', action: 'settings' },
  { path: '/stores', category: 'admin', action: 'settings' },
  { path: '/clients', category: 'clients', action: 'view' },
  { path: '/settings', category: 'admin', action: 'settings' },
  { path: '/users', category: 'admin', action: 'users' },
  { path: '/activity-logs', category: 'admin', action: 'logs' },
  { path: '/', category: 'finances', action: 'view' },
];

export default function ClientLayout({ children }) {
  const { user, logout, apiStatus } = useAuth();
  const pathname = usePathname();
  const [theme, setTheme] = useState('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [activeYear, setActiveYear] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedStore, setSelectedStore] = useState('');
  const [settings, setSettings] = useState(null);

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
  }, [pathname]);

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

        const settingsData = await storage.get('settings');
        setSettings(settingsData);
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

  const router = useRouter();

  // Calcul synchrone de l'autorisation pour éviter le "flash" de contenu interdit
  const isAuthorized = (() => {
    if (!user) return true; // On attend que useAuth nous donne l'utilisateur
    const route = routePermissions.find(rp => pathname === rp.path || (rp.path !== '/' && pathname.startsWith(rp.path)));
    if (route) {
      return hasPermission(user, route.category, route.action);
    }
    return true;
  })();

  // Effet pour la redirection effective
  useEffect(() => {
    if (user && !isAuthorized) {
      console.warn(`Access denied for ${user.role} on ${pathname}. Redirecting...`);
      router.push('/sales');
    }
  }, [isAuthorized, user, pathname, router]);

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

  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (err) {
      console.error("Error fetching notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-container">
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'active' : ''}`}
        onClick={() => setIsSidebarOpen(false)}
      ></div>

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ height: 'auto', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
          {settings?.logo && (
            <img src={settings.logo} alt="Logo" style={{ maxHeight: '50px', maxWidth: '100%', objectFit: 'contain' }} />
          )}
          <h2 style={{ fontSize: '1.2rem', textAlign: 'center', color: '#991b1b', fontWeight: '800' }}>
            NS AUTO
          </h2>
          <button className="menu-toggle" onClick={() => setIsSidebarOpen(false)} style={{ position: 'absolute', right: '10px', top: '10px' }}>
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav">
          {hasPermission(user, 'finances', 'view') && (
            <NavItem href="/" icon={LayoutDashboard} label="Tableau de Bord" badge={lowStockCount > 0} end />
          )}

          {hasPermission(user, 'stock', 'view') && (
            <NavItem href="/articles" icon={Package} label="Articles" badge={lowStockCount} />
          )}

          {hasPermission(user, 'stock', 'move') && (
            <>
              <NavItem href="/mouvements" icon={ArrowRightLeft} label="Mouvements" />
              <NavItem href="/transfers" icon={ArrowRightLeft} label="Transferts" />
            </>
          )}

          {(hasPermission(user, 'procurement', 'view') || hasPermission(user, 'stock', 'view_cost_price')) && (
            <>
              <NavItem href="/fournisseurs" icon={Truck} label="Fournisseurs" />
              <NavItem href="/external-orders" icon={PackageOpen} label="Commandes Spéciales" />
              <NavItem href="/contract-gateway" icon={Globe} label="Achats Partenaires" />
              <NavItem href="/documents-bl-bc" icon={FileText} label="Centralisation BL/BC" />
            </>
          )}

          {hasPermission(user, 'finances', 'view') && (
            <>
              {/* <NavItem href="/finances" icon={Coins} label="Finances" /> */}
              <NavItem href="/payments" icon={Wallet} label="Règlements" />
              <NavItem href="/reports" icon={BarChart3} label="Rapports" />
              <NavItem href="/intelligence" icon={Brain} label="Intelligence" />
            </>
          )}

          {hasPermission(user, 'admin', 'settings') && (
            <>
              <NavItem href="/archives" icon={Archive} label="Archives" />
              <NavItem href="/exercices" icon={Calendar} label="Exercices" />
              <NavItem href="/stores" icon={Store} label="Magasins" />
            </>
          )}

          {hasPermission(user, 'clients', 'view') && (
            <NavItem href="/clients" icon={Users} label="Clients" />
          )}
          <NavItem href="/sales" icon={ShoppingCart} label="Ventes" />

          {hasPermission(user, 'admin', 'settings') && (
            <NavItem href="/settings" icon={Settings} label="Paramètres" />
          )}
          {hasPermission(user, 'admin', 'users') && (
            <NavItem href="/users" icon={UserCog} label="Utilisateurs" />
          )}
          {hasPermission(user, 'admin', 'logs') && (
            <NavItem href="/activity-logs" icon={ShieldAlert} label="Journal d'Activité" />
          )}
        </nav>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button className="menu-toggle" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div className="header-title">
              <span style={{color: '#991b1b', fontWeight: '800'}}>NS AUTO</span> <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>Global Manager</span>
            </div>
            {activeYear && (
              <div className="badge badge-primary" style={{ marginLeft: '1rem', fontSize: '0.8rem', padding: '4px 10px' }}>
                <Calendar size={12} style={{ marginRight: '4px' }} />
                {activeYear.name}
              </div>
            )}
            
            {(user?.role === 'admin' || user?.role === 'gestionnaire') && (
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
            
            <div className={`health-indicator desktop-only ${apiStatus}`} style={{ marginRight: '0.5rem' }}>
              <div className="health-dot"></div>
              <span style={{ fontSize: '0.7rem' }}>
                {apiStatus === 'healthy' ? 'En ligne' : apiStatus === 'warning' ? 'Lent' : 'Déconnecté'}
              </span>
            </div>
            
            {/* Notification Bell */}
            <div className="notification-bell-wrapper">
              <button 
                className="btn btn-secondary" 
                style={{ position: 'relative' }}
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <ShieldAlert size={18} color={notifications.length > 0 ? 'var(--danger)' : 'currentColor'} />
                {notifications.length > 0 && <span className="badge-alert" style={{ top: '-5px', right: '-5px' }}>{notifications.length}</span>}
              </button>

              {showNotifications && (
                <>
                  <div className="modal-overlay" style={{ background: 'transparent' }} onClick={() => setShowNotifications(false)}></div>
                  <div className="notification-dropdown">
                    <div className="notification-header">
                      <h4>Notifications ({notifications.length})</h4>
                      <button className="btn btn-secondary btn-sm" onClick={fetchNotifications}><ArrowRightLeft size={14} /></button>
                    </div>
                    <div className="notification-list">
                      {notifications.length === 0 ? (
                        <div className="notification-empty">Aucune alerte pour le moment.</div>
                      ) : (
                        notifications.map(n => (
                          <Link key={n.id} href={n.link} className="notification-item" onClick={() => setShowNotifications(false)}>
                            <div className={`notification-icon ${n.type}`}>
                              <AlertCircle size={18} />
                            </div>
                            <div className="notification-content">
                              <div className="notification-title">{n.title}</div>
                              <div className="notification-message">{n.message}</div>
                              <div className="notification-time">{new Date(n.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button onClick={toggleTheme} className="btn btn-secondary">
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="user-profile">
              <div className="avatar" style={{ backgroundColor: (user?.role === 'admin' || user?.role === 'gestionnaire') ? 'var(--primary)' : 'var(--success)' }}>
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
            <div className="sticky-alert-banner no-print">
              <AlertCircle size={20} />
              <span>ALERTE STOCK CRITIQUE : {lowStockCount} article(s) à réapprovisionner</span>
              <Link href="/mouvements" style={{ color: 'white', marginLeft: 'auto', textDecoration: 'underline' }}>
                Gérer le stock
              </Link>
            </div>
          )}
          
          {isAuthorized ? children : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '1rem' }}>
              <div className="spinner"></div>
              <p className="text-muted">Accès restreint, redirection en cours...</p>
            </div>
          )}
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

      <GlobalSearch />
    </div>
  );
}
