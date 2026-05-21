'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../../lib/storage';
import { 
  User, Store, Clock, Search, PlusCircle, Trash2, Edit, 
  LogIn, LogOut, ArrowRightLeft, AlertCircle, FileText, 
  Settings, ShoppingCart, Wallet, Package,
  ChevronLeft, ChevronRight
} from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 50 });
  const [isLoading, setIsLoading] = useState(true);

  // Debounce the search term to avoid excessive API requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    loadLogs();
  }, [currentPage, debouncedSearch]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: pagination.limit
      });
      if (debouncedSearch) {
        params.append('searchTerm', debouncedSearch);
      }
      const result = await storage.get(`logs?${params.toString()}`);
      setLogs(result.data || []);
      setPagination(result.pagination || { total: 0, totalPages: 1, page: 1, limit: 50 });
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedLogs = useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      const date = new Date(log.timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      let dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      if (date.toDateString() === today.toDateString()) dateStr = "Aujourd'hui";
      else if (date.toDateString() === yesterday.toDateString()) dateStr = "Hier";
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(log);
    });
    return groups;
  }, [logs]);

  const getActionInfo = (action) => {
    const act = action.toLowerCase();
    if (act.includes('création') || act.includes('ajout')) return { icon: <PlusCircle size={20} />, color: 'var(--success)' };
    if (act.includes('suppression')) return { icon: <Trash2 size={20} />, color: 'var(--danger)' };
    if (act.includes('modification') || act.includes('mise à jour')) return { icon: <Edit size={20} />, color: 'var(--warning)' };
    if (act.includes('connexion')) return { icon: <LogIn size={20} />, color: 'var(--primary)' };
    if (act.includes('déconnexion')) return { icon: <LogOut size={20} />, color: 'var(--text-muted)' };
    if (act.includes('transfert')) return { icon: <ArrowRightLeft size={20} />, color: 'var(--primary-dark)' };
    if (act.includes('annulation')) return { icon: <AlertCircle size={20} />, color: 'var(--danger)' };
    if (act.includes('vente')) return { icon: <ShoppingCart size={20} />, color: 'var(--success-dark)' };
    if (act.includes('paiement') || act.includes('règlement')) return { icon: <Wallet size={20} />, color: 'var(--success)' };
    if (act.includes('stock')) return { icon: <Package size={20} />, color: 'var(--primary)' };
    return { icon: <FileText size={20} />, color: 'var(--text-muted)' };
  };

  const formatDetails = (details, action) => {
    if (!details) return '-';
    try {
      const data = typeof details === 'string' ? JSON.parse(details) : details;
      const act = action.toLowerCase();
      if (act.includes('vente')) return `Vente #${data.saleId?.substring(0, 8).toUpperCase()} - ${data.totalAmount?.toLocaleString()} FCFA`;
      if (act.includes('paiement')) return `Paiement ${data.amount?.toLocaleString()} FCFA pour la vente #${data.saleId?.substring(0, 8).toUpperCase()}`;
      return Object.entries(data).map(([k, v]) => `${k}: ${v}`).join(' | ');
    } catch (e) { return details; }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Journal d'Audit</h1><p>Historique des activités système</p></div>
      </div>
      <div className="toolbar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input type="text" placeholder="Rechercher une action, un utilisateur..." className="form-control" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}><Clock size={48} className="text-muted" /><p>Chargement...</p></div>
      ) : (
        <>
          <div className="timeline">
            {Object.entries(groupedLogs).map(([date, items]) => (
              <div key={date} className="timeline-group">
                <div className="timeline-date-header">{date}</div>
                {items.map((log) => {
                  const { icon, color } = getActionInfo(log.action);
                  return (
                    <div key={log.id} className="timeline-item">
                      <div className="timeline-icon-wrapper"><div className="timeline-icon" style={{ borderColor: color, color }}>{icon}</div></div>
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <div>
                            <div className="timeline-action" style={{ color }}>{log.action}</div>
                            <div className="timeline-user">
                              <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.6rem' }}>{log.username?.[0].toUpperCase()}</div>
                              <strong>{log.username}</strong>
                              <span className="timeline-store"><Store size={12} />{log.storeName || 'Système'}</span>
                            </div>
                          </div>
                          <div className="timeline-time">{new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                        {log.details && <div className="timeline-details" style={{ borderLeftColor: color }}>{formatDetails(log.details, log.action)}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem', padding: '1rem', backgroundColor: 'var(--card-bg)', borderRadius: '12px' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Affichage de {(currentPage - 1) * pagination.limit + 1} à {Math.min(currentPage * pagination.limit, pagination.total)} sur {pagination.total}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1 || isLoading}><ChevronLeft size={16} /> Précédent</button>
                <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>{currentPage} / {pagination.totalPages}</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.min(p + 1, pagination.totalPages))} disabled={currentPage >= pagination.totalPages || isLoading}>Suivant <ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
