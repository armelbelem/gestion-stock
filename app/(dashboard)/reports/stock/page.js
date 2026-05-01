'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../../lib/storage';
import { BarChart3, Download, Search, Calendar, Package, ArrowUpRight, ArrowDownRight, History, Coins, TrendingUp, Clock } from 'lucide-react';
import { exportToExcel } from '../../../utils/excelExport';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function StockReportsPage() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setDates({
      start: firstDay.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    });
  }, []);

  useEffect(() => {
    if (dates.start && dates.end) {
      loadReport();
    }
  }, [dates]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await storage.get(`reports/stock?startDate=${dates.start}&endDate=${dates.end}`);
      setReport(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      { key: 'name', label: 'Article' },
      { key: 'initial', label: 'Stock Initial' },
      { key: 'entries', label: 'Entrées' },
      { key: 'exits', label: 'Sorties' },
      { key: 'final', label: 'Stock Final' },
      { key: 'price', label: 'Prix' }
    ];
    exportToExcel(filteredReport, headers, `rapport_stock_${dates.start}_${dates.end}`);
  };

  const filteredReport = report.filter(item => 
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalValue = filteredReport.reduce((acc, item) => acc + (item.final * item.price), 0);

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

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Rapports et Analyses</h1>
          <p>Suivez les indicateurs clés de votre activité</p>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        <Link href="/reports" className="nav-item" style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Coins size={18} /> Financiers
        </Link>
        <Link href="/reports/stock" className="nav-item active" style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Package size={18} /> Mouvements de Stock
        </Link>
        <Link href="/reports/client" className="nav-item" style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <History size={18} /> Bilan par Client
        </Link>
        <Link href="/reports/top-articles" className="nav-item" style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <TrendingUp size={18} /> Top Articles / Client
        </Link>
        <Link href="/reports/dead-stock" className="nav-item" style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Clock size={18} /> Articles Dormants
        </Link>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '300px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Rechercher par nom ou code..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
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

          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={18} /> Exporter
          </button>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem', marginTop: '1rem' }}>
          <div className="stat-card">
            <div className="stat-value">{filteredReport.length}</div>
            <div className="stat-label">Articles en mouvement</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              +{filteredReport.reduce((acc, i) => acc + i.entries, 0)}
            </div>
            <div className="stat-label">Total Entrées</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>
              -{filteredReport.reduce((acc, i) => acc + i.exits, 0)}
            </div>
            <div className="stat-label">Total Sorties</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--primary)' }}>
              {totalValue.toLocaleString()} FCFA
            </div>
            <div className="stat-label">Valeur du Stock Final</div>
          </div>
        </div>

        <div className="content-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th style={{ textAlign: 'center' }}>Stock Initial</th>
                  <th style={{ textAlign: 'center' }}>Entrées (+)</th>
                  <th style={{ textAlign: 'center' }}>Sorties (-)</th>
                  <th style={{ textAlign: 'center' }}>Stock Final</th>
                  <th style={{ textAlign: 'right' }}>Valeur de Fin</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Analyse des mouvements en cours...</td></tr>
                ) : filteredReport.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}>Aucun mouvement enregistré pour cette période.</td></tr>
                ) : (
                  filteredReport.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.code || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 500 }}>{item.initial}</td>
                      <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>
                        {item.entries > 0 ? `+${item.entries}` : '-'}
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>
                        {item.exits > 0 ? `-${item.exits}` : '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${item.final <= 0 ? 'badge-danger' : item.final <= 10 ? 'badge-warning' : 'badge-primary'}`}>
                          {item.final}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 500 }}>
                        {(item.final * item.price).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

