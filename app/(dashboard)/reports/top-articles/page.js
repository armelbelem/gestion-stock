'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../../lib/storage';
import { TrendingUp, Download, Search, Calendar, User, Package, Coins, Filter, Clock } from 'lucide-react';
import { exportToExcel } from '../../../utils/excelExport';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TopArticlesReportPage() {
  const [data, setData] = useState([]);
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
      loadData();
    }
  }, [dates]);

  const loadData = async () => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('selectedStore');
      let url = `reports/top-client-articles?startDate=${dates.start}&endDate=${dates.end}`;
      if (storeId && storeId !== 'all') {
        url += `&storeId=${storeId}`;
      }
      const res = await storage.get(url);
      setData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = [];
    data.forEach(client => {
      client.topArticles.forEach((art, idx) => {
        exportData.push({
          clientName: client.name,
          rank: idx + 1,
          articleCode: art.code,
          articleBarcode: art.barcode,
          articleName: art.name,
          quantity: art.quantity,
          amount: art.amount
        });
      });
    });

    const headers = [
      { key: 'clientName', label: 'Client' },
      { key: 'rank', label: 'Rang' },
      { key: 'articleCode', label: 'Code Article' },
      { key: 'articleBarcode', label: 'Référence' },
      { key: 'articleName', label: 'Article' },
      { key: 'quantity', label: 'Quantité' },
      { key: 'amount', label: 'Montant Total HT' }
    ];
    exportToExcel(exportData, headers, `top_articles_par_client_${dates.start}_${dates.end}`);
  };

  const filteredData = data.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.topArticles.some(art => 
      art.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      art.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const setQuickPeriod = (period) => {
    const end = new Date();
    const start = new Date();
    if (period === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (period === 'month') {
      start.setDate(1);
    } else if (period === 'last30') {
      start.setDate(end.getDate() - 30);
    } else if (period === 'year') {
      start.setMonth(0, 1);
    }
    setDates({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const pathname = usePathname();

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Top Articles par Client</h1>
          <p>Identifiez les produits préférés de vos clients sur une période donnée</p>
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
              placeholder="Rechercher un client ou un article..." 
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
            <Calendar size={18} />
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

          <button className="btn btn-primary" onClick={handleExport} disabled={data.length === 0}>
            <Download size={18} /> Exporter
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: '1rem' }}>Analyse des préférences clients en cours...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="content-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <Filter size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
            <p>Aucune donnée trouvée pour cette période.</p>
          </div>
        ) : (
          <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
            {filteredData.map(client => (
              <div key={client.id} className="content-card" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--bg-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                    <User size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{client.name}</h3>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      {client.topArticles.length} articles différents achetés
                    </p>
                  </div>
                </div>
                
                <div className="table-wrapper" style={{ flex: 1 }}>
                  <table style={{ fontSize: '0.9rem' }}>
                    <thead>
                      <tr>
                        <th>Article</th>
                        <th style={{ textAlign: 'center' }}>Qté</th>
                        <th style={{ textAlign: 'right' }}>Total HT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {client.topArticles.slice(0, 5).map((art, idx) => (
                        <tr key={art.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: idx === 0 ? 'var(--warning)' : 'var(--text-muted)', width: '15px' }}>
                                #{idx + 1}
                              </span>
                              <div>
                                <div style={{ fontWeight: 500 }}>{art.name}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  C: {art.code || '-'} | R: {art.barcode || '-'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{art.quantity}</td>
                          <td style={{ textAlign: 'right' }}>{art.amount.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                {client.topArticles.length > 5 && (
                  <p style={{ margin: '1rem 0 0 0', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    + {client.topArticles.length - 5} autres articles
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
