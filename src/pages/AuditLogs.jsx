import React, { useState, useEffect, useMemo } from 'react';
import { storage } from '../store/storage';
import { 
  User, Store, Clock, Search, PlusCircle, Trash2, Edit, 
  LogIn, LogOut, ArrowRightLeft, AlertCircle, FileText, 
  Settings, ShoppingCart, Wallet, Package
} from 'lucide-react';

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    const data = await storage.get('logs');
    // Sort logs by date descending (newest first)
    const sortedData = [...data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    setLogs(sortedData);
    setIsLoading(false);
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => 
      log.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.storeName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [logs, searchTerm]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups = {};
    filteredLogs.forEach(log => {
      const date = new Date(log.timestamp);
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      let dateStr = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      
      if (date.toDateString() === today.toDateString()) {
        dateStr = "Aujourd'hui";
      } else if (date.toDateString() === yesterday.toDateString()) {
        dateStr = "Hier";
      }

      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(log);
    });
    return groups;
  }, [filteredLogs]);

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
    if (act.includes('clôture') || act.includes('ouverture')) return { icon: <Settings size={20} />, color: 'var(--secondary)' };
    return { icon: <FileText size={20} />, color: 'var(--text-muted)' };
  };

  const formatDetails = (details, action) => {
    if (!details) return '-';
    
    try {
      const data = typeof details === 'string' ? JSON.parse(details) : details;
      const act = action.toLowerCase();

      if (act.includes('vente')) {
        return `Vente #${data.saleId?.substring(0, 8).toUpperCase()} - Montant: ${data.totalAmount?.toLocaleString('fr-FR')} FCFA`;
      }
      
      if (act.includes('annulation')) {
        return `Annulation de la vente #${data.saleId?.substring(0, 8).toUpperCase()}`;
      }

      if (act.includes('article')) {
        return `Article: ${data.name || 'Inconnu'} ${data.initialStock !== undefined ? `- Stock initial: ${data.initialStock}` : ''}`;
      }

      if (act.includes('transfert')) {
        return `Quantité: ${data.quantity} - De #${data.articleId?.substring(0, 5)} vers Store #${data.toStoreId?.substring(0, 5)}`;
      }

      if (act.includes('paiement')) {
        return `Montant payé: ${data.amount?.toLocaleString('fr-FR')} FCFA pour la vente #${data.saleId?.substring(0, 8).toUpperCase()}`;
      }

      // Default formatting for other JSON objects
      return Object.entries(data)
        .map(([key, value]) => `${key}: ${value}`)
        .join(' | ');

    } catch (e) {
      return details; // Return as is if not valid JSON
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Journal d'Audit</h1>
          <p>Fil d'actualité des activités du système</p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Rechercher une action, un utilisateur..." 
            className="form-control"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '5rem' }}>
          <div className="alert-pulse" style={{ display: 'inline-block', padding: '2rem', borderRadius: '50%' }}>
            <Clock size={48} className="text-muted" />
          </div>
          <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Chargement de la chronologie...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="content-card" style={{ textAlign: 'center', padding: '5rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
          <h3>Aucun événement trouvé</h3>
          <p className="text-muted">Essayez d'ajuster vos critères de recherche.</p>
        </div>
      ) : (
        <div className="timeline">
          {Object.entries(groupedLogs).map(([date, items]) => (
            <div key={date} className="timeline-group">
              <div className="timeline-date-header">
                {date}
              </div>
              
              {items.map((log, index) => {
                const { icon, color } = getActionInfo(log.action);
                return (
                  <div key={log.id} className="timeline-item" style={{ animationDelay: `${index * 0.05}s` }}>
                    <div className="timeline-icon-wrapper">
                      <div className="timeline-icon" style={{ borderColor: color, color: color }}>
                        {icon}
                      </div>
                    </div>
                    <div className="timeline-content">
                      <div className="timeline-header">
                        <div>
                          <div className="timeline-action" style={{ color: color }}>{log.action}</div>
                          <div className="timeline-user">
                            <div className="avatar" style={{ width: '20px', height: '20px', fontSize: '0.6rem' }}>
                              {log.username?.[0].toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{log.username}</span>
                            <span className="timeline-store">
                              <Store size={12} />
                              {log.storeName || 'Système'}
                            </span>
                          </div>
                        </div>
                        <div className="timeline-time">
                          {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      {log.details && (
                        <div className="timeline-details" style={{ borderLeftColor: color }}>
                          {formatDetails(log.details, log.action)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AuditLogs;
