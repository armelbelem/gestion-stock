'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { BarChart3, Download, TrendingUp, TrendingDown, Package, Coins, User, Printer, Clock, FileText, ArrowUp, ArrowDown, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { exportToExcel } from '../../utils/excelExport';

export default function ReportsPage() {
  const [reportData, setReportData] = useState({ 
    months: [], 
    totalDebt: 0, 
    totalRevenue: 0, 
    totalPaid: 0, 
    totalPurchases: 0, 
    partnerPurchases: [] 
  });
  const [dates, setDates] = useState({ start: '', end: '' });
  const [loading, setLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [settings, setSettings] = useState(null);
  const pathname = usePathname();
  
  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const dateRange = {
      start: firstDay.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    };
    setDates(dateRange);
    loadSettings();
    // loadReport sera appelé par l'autre useEffect
  }, []);

  useEffect(() => {
    if (dates.start && dates.end) {
      loadReport();
    }
  }, [dates]);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await storage.get(`reports/monthly?startDate=${dates.start}&endDate=${dates.end}`);
      if (Array.isArray(data)) setReportData({ months: data, totalDebt: 0, totalRevenue: 0, totalPaid: 0 });
      else setReportData({ 
        months: data.months || [], 
        totalDebt: data.totalDebt || 0, 
        totalRevenue: data.totalRevenue || 0,
        totalPaid: data.totalPaid || 0,
        totalPurchases: data.totalPurchases || 0,
        partnerPurchases: data.partnerPurchases || []
      });
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const setQuickPeriod = (period) => {
    const end = new Date();
    const start = new Date();
    if (period === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (period === 'month') {
      start.setDate(1);
    } else if (period === 'last30') {
      start.setDate(end.getDate() - 30);
    }
    setDates({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const handleExportExcel = () => {
    const headers = [
      { key: 'monthName', label: 'Mois' },
      { key: 'revenue', label: 'Chiffre d\'Affaires' },
      { key: 'cash', label: 'Total Encaissé' },
      { key: 'debt', label: 'Dette' },
      { key: 'rate', label: 'Taux de Recouvrement (%)' }
    ];
    
    const dataToExport = reportData.months.map(d => ({
      ...d,
      monthName: getMonthName(d.month),
      revenue: formatPrice(d.revenue),
      cash: formatPrice(d.cash),
      debt: formatPrice(d.revenue - d.cash),
      rate: d.revenue > 0 ? ((d.cash / d.revenue) * 100).toFixed(1) : "0"
    }));

    exportToExcel(dataToExport, headers, `bilan_financier_${dates.start}_${dates.end}`, {
      title: "BILAN FINANCIER",
      companyName: settings?.companyName || "NS AUTO",
      period: `Période du ${new Date(dates.start).toLocaleDateString('fr-FR')} au ${new Date(dates.end).toLocaleDateString('fr-FR')}`
    });
  };

  const handleDownloadPDF = async (month) => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('selectedStore');
      const data = await storage.get(`reports/monthly/details?month=${month}${storeId !== 'all' && storeId ? `&storeId=${storeId}` : ''}`);
      setPrintData({ ...data, month });
      setIsPrinting(true);
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
        setPrintData(null);
        setLoading(false);
      }, 500);
    } catch (err) { 
      console.error(err);
      alert("Erreur lors de la préparation du document");
      setLoading(false);
    }
  };

  const handleExportExcelMonth = async (month) => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('selectedStore');
      const data = await storage.get(`reports/monthly/details?month=${month}${storeId !== 'all' && storeId ? `&storeId=${storeId}` : ''}`);
      
      const headers = [
        { key: 'date', label: 'Date' },
        { key: 'clientName', label: 'Client' },
        { key: 'totalAmount', label: 'Montant Total' },
        { key: 'amountPaid', label: 'Montant Payé' },
        { key: 'status', label: 'Statut' }
      ];

      const rows = data.sales.map(s => ({
        ...s,
        date: new Date(s.date).toLocaleDateString('fr-FR'),
        clientName: s.clientName || 'Client Divers',
        totalAmount: formatPrice(s.totalAmount),
        amountPaid: formatPrice(s.amountPaid)
      }));

      exportToExcel(rows, headers, `ventes_${month}`, {
        title: `DÉTAIL DES VENTES - ${getMonthName(month).toUpperCase()}`,
        companyName: settings?.companyName || "NS AUTO"
      });
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'export Excel");
    } finally {
      setLoading(false);
    }
  };

  const getMonthName = (m) => {
    if (!m) return '-';
    const [y, mm] = m.split('-');
    return new Date(y, parseInt(mm)-1).toLocaleString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const maxVal = Math.max(...reportData.months.map(d => Math.max(d.revenue, d.cash)), 1);

  if (isPrinting && printData) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '40px', backgroundColor: 'white', minHeight: '100vh', color: 'black' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold' }}>{settings?.companyName || 'NS AUTO'}</h1>
          <h2 style={{ margin: '5px 0', fontSize: '18px', textTransform: 'uppercase' }}>BILAN FINANCIER MENSUEL</h2>
          <p style={{ margin: 0 }}>Mois de : {getMonthName(printData.month).toUpperCase()}</p>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px', padding: '15px', backgroundColor: '#f0f0f0', border: '1px solid #ccc' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '12px' }}>CHIFFRE D'AFFAIRES</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{formatPrice(printData.revenue || 0)} FCFA</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '12px' }}>TOTAL ENCAISSÉ</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#2ecc71' }}>{formatPrice(printData.cash || 0)} FCFA</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontSize: '12px' }}>BALANCE</p>
            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: (printData.revenue - printData.cash) > 0 ? '#e74c3c' : '#000' }}>
              {formatPrice(printData.revenue - printData.cash)} FCFA
            </p>
          </div>
        </div>

        <h3 style={{ borderBottom: '1px solid #000', paddingBottom: '5px', fontSize: '14px' }}>DÉTAIL DES VENTES</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '11px' }}>
          <thead>
            <tr style={{ backgroundColor: '#eee', borderBottom: '1px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '5px', border: '1px solid #ccc' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '5px', border: '1px solid #ccc' }}>Client</th>
              <th style={{ textAlign: 'right', padding: '5px', border: '1px solid #ccc' }}>Montant</th>
              <th style={{ textAlign: 'center', padding: '5px', border: '1px solid #ccc' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {printData.sales?.map((sale, idx) => (
              <tr key={idx}>
                <td style={{ padding: '5px', border: '1px solid #ccc' }}>{new Date(sale.date).toLocaleDateString('fr-FR')}</td>
                <td style={{ padding: '5px', border: '1px solid #ccc' }}>{sale.clientName || 'Client Divers'}</td>
                <td style={{ textAlign: 'right', padding: '5px', border: '1px solid #ccc' }}>{formatPrice(sale.totalAmount)}</td>
                <td style={{ textAlign: 'center', padding: '5px', border: '1px solid #ccc' }}>{sale.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <p style={{ margin: 0, textDecoration: 'underline' }}>Comptabilité</p>
            <div style={{ height: '60px' }}></div>
          </div>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <p style={{ margin: 0, textDecoration: 'underline' }}>Direction Générale</p>
            <div style={{ height: '60px' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Rapports et Analyses</h1>
          <p>Suivez les indicateurs clés de votre activité</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel} title="Exporter Excel">
            <Download size={18} /> Excel
          </button>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        <Link href="/reports" className={`nav-item ${pathname === '/reports' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Coins size={18} /> Financiers
        </Link>
        <Link href="/reports/stock" className={`nav-item ${pathname === '/reports/stock' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Package size={18} /> Mouvements de Stock
        </Link>
        <Link href="/reports/client" className={`nav-item ${pathname === '/reports/client' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <User size={18} /> Bilan par Client
        </Link>
        <Link href="/reports/top-articles" className={`nav-item ${pathname === '/reports/top-articles' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <TrendingUp size={18} /> Top Articles / Client
        </Link>
        <Link href="/reports/dead-stock" className={`nav-item ${pathname === '/reports/dead-stock' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Clock size={18} /> Articles Dormants
        </Link>
        <Link href="/reports/stock-valuation" className={`nav-item ${pathname === '/reports/stock-valuation' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <FileSpreadsheet size={18} /> Valorisation de Stock
        </Link>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('week')}>Semaine</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('month')}>Mois</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('last30')}>30 j</button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input 
              type="date" 
              className="form-control" 
              value={dates.start} 
              onChange={(e) => setDates({...dates, start: e.target.value})} 
            />
            <span>au</span>
            <input 
              type="date" 
              className="form-control" 
              value={dates.end} 
              onChange={(e) => setDates({...dates, end: e.target.value})} 
            />
          </div>
          
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
             <button className="btn btn-primary" onClick={loadReport} disabled={loading}>
               Actualiser
             </button>
          </div>
        </div>

        {loading && !isPrinting ? <p>Analyse des données financières en cours...</p> : (
          <>
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div className="stat-card stat-card-premium bg-gradient-blue">
                <div className="stat-icon-bg"><TrendingUp size={48} /></div>
                <div className="stat-label">Chiffre d'Affaires</div>
                <div className="stat-value">{formatPrice(reportData.totalRevenue || 0)} FCFA</div>
                <div className="card-progress-container">
                  <div className="card-progress-bar" style={{ width: '100%' }}></div>
                </div>
                <div className="card-trend">
                  <span>Période sélectionnée</span>
                </div>
              </div>
              
              <div className="stat-card stat-card-premium bg-gradient-green">
                <div className="stat-icon-bg"><Coins size={48} /></div>
                <div className="stat-label">Total Encaissé</div>
                <div className="stat-value">{formatPrice(reportData.totalPaid || 0)} FCFA</div>
                <div className="card-progress-container">
                  <div className="card-progress-bar" style={{ width: reportData.totalRevenue > 0 ? `${(reportData.totalPaid / reportData.totalRevenue) * 100}%` : '0%' }}></div>
                </div>
                <div className="card-trend">
                  <ArrowUp size={14} /> <span>Taux: {reportData.totalRevenue > 0 ? ((reportData.totalPaid / reportData.totalRevenue) * 100).toFixed(1) : 0}%</span>
                </div>
              </div>

              <div className="stat-card stat-card-premium bg-gradient-red">
                <div className="stat-icon-bg"><TrendingDown size={48} /></div>
                <div className="stat-label">Dette Globale</div>
                <div className="stat-value">{formatPrice(reportData.totalDebt || 0)} FCFA</div>
                <div className="card-progress-container">
                  <div className="card-progress-bar" style={{ width: reportData.totalRevenue > 0 ? `${(reportData.totalDebt / reportData.totalRevenue) * 100}%` : '0%' }}></div>
                </div>
                <div className="card-trend">
                  <ArrowDown size={14} /> <span>Reste à recouvrer</span>
                </div>
              </div>

              <div className="stat-card stat-card-premium bg-gradient-purple">
                <div className="stat-icon-bg"><Package size={48} /></div>
                <div className="stat-label">Achats Partenaires</div>
                <div className="stat-value">{formatPrice(reportData.totalPurchases || 0)} FCFA</div>
                <div className="card-progress-container">
                  <div className="card-progress-bar" style={{ width: '100%' }}></div>
                </div>
                <div className="card-trend">
                  <span>Approvisionnements</span>
                </div>
              </div>
            </div>

            {reportData.partnerPurchases && reportData.partnerPurchases.length > 0 && (
              <div className="content-card" style={{ marginTop: '1.5rem', padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Package size={18} /> Détail des Achats par Partenaire
                </h3>
                <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
                  {reportData.partnerPurchases.map(p => (
                    <div key={p.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>{p.name}</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--info)' }}>{formatPrice(p.total)} <span style={{ fontSize: '0.7rem' }}>FCFA</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="content-card" style={{ marginTop: '2rem' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2rem' }}><BarChart3 /> Performance Mensuelle (FCFA)</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', height: '300px', overflowX: 'auto', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
                {reportData.months.slice().reverse().map(d => {
                  const revHeight = maxVal > 0 ? (d.revenue / maxVal) * 100 : 0;
                  const cashHeight = maxVal > 0 ? (d.cash / maxVal) * 100 : 0;
                  return (
                    <div key={d.month} style={{ flex: 1, minWidth: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--primary)' }}>{d.revenue > 0 ? formatPrice(d.revenue) : ''}</div>
                      <div style={{ display: 'flex', gap: '4px', height: '200px', alignItems: 'flex-end', width: '100%', justifyContent: 'center' }}>
                        <div 
                          style={{ width: '20px', height: `${revHeight}%`, backgroundColor: 'var(--primary)', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }} 
                          title={`Revenu ${getMonthName(d.month)}: ${d.revenue}`} 
                        />
                        <div 
                          style={{ width: '20px', height: `${cashHeight}%`, backgroundColor: 'var(--success)', borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease' }} 
                          title={`Encaissé ${getMonthName(d.month)}: ${d.cash}`} 
                        />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, whiteSpace: 'nowrap', marginTop: '5px' }}>{getMonthName(d.month).split(' ')[0]}</span>
                    </div>
                  );
                })}
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
                          <td>{formatPrice(d.revenue)}</td>
                          <td style={{ color: 'var(--success)' }}>{formatPrice(d.cash)}</td>
                          <td style={{ color: d.revenue-d.cash > 0 ? 'var(--danger)' : 'inherit' }}>{formatPrice(d.revenue-d.cash)}</td>
                          <td><span className={`badge ${rate >= 80 ? 'badge-success' : 'badge-warning'}`}>{rate.toFixed(1)}%</span></td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleDownloadPDF(d.month)}><FileText size={14} /> PDF</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleExportExcelMonth(d.month)}><Download size={14} /> Excel</button>
                            </div>
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
    </div>
  );
}
