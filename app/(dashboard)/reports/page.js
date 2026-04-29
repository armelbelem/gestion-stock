'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { BarChart3, Download, TrendingUp, TrendingDown } from 'lucide-react';

export default function ReportsPage() {
  const [reportData, setReportData] = useState({ months: [], totalDebt: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReport(); }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await storage.get('reports/monthly');
      if (Array.isArray(data)) setReportData({ months: data, totalDebt: 0, totalRevenue: 0 });
      else setReportData({ months: data.months || [], totalDebt: data.totalDebt || 0, totalRevenue: data.totalRevenue || 0 });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleDownloadPDF = async (month) => {
    try {
      const storeId = localStorage.getItem('selectedStore');
      const token = sessionStorage.getItem('token');
      const url = `/api/reports/pdf?month=${month}${storeId !== 'all' && storeId ? `&storeId=${storeId}` : ''}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error("Erreur PDF");
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = window.URL.createObjectURL(blob);
      link.download = `Bilan_${month}.pdf`;
      link.click();
    } catch (err) { alert(err.message); }
  };

  const getMonthName = (m) => {
    if (!m) return '-';
    const [y, mm] = m.split('-');
    return new Date(y, parseInt(mm)-1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const maxVal = Math.max(...reportData.months.map(d => Math.max(d.revenue, d.cash)), 1);

  return (
    <div className="page">
      <div className="page-header"><div><h1>Rapports Financiers</h1><p>Analyse des revenus vs encaissements</p></div></div>
      {loading ? <p>Chargement...</p> : (
        <>
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--primary)' }}>{reportData.totalRevenue.toLocaleString()} FCFA</div>
              <div className="stat-label">Chiffre d'Affaires Total</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{reportData.totalDebt.toLocaleString()} FCFA</div>
              <div className="stat-label">Dette Globale</div>
            </div>
          </div>

          <div className="content-card" style={{ marginTop: '2rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem' }}><BarChart3 /> Performance Mensuelle</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', height: '250px', overflowX: 'auto', padding: '1rem' }}>
              {reportData.months.slice().reverse().map(d => (
                <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', height: '100%', alignItems: 'flex-end' }}>
                    <div style={{ width: '15px', height: `${(d.revenue/maxVal)*100}%`, backgroundColor: 'var(--primary)', borderRadius: '2px' }} title={`CA: ${d.revenue}`} />
                    <div style={{ width: '15px', height: `${(d.cash/maxVal)*100}%`, backgroundColor: 'var(--success)', borderRadius: '2px' }} title={`Encaissé: ${d.cash}`} />
                  </div>
                  <span style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{getMonthName(d.month).split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="content-card" style={{ marginTop: '2rem' }}>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Mois</th><th>CA</th><th>Encaissé</th><th>Dette</th><th>Taux</th><th>Action</th></tr></thead>
                <tbody>
                  {reportData.months.map(d => {
                    const rate = d.revenue > 0 ? (d.cash/d.revenue)*100 : 0;
                    return (
                      <tr key={d.month}>
                        <td><strong>{getMonthName(d.month)}</strong></td>
                        <td>{d.revenue.toLocaleString()}</td>
                        <td style={{ color: 'var(--success)' }}>{d.cash.toLocaleString()}</td>
                        <td style={{ color: d.revenue-d.cash > 0 ? 'var(--danger)' : 'inherit' }}>{(d.revenue-d.cash).toLocaleString()}</td>
                        <td><span className={`badge ${rate >= 80 ? 'badge-success' : 'badge-warning'}`}>{rate.toFixed(1)}%</span></td>
                        <td><button className="btn btn-secondary btn-sm" onClick={() => handleDownloadPDF(d.month)}><Download size={14} /> PDF</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
