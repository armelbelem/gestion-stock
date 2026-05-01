'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../../lib/storage';
import { Package, Download, Search, AlertCircle, Calendar, Coins, User, TrendingUp, Filter, Clock } from 'lucide-react';
import { exportToExcel } from '../../../utils/excelExport';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DeadStockReportPage() {
  const [report, setReport] = useState([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(90);
  const [searchTerm, setSearchTerm] = useState('');
  const pathname = usePathname();

  useEffect(() => {
    loadReport();
  }, [days]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('selectedStore');
      let url = `reports/dead-stock?days=${days}`;
      if (storeId && storeId !== 'all') {
        url += `&storeId=${storeId}`;
      }
      const data = await storage.get(url);
      setReport(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const headers = [
      { key: 'code', label: 'Code' },
      { key: 'barcode', label: 'Référence' },
      { key: 'name', label: 'Article' },
      { key: 'currentStock', label: 'Stock Actuel' },
      { key: 'lastSaleDate', label: 'Dernière Vente' },
      { key: 'daysSinceLastSale', label: 'Jours d\'inactivité' },
      { key: 'sellingPrice', label: 'Prix de Vente' },
      { key: 'totalValue', label: 'Valeur Bloquée' }
    ];
    exportToExcel(filteredReport, headers, `articles_dormants_${days}_jours`);
  };

  const filteredReport = report.filter(item => 
    item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalLockedValue = filteredReport.reduce((acc, item) => acc + item.totalValue, 0);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Articles Dormants (Dead Stock)</h1>
          <p>Identifiez les produits qui ne tournent plus pour libérer de la trésorerie</p>
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
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ flex: 1, minWidth: '300px' }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Rechercher par nom, code ou référence..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-muted)' }}>Inactif depuis :</span>
            <select className="form-control" style={{ width: 'auto' }} value={days} onChange={e => setDays(parseInt(e.target.value))}>
              <option value={30}>30 jours (1 mois)</option>
              <option value={60}>60 jours (2 mois)</option>
              <option value={90}>90 jours (3 mois)</option>
              <option value={180}>180 jours (6 mois)</option>
              <option value={365}>365 jours (1 an)</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={handleExport} disabled={filteredReport.length === 0}>
            <Download size={18} /> Exporter
          </button>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '1.5rem', marginTop: '1rem' }}>
          <div className="stat-card">
            <div className="stat-value">{filteredReport.length}</div>
            <div className="stat-label">Articles concernés</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>
              {totalLockedValue.toLocaleString()} FCFA
            </div>
            <div className="stat-label">Valeur Totale Bloquée</div>
          </div>
          <div className="stat-card" style={{ background: 'var(--bg-light)', border: '1px dashed var(--border)' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <AlertCircle className="text-warning" size={24} />
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong>Conseil :</strong> Envisagez une remise sur ces articles pour renouveler votre stock.
              </div>
            </div>
          </div>
        </div>

        <div className="content-card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Code / Réf</th>
                  <th style={{ textAlign: 'center' }}>Stock Actuel</th>
                  <th style={{ textAlign: 'center' }}>Dernière Vente</th>
                  <th style={{ textAlign: 'center' }}>Inactivité</th>
                  <th style={{ textAlign: 'right' }}>Prix de Vente</th>
                  <th style={{ textAlign: 'right' }}>Valeur Bloquée</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>Analyse des stocks en cours...</td></tr>
                ) : filteredReport.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: '3rem' }}>Bravo ! Aucun article n'est dormant selon vos critères.</td></tr>
                ) : (
                  filteredReport.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.name}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>C: {item.code || '-'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>R: {item.barcode || '-'}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 500 }}>{item.currentStock}</td>
                      <td style={{ textAlign: 'center' }}>{item.lastSaleDate}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${item.daysSinceLastSale === '∞' ? 'badge-danger' : item.daysSinceLastSale > 180 ? 'badge-warning' : 'badge-primary'}`}>
                          {item.daysSinceLastSale === '∞' ? 'Jamais' : `${item.daysSinceLastSale} jours`}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{item.sellingPrice.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--danger)' }}>
                        {item.totalValue.toLocaleString()} FCFA
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
