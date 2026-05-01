'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../lib/storage';
import { 
  AlertTriangle, Package, Tags, ArrowRightLeft, Coins, 
  ChevronLeft, ChevronRight, BarChart2, PieChart as PieChartIcon, TrendingUp, Download 
} from 'lucide-react';
import { exportToExcel } from '../utils/excelExport';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
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
  const [currentPageLowStock, setCurrentPageLowStock] = useState(1);
  const itemsPerPageLowStock = 5;
  const [currentPageUnpaid, setCurrentPageUnpaid] = useState(1);
  const itemsPerPageUnpaid = 5;

  useEffect(() => {
    if (storage.getUser()?.role === 'vendeur') {
      window.location.href = '/sales';
      return;
    }
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const articles = await storage.get('articles');
      const mouvements = await storage.get('mouvements');
      const sales = await storage.get('sales');
      const apiStats = await storage.get('stats');

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const lowStock = articles
        .filter(a => Number(a.currentStock) <= Number(a.minStock))
        .sort((a, b) => a.name.localeCompare(b.name));
      const unpaid = sales.filter(s => s.status !== 'payé' && s.status !== 'annulée');

      const articleStats = {};
      const clientStats = {};

      sales.filter(s => s.status !== 'annulée').forEach(sale => {
        // Stats par client
        if (sale.clientName) {
          if (!clientStats[sale.clientName]) clientStats[sale.clientName] = { orders: 0, spent: 0 };
          clientStats[sale.clientName].orders += 1;
          clientStats[sale.clientName].spent += sale.totalAmount;
        }

        // Stats par produit
        if (sale.items) {
          sale.items.forEach(item => {
            const artName = item.articleName || 'Inconnu';
            if (!articleStats[artName]) articleStats[artName] = { qty: 0, revenue: 0 };
            articleStats[artName].qty += item.quantity;
            articleStats[artName].revenue += (item.quantity * item.unitPrice);
          });
        }
      });

      const topArticlesDetail = Object.entries(articleStats)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 8); // Top 8 products

      const topArticlesPie = topArticlesDetail.slice(0, 5).map(a => ({ name: a.name, value: a.qty }));

      const topClients = Object.entries(clientStats)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 5); // Top 5 clients

      setStats({
        totalArticles: articles.length,
        mouvementsCount: mouvements.filter(m => new Date(m.date) >= startOfMonth).length,
        totalSales: apiStats.totalRevenue || 0,
        lowStockArticles: lowStock,
        unpaidSales: unpaid,
        totalStockValue: apiStats.totalStockValue || 0,
        salesHistory: apiStats.salesHistory || [],
        topArticles: topArticlesPie,
        topArticlesDetail,
        topClients
      });
    } catch (err) { console.error(err); }
  };

  const handleExportLowStock = () => {
    const headers = [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Article' },
      { key: 'currentStock', label: 'Stock Actuel' },
      { key: 'minStock', label: 'Seuil d\'Alerte' }
    ];
    exportToExcel(stats.lowStockArticles, headers, 'articles_a_reapprovisionner');
  };

  const totalPagesLowStock = Math.ceil(stats.lowStockArticles.length / itemsPerPageLowStock);
  const currentLowStock = stats.lowStockArticles.slice((currentPageLowStock - 1) * itemsPerPageLowStock, currentPageLowStock * itemsPerPageLowStock);

  return (
    <div className={`page ${stats.lowStockArticles.length > 0 ? 'page-critical-alert' : ''}`}>
      {stats.lowStockArticles.length > 0 && (
        <div className="content-card" style={{ marginBottom: '2rem', border: '2px solid var(--danger)' }}>
          <div style={{ backgroundColor: 'var(--danger)', padding: '1rem', color: 'white', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={24} />
            <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>ARTICLES À RÉAPPROVISIONNER ({stats.lowStockArticles.length})</h2>
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
              <button className="btn btn-secondary" onClick={() => setCurrentPageLowStock(p => Math.max(p - 1, 1))} disabled={currentPageLowStock === 1}><ChevronLeft size={16} /></button>
              <span>Page {currentPageLowStock} / {totalPagesLowStock}</span>
              <button className="btn btn-secondary" onClick={() => setCurrentPageLowStock(p => Math.min(p + 1, totalPagesLowStock))} disabled={currentPageLowStock === totalPagesLowStock}><ChevronRight size={16} /></button>
            </div>
          )}
        </div>
      )}

      <div className="page-header"><div><h1>Tableau de Bord</h1><p>Mining AutoLog - État du système</p></div></div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}><Package size={24} /></div>
          <div className="stat-info"><div className="stat-value">{stats.totalArticles}</div><div className="stat-label">Articles</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}><TrendingUp size={24} /></div>
          <div className="stat-info"><div className="stat-value">{stats.totalSales.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>FCFA</span></div><div className="stat-label">CA Global</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}><Coins size={24} /></div>
          <div className="stat-info"><div className="stat-value" style={{ color: '#0369A1' }}>{stats.totalStockValue.toLocaleString()} <span style={{ fontSize: '0.8rem' }}>FCFA</span></div><div className="stat-label">Valeur du Stock</div></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}><AlertTriangle size={24} /></div>
          <div className="stat-info"><div className="stat-value text-danger">{stats.lowStockArticles.length}</div><div className="stat-label">Ruptures imminentes</div></div>
        </div>
      </div>

      <div className="charts-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', marginTop: '2rem' }}>
        <div className="content-card" style={{ height: '400px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 /> Ventes (7j)</h2>
          <ResponsiveContainer width="100%" height="85%">
            <LineChart data={stats.salesHistory}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={v => `${v/1000}k`} />
              <Tooltip />
              <Line type="monotone" dataKey="montant" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="content-card" style={{ height: '400px' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}><PieChartIcon /> Top Articles</h2>
          <ResponsiveContainer width="100%" height="85%">
            <PieChart>
              <Pie data={stats.topArticles} innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({name}) => name}>
                {stats.topArticles.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
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
                  {stats.topArticlesDetail.map((a, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 500 }}>{a.name}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-success">{a.qty}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{a.revenue.toLocaleString()} FCFA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                      <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 'bold' }}>{c.spent.toLocaleString()} FCFA</td>
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
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Coins size={18} /> Dettes à recouvrer ({stats.unpaidSales.length})
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
              exportToExcel(data, headers, 'dettes_clients');
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
                    <td className="text-danger-bold">{(s.totalAmount - s.amountPaid).toLocaleString()} FCFA</td>
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
