'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../lib/storage';
import { 
  Loader2, AlertTriangle, Package, Tags, ArrowRightLeft, Coins, 
  ChevronLeft, ChevronRight, BarChart2, PieChart as PieChartIcon, TrendingUp, Download, Globe, RefreshCw,
  ArrowUp, ArrowDown
} from 'lucide-react';
import { exportToExcel } from '../utils/excelExport';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

import { useRouter } from 'next/navigation';
import { useAuth } from '../providers';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalArticles: 0,
    totalCategories: 0,
    mouvementsCount: 0,
    totalSales: 0,
    lowStockArticles: [],
    lowStockTotal: 0,
    unpaidSales: [],
    totalStockValue: 0,
    salesHistory: [],
    topArticles: []
  });
  const [currentPageLowStock, setCurrentPageLowStock] = useState(1);
  const itemsPerPageLowStock = 5;
  const [currentPageUnpaid, setCurrentPageUnpaid] = useState(1);
  const itemsPerPageUnpaid = 5;
  const [currentPageTopArticles, setCurrentPageTopArticles] = useState(1);
  const itemsPerPageTopArticles = 6;
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasActiveYear, setHasActiveYear] = useState(true);
  const [settings, setSettings] = useState(null);
  const [isMounted, setIsMounted] = useState(false);
  const { user, apiStatus } = useAuth();
  
  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  useEffect(() => {
    if (!user) return; // Attendre que l'utilisateur soit chargé
    
    if (user.role === 'vendeur' || user.role === 'vendeurs') {
      router.push('/sales');
      return;
    }
    
    loadStats();
    setIsMounted(true);
  }, [user, router]);

  useEffect(() => {
    const checkFY = async () => {
      try {
        const fy = await storage.get('fiscal-years');
        const active = fy.some(f => f.status === 'active');
        setHasActiveYear(active);
      } catch (e) { console.error(e); }
    };
    checkFY();
  }, []);

  useEffect(() => {
    const hasShownWelcome = sessionStorage.getItem('welcomeShown');
    if (!hasShownWelcome && user) {
      setShowWelcome(true);
      sessionStorage.setItem('welcomeShown', 'true');
      setTimeout(() => setShowWelcome(false), 10500);
    }
    
    const loadSettings = async () => {
      try {
        const data = await storage.get('settings');
        setSettings(data);
      } catch (e) { console.error(e); }
    };
    loadSettings();
  }, [user]);

  const loadStats = async (page = 1) => {
    const targetPage = typeof page === 'number' ? page : 1;
    try {
      const apiStats = await storage.get(`stats?lowStockPage=${targetPage}&lowStockLimit=${itemsPerPageLowStock}`);
      
      setStats({
        totalArticles: apiStats.totalArticles || 0,
        mouvementsCount: apiStats.mouvementsCount || 0,
        totalSales: apiStats.totalRevenue || 0,
        revenuePhysical: apiStats.revenuePhysical || 0,
        purchaseVirtual: apiStats.purchaseVirtual || 0,
        lowStockArticles: apiStats.lowStockArticles || [],
        lowStockTotal: apiStats.lowStockTotal || 0,
        unpaidSales: apiStats.unpaidSales || [],
        totalStockValue: apiStats.totalStockValue || 0,
        salesHistory: apiStats.salesHistory || [],
        topArticles: apiStats.topArticles || [],
        topArticlesDetail: apiStats.topArticlesDetail || [],
        topClients: apiStats.topClients || []
      });
      
      setHasActiveYear(apiStats.hasActiveYear !== false);
    } catch (err) { 
      console.error("Dashboard data load error:", err);
      // Fallback empty stats to prevent crash
      setStats(prev => ({ ...prev, lowStockArticles: [], lowStockTotal: 0, unpaidSales: [] }));
    }
  };

  const handleExportLowStock = async () => {
    try {
      // Fetch full list of low stock articles specifically for on-demand Excel export
      const data = await storage.get(`stats?lowStockPage=1&lowStockLimit=10000`);
      const allLowStock = data.lowStockArticles || [];
      const headers = [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Article' },
        { key: 'currentStock', label: 'Stock Actuel' },
        { key: 'minStock', label: 'Seuil d\'Alerte' }
      ];
      exportToExcel(allLowStock, headers, 'articles_a_reapprovisionner');
    } catch (err) {
      console.error("Failed to export low stock articles:", err);
    }
  };

  const totalPagesLowStock = Math.ceil(stats.lowStockTotal / itemsPerPageLowStock);
  const currentLowStock = stats.lowStockArticles;

  const handleLowStockPageChange = async (newPage) => {
    setCurrentPageLowStock(newPage);
    await loadStats(newPage);
  };

  return (
    <div className={`page ${stats.lowStockTotal > 0 ? 'page-critical-alert' : ''}`}>
      {showWelcome && (
        <div className="welcome-overlay">
          <div className="welcome-card">
            {settings?.logo ? (
              <img src={settings.logo} alt="Logo" className="welcome-logo" />
            ) : (
              <div className="welcome-icon">👋</div>
            )}
            <h1 className="welcome-title" style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Bienvenue chez <span style={{color: '#991b1b'}}>{settings?.companyName ? settings.companyName.replace('SARL', 'PART') : 'NS AUTO PART'}</span> !
            </h1>
            <p className="welcome-text">
              Ravi de vous revoir, <strong>{user?.name || user?.username || 'armel'}</strong>. <br />
              Excellente journée de travail !
            </p>

            <div className="welcome-loader">
              <Loader2 size={16} className="animate-spin" />
              Préparation de votre tableau de bord...
            </div>

            <div className="welcome-progress-container">
              <div className="welcome-progress-bar"></div>
            </div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1>Tableau de Bord</h1>
          <p>Mining AutoLog - État du système</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={loadStats}
            title="Actualiser les données"
            style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
          >
            <RefreshCw size={14} className={apiStatus === 'warning' ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <div className={`health-indicator ${apiStatus}`}>
            <div className="health-dot"></div>
            <span>
              {apiStatus === 'healthy' ? 'Système Stable' : apiStatus === 'warning' ? 'Système Ralenti' : 'Serveur Indisponible'}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '2rem' }}>
        {/* Total Articles Card */}
        <div className="stat-card stat-card-premium bg-gradient-blue">
          <div className="stat-icon-bg"><Package size={48} /></div>
          <div className="stat-label">Total Articles</div>
          <div className="stat-value">{stats.totalArticles.toLocaleString()}</div>
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: '70%' }}></div>
          </div>
          <div className="card-trend">
            <ArrowUp size={14} /> <span>+2.5%</span> <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: '4px' }}>ce mois</span>
          </div>
        </div>
        
        {/* Revenue Card */}
        <div className="stat-card stat-card-premium bg-gradient-green">
          <div className="stat-icon-bg"><TrendingUp size={48} /></div>
          <div className="stat-label">Chiffre d'Affaires</div>
          <div className="stat-value">
            {formatPrice(stats.revenuePhysical || 0)} 
            <span style={{ fontSize: '1rem', marginLeft: '8px', opacity: 0.9 }}>FCFA</span>
          </div>
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: '85%' }}></div>
          </div>
          <div className="card-trend">
            <ArrowUp size={14} /> <span>+12.3%</span> <span style={{ opacity: 0.7, fontWeight: 400, marginLeft: '4px' }}>vs mois dernier</span>
          </div>
        </div>

        {/* Stock Value Card */}
        <div className="stat-card stat-card-premium bg-gradient-orange">
          <div className="stat-icon-bg"><Coins size={48} /></div>
          <div className="stat-label">Valeur vente stock/ CA potentiel</div>
          <div className="stat-value">
            {formatPrice(stats.totalStockValue)} 
            <span style={{ fontSize: '1rem', marginLeft: '8px', opacity: 0.9 }}>FCFA</span>
          </div>
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: '45%' }}></div>
          </div>
          <div className="card-trend">
             <span style={{ opacity: 0.9, fontWeight: 500 }}>Patrimoine potentiel</span>
          </div>
        </div>

        {/* Low Stock Card */}
        <div className="stat-card stat-card-premium bg-gradient-red">
          <div className="stat-icon-bg"><AlertTriangle size={48} /></div>
          <div className="stat-label">Ruptures Imminentes</div>
          <div className="stat-value">{stats.lowStockTotal}</div>
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: stats.lowStockTotal > 0 ? '100%' : '0%' }}></div>
          </div>
          <div className="card-trend">
            <ArrowDown size={14} /> <span>Action requise</span>
          </div>
        </div>
      </div>

      {stats.lowStockTotal > 0 && (
        <div className="content-card" style={{ marginBottom: '2rem', border: '2px solid var(--danger)' }}>
          <div style={{ backgroundColor: 'var(--danger)', padding: '1rem', color: 'white', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={24} />
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>ARTICLES À RÉAPPROVISIONNER ({stats.lowStockTotal})</h2>
            <button className="btn btn-secondary btn-sm" onClick={handleExportLowStock} style={{ marginLeft: 'auto', backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', color: 'white' }}>
              <Download size={14} /> Exporter
            </button>
          </div>
          <div className="table-wrapper" style={{ padding: '1rem' }}>
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Article</th>
                  <th>Stock Actuel</th>
                  <th>Seuil d'Alerte</th>
                </tr>
              </thead>
              <tbody>
                {currentLowStock.map(a => (
                  <tr key={a.id}>
                    <td>{a.code || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{a.name}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{a.currentStock}</td>
                    <td className="text-muted">{a.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPagesLowStock > 1 && (
            <div className="pagination" style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={() => handleLowStockPageChange(currentPageLowStock - 1)} disabled={currentPageLowStock === 1}><ChevronLeft size={16} /></button>
              <span>Page {currentPageLowStock} / {totalPagesLowStock}</span>
              <button className="btn btn-secondary" onClick={() => handleLowStockPageChange(currentPageLowStock + 1)} disabled={currentPageLowStock === totalPagesLowStock}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}

      {/* Alerte Exercice Fiscal manquant */}
      {!hasActiveYear && (
        <div style={{ 
          backgroundColor: '#fff7ed', 
          border: '1px solid #ffedd5', 
          borderRadius: '12px', 
          padding: '1.5rem', 
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          color: '#9a3412'
        }}>
          <div style={{ 
            backgroundColor: '#ffedd5', 
            padding: '1rem', 
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle size={32} color="#ea580c" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>Attention : Aucun exercice fiscal actif</h3>
            <p style={{ margin: '0.25rem 0 0', opacity: 0.9 }}>
              Le système est actuellement en attente d'ouverture d'un nouvel exercice. 
              Les ventes et rapports financiers ne seront pas enregistrés tant qu'un exercice n'est pas ouvert.
            </p>
          </div>
          <button 
            className="btn btn-primary"
            onClick={() => router.push('/settings')}
            style={{ backgroundColor: '#ea580c', borderColor: '#ea580c' }}
          >
            Ouvrir un exercice
          </button>
        </div>
      )}


      <div className="charts-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        <div className="content-card" style={{ height: '400px', minHeight: '400px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 /> Ventes (30j)</h2>
          {isMounted && (
            <ResponsiveContainer width="100%" height="85%">
              <LineChart data={stats.salesHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={v => `${v/1000}k`} />
                <Tooltip />
                <Line type="monotone" dataKey="montant" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="content-card" style={{ height: '400px', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><PieChartIcon /> Top Articles</h2>
          {isMounted && stats.topArticles.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={stats.topArticles.filter(a => a.value > 0)} 
                  innerRadius={60} 
                  outerRadius={90} 
                  paddingAngle={5} 
                  dataKey="value"
                  cx="50%"
                  cy="45%"
                  label={({name, percent}) => `${name.substring(0, 15)}... (${(percent * 100).toFixed(0)}%)`}
                >
                  {stats.topArticles.map((e, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Aucune donnée de vente disponible
            </div>
          )}
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        {stats.topArticlesDetail && stats.topArticlesDetail.length > 0 && (
          <div className="content-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Package /> Produits les plus consommés</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Produit</th>
                    <th style={{ textAlign: 'center' }}>Qté Vendue</th>
                    <th style={{ textAlign: 'right' }}>Chiffre d'Affaires</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topArticlesDetail.slice((currentPageTopArticles - 1) * itemsPerPageTopArticles, currentPageTopArticles * itemsPerPageTopArticles).map((a, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{a.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-success">{a.qty}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(a.revenue)} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.ceil(stats.topArticlesDetail.length / itemsPerPageTopArticles) > 1 && (
              <div className="pagination" style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-secondary" onClick={() => setCurrentPageTopArticles(p => Math.max(p - 1, 1))} disabled={currentPageTopArticles === 1}><ChevronLeft size={16} /></button>
                <span>Page {currentPageTopArticles} / {Math.ceil(stats.topArticlesDetail.length / itemsPerPageTopArticles)}</span>
                <button className="btn btn-secondary" onClick={() => setCurrentPageTopArticles(p => Math.min(p + 1, Math.ceil(stats.topArticlesDetail.length / itemsPerPageTopArticles)))} disabled={currentPageTopArticles === Math.ceil(stats.topArticlesDetail.length / itemsPerPageTopArticles)}><ChevronRight size={16} /></button>
              </div>
            )}
          </div>
        )}

        {stats.topClients && stats.topClients.length > 0 && (
          <div className="content-card">
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 /> Meilleurs Clients</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th style={{ textAlign: 'center' }}>Commandes</th>
                    <th style={{ textAlign: 'right' }}>Total Dépensé</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topClients.map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td style={{ textAlign: 'center' }}>{c.orders}</td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 'bold' }}>{formatPrice(c.spent)} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {stats.unpaidSales && stats.unpaidSales.length > 0 && (
        <div className="content-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={18} /> Ventes non réglées ({stats.unpaidSales.length})
            <button className="btn btn-secondary btn-sm" onClick={() => {
              const headers = [
                { key: 'ref', label: 'Référence' },
                { key: 'clientName', label: 'Client' },
                { key: 'debt', label: 'Dette' },
                { key: 'date', label: 'Date' }
              ];
              const data = stats.unpaidSales.map(s => ({
                ...s,
                ref: `#${s.id.substring(0,8).toUpperCase()}`,
                debt: s.totalAmount - s.amountPaid,
                date: new Date(s.date).toLocaleDateString()
              }));
              exportToExcel(data, headers, 'consommations_clients');
            }} style={{ marginLeft: 'auto' }}>
              <Download size={14} /> Exporter
            </button>
          </h2>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Référence</th><th>Client</th><th>Reste à payer</th><th>Date</th></tr></thead>
              <tbody>
                {stats.unpaidSales.slice((currentPageUnpaid-1)*itemsPerPageUnpaid, currentPageUnpaid*itemsPerPageUnpaid).map(s => (
                  <tr key={s.id}>
                    <td><strong>#{s.id.substring(0,8).toUpperCase()}</strong></td>
                    <td>{s.clientName}</td>
                    <td className="text-danger-bold">{formatPrice(s.totalAmount - s.amountPaid)} FCFA</td>
                    <td className="text-muted">{new Date(s.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {Math.ceil(stats.unpaidSales.length / itemsPerPageUnpaid) > 1 && (
            <div className="pagination" style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-secondary" onClick={() => setCurrentPageUnpaid(p => Math.max(p - 1, 1))} disabled={currentPageUnpaid === 1}><ChevronLeft size={16} /></button>
              <span>Page {currentPageUnpaid} / {Math.ceil(stats.unpaidSales.length / itemsPerPageUnpaid)}</span>
              <button className="btn btn-secondary" onClick={() => setCurrentPageUnpaid(p => Math.min(p + 1, Math.ceil(stats.unpaidSales.length / itemsPerPageUnpaid)))} disabled={currentPageUnpaid === Math.ceil(stats.unpaidSales.length / itemsPerPageUnpaid)}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
