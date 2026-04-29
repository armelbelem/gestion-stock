import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { AlertTriangle, Package, Tags, ArrowRightLeft, Coins, ChevronLeft, ChevronRight, BarChart2, PieChart as PieChartIcon, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalArticles: 0,
    totalCategories: 0,
    mouvementsCount: 0,
    totalSales: 0,
    lowStockArticles: [],
    unpaidSales: [],
    totalStockValue: 0,
    salesHistory: [],
    topArticles: []
  });
  const [currentPageUnpaid, setCurrentPageUnpaid] = useState(1);
  const itemsPerPageUnpaid = 5;

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const articles = await storage.get('articles');
    const categories = await storage.get('categories');
    const mouvements = await storage.get('mouvements');
    const sales = await storage.get('sales');
    const apiStats = await storage.get('stats'); // Nouvelle API segmentée

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const mouvementsThisMonth = mouvements.filter(m => {
      const d = new Date(m.date);
      return d >= startOfMonth;
    });

    const lowStock = articles.filter(a => a.currentStock <= a.minStock);
    const unpaid = sales.filter(s => s.status !== 'payé' && s.status !== 'annulée');

    // --- Graphique 2: Top 5 Articles vendus ---
    const articleTotals = {};
    sales.filter(s => s.status !== 'annulée').forEach(sale => {
      if (sale.items) {
        sale.items.forEach(item => {
          articleTotals[item.articleName] = (articleTotals[item.articleName] || 0) + item.quantity;
        });
      }
    });

    const topArticles = Object.entries(articleTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    setStats({
      totalArticles: articles.length,
      totalCategories: categories.length,
      mouvementsCount: mouvementsThisMonth.length,
      totalSales: apiStats.totalRevenue || 0,
      lowStockArticles: lowStock,
      unpaidSales: unpaid,
      totalStockValue: apiStats.totalStockValue || 0,
      salesHistory: apiStats.salesHistory || [],
      topArticles
    });
    setCurrentPageUnpaid(1);
  };

  return (
    <div className={`page ${stats.lowStockArticles.length > 0 ? 'page-critical-alert' : ''}`}>
      {stats.lowStockArticles.length > 0 && (
        <div style={{
          backgroundColor: 'var(--danger)',
          color: 'white',
          padding: '1.5rem',
          borderRadius: 'var(--radius)',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          boxShadow: '0 10px 25px rgba(239, 68, 68, 0.4)',
          border: '2px solid white'
        }}>
          <AlertTriangle size={40} />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'white' }}>ATTENTION : STOCK CRITIQUE DÉTECTÉ</h2>
            <p style={{ margin: 0, opacity: 0.9 }}>{stats.lowStockArticles.length} article(s) sont descendus sous le seuil minimal de stock.</p>
          </div>
        </div>
      )}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Tableau de Bord</h1>
          <p>Aperçu général de votre activité</p>
        </div>
      </div>

      {/* Cartes de statistiques existantes */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--primary)' }}>
            <Package size={32} />
            {stats.totalArticles}
          </div>
          <div className="stat-label">Total Articles</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--primary-dark)' }}>
            <Tags size={32} />
            {stats.totalCategories}
          </div>
          <div className="stat-label">Total Catégories</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--success)' }}>
            <ArrowRightLeft size={32} />
            {stats.mouvementsCount}
          </div>
          <div className="stat-label">Mouvements ce mois</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--primary)', fontSize: '1.5rem' }}>
            <TrendingUp size={24} />
            {stats.totalSales.toLocaleString('fr-FR')} <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>FCFA</span>
          </div>
          <div className="stat-label">Chiffre d'Affaires Total</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: 'var(--success-dark)',
            fontSize: '1.5rem'
          }}>
            <Coins size={24} />
            {stats.totalStockValue.toLocaleString('fr-FR')} <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>FCFA</span>
          </div>
          <div className="stat-label">Valeur totale du stock</div>
        </div>

        <div className={`stat-card alert ${stats.lowStockArticles.length > 0 ? 'alert-pulse' : ''}`}>
          <div className="stat-value" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <AlertTriangle size={32} />
            {stats.lowStockArticles.length}
          </div>
          <div className="stat-label">Articles rupture imminente</div>
        </div>
      </div>

      {/* --- SECTION GRAPHIQUES (DASHBOARD 2.0) --- */}
      <div className="charts-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>

        {/* Graphique d'évolution des ventes */}
        <div className="content-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <BarChart2 size={20} />
            Évolution des Ventes (7j)
          </h2>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.salesHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-main)' }}
                  formatter={(value) => [`${value.toLocaleString()} FCFA`, 'Chiffre d\'Affaires']}
                />
                <Line
                  type="monotone"
                  dataKey="montant"
                  stroke="var(--primary)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: 'var(--primary)', strokeWidth: 2, stroke: 'var(--card-bg)' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique Top Articles */}
        <div className="content-card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)' }}>
            <PieChartIcon size={20} />
            Top 5 Articles Vendus
          </h2>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.topArticles}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {stats.topArticles.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Alertes de Stock (maintenues) */}
      {stats.lowStockArticles.length > 0 && (
        <div className="content-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
            <AlertTriangle size={20} />
            Alertes de Stock
          </h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Stock Actuel</th>
                  <th>Seuil Alerte</th>
                </tr>
              </thead>
              <tbody>
                {stats.lowStockArticles.map(article => (
                  <tr key={article.id} className="tr-danger">
                    <td style={{ fontWeight: 600 }}>{article.name}</td>
                    <td className="text-danger-bold">{article.currentStock}</td>
                    <td className="text-muted">{article.minStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Ventes en attente (maintenues) */}
      {stats.unpaidSales.length > 0 && (
        <div className="content-card" style={{ marginTop: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
            <Coins size={20} />
            Ventes en attente de paiement (Dettes)
          </h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>Solde Restant</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.unpaidSales.slice((currentPageUnpaid - 1) * itemsPerPageUnpaid, currentPageUnpaid * itemsPerPageUnpaid).map(sale => (
                  <tr key={sale.id}>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      #{sale.id.substring(0, 8).toUpperCase()}
                    </td>
                    <td>{sale.clientName}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                      {(sale.totalAmount - sale.amountPaid).toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="text-muted">
                      {new Date(sale.date).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {stats.unpaidSales.length > itemsPerPageUnpaid && (
            <div className="pagination" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              borderTop: '1px solid var(--border-color)',
              backgroundColor: 'var(--primary-light)',
              borderRadius: '0 0 8px 8px',
              marginTop: '0'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--primary-dark)', fontWeight: 500 }}>
                {stats.unpaidSales.length} dettes au total
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  className="btn btn-primary-light btn-sm"
                  onClick={() => setCurrentPageUnpaid(prev => Math.max(prev - 1, 1))}
                  disabled={currentPageUnpaid === 1}
                  style={{ padding: '0.2rem 0.4rem', backgroundColor: 'var(--surface)', border: '1px solid var(--primary)' }}
                >
                  <ChevronLeft size={14} color="var(--primary)" />
                </button>

                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary-dark)' }}>
                  {currentPageUnpaid} / {Math.ceil(stats.unpaidSales.length / itemsPerPageUnpaid)}
                </span>

                <button
                  className="btn btn-primary-light btn-sm"
                  onClick={() => setCurrentPageUnpaid(prev => Math.min(prev + 1, Math.ceil(stats.unpaidSales.length / itemsPerPageUnpaid)))}
                  disabled={currentPageUnpaid === Math.ceil(stats.unpaidSales.length / itemsPerPageUnpaid)}
                  style={{ padding: '0.2rem 0.4rem', backgroundColor: 'var(--surface)', border: '1px solid var(--primary)' }}
                >
                  <ChevronRight size={14} color="var(--primary)" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Dashboard;
