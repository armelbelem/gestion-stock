'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { History, Search, Filter, Clock, User, Store, Info, FileText, Download, Calendar } from 'lucide-react';
import { useAuth } from '../../providers';
import { exportToExcel } from '../../utils/excelExport';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isReporting, setIsReporting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 50 });

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadLogs();
    }, 400); // Debounce search
    return () => clearTimeout(timer);
  }, [searchTerm, dateRange.start, dateRange.end, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange.start, dateRange.end]);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (e) { console.error(e); }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const query = `logs?page=${currentPage}&limit=50&searchTerm=${encodeURIComponent(searchTerm)}&startDate=${dateRange.start}&endDate=${dateRange.end}`;
      const res = await storage.get(query);
      if (res && res.data) {
        setLogs(res.data);
        setPagination(res.pagination);
      } else {
        setLogs(res || []); // Fallback
      }
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering is no longer needed as we filter on the server
  const filteredLogs = logs;

  const handleExport = () => {
    const headers = [
      { key: 'timestamp', label: 'Date & Heure' },
      { key: 'username', label: 'Utilisateur' },
      { key: 'storeName', label: 'Magasin' },
      { key: 'action', label: 'Action' },
      { key: 'details', label: 'Détails' }
    ];

    const dataToExport = filteredLogs.map(log => ({
      ...log,
      timestamp: new Date(log.timestamp).toLocaleString(),
      details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details)
    }));

    exportToExcel(dataToExport, headers, 'journal_activite', {
      title: "JOURNAL D'ACTIVITÉ DU SYSTÈME",
      companyName: settings?.companyName || "NS-AUTO",
      period: dateRange.start ? `Du ${dateRange.start} au ${dateRange.end || 'Aujourd\'hui'}` : "Historique complet"
    });
  };

  const handlePrint = () => {
    setIsReporting(true);
    setTimeout(() => {
      window.print();
      setIsReporting(false);
    }, 100);
  };

  const formatDetails = (details) => {
    if (!details) return '-';
    try {
      const parsed = typeof details === 'string' ? JSON.parse(details) : details;
      return Object.entries(parsed).map(([key, val]) => (
        <div key={key} style={{ fontSize: '0.8rem' }}>
          <strong>{key}:</strong> {typeof val === 'object' ? JSON.stringify(val) : String(val)}
        </div>
      ));
    } catch (e) {
      return details;
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="page" style={{ textAlign: 'center', padding: '4rem' }}>
        <h1>Accès Refusé</h1>
        <p>Désolé, cette page est réservée aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Journal d'Activité</h1>
          <p>Suivi complet des actions effectuées sur le système</p>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px' }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Rechercher une action, un utilisateur..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Calendar size={18} className="text-muted" />
            <input 
              type="date" 
              className="form-control" 
              value={dateRange.start} 
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              style={{ width: '150px' }}
            />
            <span className="text-muted">au</span>
            <input 
              type="date" 
              className="form-control" 
              value={dateRange.end} 
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              style={{ width: '150px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={handleExport} title="Exporter Excel">
              <Download size={18} /> Excel
            </button>
            <button className="btn btn-secondary" onClick={handlePrint} title="Imprimer PDF">
              <FileText size={18} /> PDF
            </button>
          </div>
        </div>
      </div>

      <div className="content-card">
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date & Heure</th>
                  <th>Utilisateur</th>
                  <th>Magasin</th>
                  <th>Action</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Aucun log trouvé.</td></tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Clock size={14} className="text-muted" />
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <User size={14} className="text-muted" />
                          {log.username || 'Système'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Store size={14} className="text-muted" />
                          {log.storeName || 'Global'}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                          {log.action}
                        </span>
                      </td>
                      <td>{formatDetails(log.details)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination UI */}
        {pagination.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-light)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Affichage de <strong>{logs.length}</strong> sur <strong>{pagination.total}</strong> actions
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Précédent
              </button>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[...Array(pagination.totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === pagination.totalPages || (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)) {
                    return (
                      <button
                        key={pageNum}
                        className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ minWidth: '32px', padding: '4px 8px' }}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  } else if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                    return <span key={pageNum} style={{ color: 'var(--text-muted)' }}>...</span>;
                  }
                  return null;
                })}
              </div>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages}
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>
      {isReporting && (
        <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
          {/* Header Rebrand - Baseline Aligned */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '15px' }}>
            {settings?.logo ? (
              <img 
                src={settings.logo} 
                alt="Logo" 
                style={{ maxHeight: '100px', marginRight: '5px' }} 
              />
            ) : (
              <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase', marginRight: '15px' }}>{settings?.companyName || 'NS AUTO'}</h1>
            )}
            <div style={{ flex: 1, height: '4px', backgroundColor: '#b91c1c', marginBottom: '14px' }}></div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2>JOURNAL D'ACTIVITÉ</h2>
            <p>Période : {dateRange.start ? `Du ${dateRange.start} au ${dateRange.end || 'Aujourd\'hui'}` : "Historique complet"}</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f5f5f5' }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Utilisateur</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Détails</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map(log => (
                <tr key={log.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '8px', fontSize: '0.8rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                  <td style={{ padding: '8px' }}>{log.username || 'Système'}</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{log.action}</td>
                  <td style={{ padding: '8px', fontSize: '0.8rem' }}>{typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
