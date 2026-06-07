'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  LineChart, Line 
} from 'recharts';
import { 
  Download, Printer, FileSpreadsheet, Search, TrendingUp, Users, DollarSign, ArrowUpDown
} from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';

export default function ReportingVendeurs() {
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [timeUnit, setTimeUnit] = useState('day');
  
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({ globalSales: 0, globalRevenue: 0 });
  const [chartData, setChartData] = useState([]);
  const [chartSellers, setChartSellers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  
  // Pagination & sorting
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortCol, setSortCol] = useState('totalRevenue');
  const [sortOrder, setSortOrder] = useState('desc');

  const fetchReports = async () => {
    setLoading(true);
    try {
      // Main Data
      let url = `/api/reports/sellers?period=${period}&page=${page}&sortColumn=${sortCol}&sortOrder=${sortOrder}`;
      if (period === 'custom') {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const res = await fetch(url);
      const result = await res.json();
      
      if (result.success) {
        setData(result.data);
        setSummary(result.summary);
        setTotalPages(result.pagination.totalPages || 1);
      }

      // Charts Data
      let chartUrl = `/api/reports/sellers/charts?period=${period}&timeUnit=${timeUnit}`;
      if (period === 'custom') {
        chartUrl += `&startDate=${startDate}&endDate=${endDate}`;
      }
      const chartRes = await fetch(chartUrl);
      const chartResult = await chartRes.json();
      if (chartResult.success) {
        setChartData(chartResult.data);
        setChartSellers(chartResult.sellers);
      }
      
    } catch (error) {
      console.error('Failed to fetch reporting data', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [period, startDate, endDate, page, sortCol, sortOrder, timeUnit]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortCol(col);
      setSortOrder('desc');
    }
  };

  const exportExcel = () => {
    const headers = [
      { key: 'sellerName', label: 'Vendeur' },
      { key: 'totalSales', label: 'Ventes Totales' },
      { key: 'totalProductsSold', label: 'Produits Vendus' },
      { key: 'totalRevenue', label: 'Chiffre d\'Affaires (FCFA)' }
    ];

    const exportData = data.map(d => ({
      ...d,
      totalRevenue: Number(d.totalRevenue)
    }));

    exportToExcel(exportData, headers, `Performances_Vendeurs_${new Date().toISOString().slice(0, 10)}`, {
      title: "Performances Vendeurs - Classement Détaillé",
      period: period === 'custom' ? `${startDate} au ${endDate}` : period
    });
  };

  const printReport = () => {
    window.print();
  };

  // Modern UI Colors
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="page">
      <div className="page-header print:hidden">
        <div>
          <h1>Performances Vendeurs</h1>
          <p>Analyse détaillée des ventes par collaborateur</p>
        </div>
        
        <div className="header-actions">
          <button onClick={exportExcel} className="btn btn-secondary">
            <FileSpreadsheet className="nav-icon" size={18} />
            Excel
          </button>
          <button onClick={printReport} className="btn btn-secondary">
            <Printer className="nav-icon" size={18} />
            Imprimer / PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="content-card print:hidden" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label className="form-label">Période</label>
          <select 
            value={period} 
            onChange={(e) => setPeriod(e.target.value)}
            className="form-control"
            style={{ width: '200px' }}
          >
            <option value="today">Aujourd'hui</option>
            <option value="week">Cette semaine</option>
            <option value="month">Ce mois</option>
            <option value="year">Cette année</option>
            <option value="custom">Personnalisée</option>
            <option value="all">Tout</option>
          </select>
        </div>

        {period === 'custom' && (
          <>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Du</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-control" style={{ width: '160px' }} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Au</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-control" style={{ width: '160px' }} />
            </div>
          </>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="stat-card stat-card-premium bg-gradient-purple" style={{ flex: '0 1 350px', width: '350px' }}>
          <div className="stat-icon-bg">
            <Users size={48} />
          </div>
          <span className="stat-label">Meilleur Vendeur</span>
          <span className="stat-value" style={{ fontSize: '1.5rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {data.length > 0 ? data[0].sellerName : '-'}
          </span>
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: '100%' }}></div>
          </div>
          <div className="card-trend">
            {data.length > 0 ? `${Number(data[0].totalRevenue).toLocaleString('fr-FR')} FCFA` : 'Aucune vente'}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', margin: '2rem 0' }}>
        <div className="content-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>Évolution du Chiffre d'Affaires</h3>
            <select 
              value={timeUnit} 
              onChange={(e) => setTimeUnit(e.target.value)}
              className="form-control print:hidden"
              style={{ width: '120px', padding: '0.375rem 0.75rem' }}
            >
              <option value="day">Jour</option>
              <option value="week">Semaine</option>
              <option value="month">Mois</option>
              <option value="year">Année</option>
            </select>
          </div>
          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="timeLabel" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} dx={-10} tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`} />
                <RechartsTooltip cursor={{fill: 'var(--bg-light)'}} contentStyle={{backgroundColor: 'var(--surface)', color: 'var(--text-main)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)'}} />
                <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
                {chartSellers.map((seller, index) => (
                  <Bar 
                    key={seller} 
                    name={seller}
                    dataKey={`${seller}_revenue`} 
                    fill={colors[index % colors.length]} 
                    radius={[4, 4, 0, 0]}
                    barSize={30}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="content-card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.5rem' }}>Comparaison des Ventes par Vendeur</h3>
          <div style={{ height: '320px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="sellerName" axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-muted)', fontSize: 12}} dx={-10} />
                <RechartsTooltip cursor={{fill: 'var(--bg-light)'}} contentStyle={{backgroundColor: 'var(--surface)', color: 'var(--text-main)', borderRadius: '8px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-md)'}} />
                <Bar dataKey="totalSales" name="Ventes" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="content-card" style={{ padding: 0, overflow: 'hidden', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' }}>Classement Détaillé</h3>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('sellerName')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Vendeur <ArrowUpDown size={14} /></div>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalSales')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Ventes <ArrowUpDown size={14} /></div>
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('totalProductsSold')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>Produits Vendus <ArrowUpDown size={14} /></div>
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'right' }} onClick={() => handleSort('totalRevenue')}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>Chiffre d'Affaires <ArrowUpDown size={14} /></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Aucune donnée pour cette période.</td></tr>
              ) : (
                data.map((row, i) => (
                  <tr key={row.sellerId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                          {row.sellerName.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{row.sellerName}</span>
                      </div>
                    </td>
                    <td>{row.totalSales}</td>
                    <td>{row.totalProductsSold}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{Number(row.totalRevenue).toLocaleString('fr-FR')} FCFA</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="pagination print:hidden" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)' }}>
          <span>Page {page} sur {totalPages || 1}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="btn btn-secondary"
            >
              Précédent
            </button>
            <button 
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="btn btn-secondary"
            >
              Suivant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
