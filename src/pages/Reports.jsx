import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { BarChart3, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Download } from 'lucide-react';

const Reports = () => {
  const [reportData, setReportData] = useState({ months: [], totalDebt: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await storage.get('reports/monthly');
      // Handle the case where the API might still be cached or returning old data
      if (Array.isArray(data)) {
        setReportData({ months: data, totalDebt: 0, totalRevenue: 0 });
      } else {
        setReportData({
          months: data.months || [],
          totalDebt: data.totalDebt || 0,
          totalRevenue: data.totalRevenue || 0
        });
      }
    } catch (error) {
      console.error("Error loading report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async (month) => {
    try {
      const storeId = localStorage.getItem('selectedStore');
      const token = sessionStorage.getItem('token');
      const url = `/api/reports/pdf?month=${month}${storeId !== 'all' && storeId ? `&storeId=${storeId}` : ''}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erreur serveur (Status: ${response.status})`);
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Bilan_${month}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("PDF Error:", error);
      alert(`Erreur : ${error.message}`);
    }
  };

  const getMonthName = (monthStr) => {
    if (!monthStr) return '-';
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const maxVal = Math.max(...reportData.months.map(d => Math.max(d.revenue, d.cash)), 1);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Rapports Financiers</h1>
          <p>Analyse des revenus vs encaissements réels</p>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>Chargement des données...</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--primary)', fontSize: '1.75rem' }}>
                {reportData.months.length > 0 ? reportData.months[0].revenue.toLocaleString('fr-FR') : 0} <span style={{ fontSize: '1rem', opacity: 0.8 }}>FCFA</span>
              </div>
              <div className="stat-label">CHIFFRE D'AFFAIRES ({reportData.months.length > 0 ? getMonthName(reportData.months[0].month) : '-'})</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.75rem' }}>
                {reportData.months.length > 0 ? reportData.months[0].cash.toLocaleString('fr-FR') : 0} <span style={{ fontSize: '1rem', opacity: 0.8 }}>FCFA</span>
              </div>
              <div className="stat-label">Encaissé ({reportData.months.length > 0 ? getMonthName(reportData.months[0].month) : '-'})</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--primary-dark)', fontSize: '1.75rem' }}>
                {reportData.totalRevenue.toLocaleString('fr-FR')} <span style={{ fontSize: '1rem', opacity: 0.8 }}>FCFA</span>
              </div>
              <div className="stat-label">Chiffre d'Affaires Total (Global)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger)', fontSize: '1.75rem' }}>
                {reportData.totalDebt.toLocaleString('fr-FR')} <span style={{ fontSize: '1rem', opacity: 0.8 }}>FCFA</span>
              </div>
              <div className="stat-label">Dette Totale (Reste dû global)</div>
            </div>
          </div>

          {/* Visual Chart Section */}
          <div className="content-card" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart3 size={20} /> Comparaison Mensuelle
            </h3>

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '2rem',
              height: '300px',
              paddingTop: '2rem',
              overflowX: 'auto',
              paddingBottom: '1rem'
            }}>
              {reportData.months.slice().reverse().map((data) => (
                <div key={data.month} style={{ flex: 1, minWidth: '80px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', gap: '4px', height: '100%', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                    {/* Revenue Bar */}
                    <div style={{
                      width: '20px',
                      height: `${(data.revenue / maxVal) * 100}%`,
                      backgroundColor: 'var(--primary)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 1s ease-out'
                    }} title={`CA: ${data.revenue.toLocaleString()} FCFA`} />
                    {/* Cash Bar */}
                    <div style={{
                      width: '20px',
                      height: `${(data.cash / maxVal) * 100}%`,
                      backgroundColor: 'var(--success)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 1s ease-out'
                    }} title={`Encaissé: ${data.cash.toLocaleString()} FCFA`} />
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {getMonthName(data.month).split(' ')[0]}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '2rem', justifyContent: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--primary)', borderRadius: '2px' }}></div>
                <span>Chiffre d'Affaires</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--success)', borderRadius: '2px' }}></div>
                <span>Argent Réellement Encaissé</span>
              </div>
            </div>
          </div>

          {/* Data Table Section */}
          <div className="content-card" style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Historique des 12 derniers mois</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mois</th>
                    <th style={{ textAlign: 'right' }}>Chiffre d'Affaires (CA)</th>
                    <th style={{ textAlign: 'right' }}>Argent Encaissé</th>
                    <th style={{ textAlign: 'right' }}>Reste à Recouvrer</th>
                    <th style={{ textAlign: 'right' }}>Taux de Recouvrement</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.months.map((data) => {
                    const rate = data.revenue > 0 ? (data.cash / data.revenue) * 100 : 0;
                    const remaining = data.revenue - data.cash;
                    return (
                      <tr key={data.month}>
                        <td style={{ fontWeight: 600 }}>{getMonthName(data.month)}</td>
                        <td style={{ textAlign: 'right' }}>{data.revenue.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>FCFA</span></td>
                        <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>
                          {data.cash.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>FCFA</span>
                        </td>
                        <td style={{ textAlign: 'right', color: remaining > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                          {remaining > 0 ? <>{remaining.toLocaleString('fr-FR')} <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>FCFA</span></> : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`badge ${rate >= 90 ? 'badge-success' : rate >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                            {rate.toFixed(1)}%
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            className="btn btn-secondary btn-sm" 
                            onClick={() => handleDownloadPDF(data.month)}
                            title="Télécharger le bilan PDF"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          >
                            <Download size={14} /> PDF
                          </button>
                        </td>
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
};

export default Reports;
