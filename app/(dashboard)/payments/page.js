'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  DollarSign, Printer, Search, History, ListFilter, X 
} from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { useAuth } from '../../providers';

export default function PaymentsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('history'); 
  const [payments, setPayments] = useState([]);
  const [outstandingSales, setOutstandingSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [stores, setStores] = useState([]);
  
  const [payModal, setPayModal] = useState({ open: false, sale: null, amount: '', notes: '' });
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, sData, storesData] = await Promise.all([
        storage.get('payments'),
        storage.get('sales?pending=true'),
        storage.get('stores')
      ]);
      setPayments(pData || []);
      setOutstandingSales(sData || []);
      setStores(storesData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    const amount = Number(payModal.amount);
    const remaining = payModal.sale.totalAmount - payModal.sale.amountPaid;
    if (amount <= 0 || amount > remaining) return setAlertModal({ open: true, type: 'error', title: 'Erreur', message: 'Montant invalide.' });

    setAlertModal({
      open: true, type: 'confirm', title: 'Confirmer',
      message: `Encaisser ${amount.toLocaleString()} FCFA de ${payModal.sale.clientName} ?`,
      onConfirm: async () => {
        setAlertModal({ open: false });
        try {
          await storage.create(`sales/${payModal.sale.id}/payments`, { amount, notes: payModal.notes });
          setPayModal({ open: false, sale: null, amount: '', notes: '' });
          setAlertModal({ open: true, type: 'success', title: 'Succès', message: 'Paiement enregistré !' });
          loadData();
        } catch (err) { setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message }); }
      }
    });
  };

  const filteredHistory = payments.filter(p => p.saleRef?.toLowerCase().includes(searchTerm.toLowerCase()) || p.clientName?.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredOutstanding = outstandingSales.filter(s => s.status !== 'Annulée' && s.clientName?.toLowerCase().includes(searchTerm.toLowerCase()));

  // Calculs statistiques
  const totalPaid = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const totalUnpaid = outstandingSales
    .filter(s => s.status !== 'Annulée')
    .reduce((acc, s) => acc + ((Number(s.totalAmount) || 0) - (Number(s.amountPaid) || 0)), 0);

  const paidByStore = {};
  payments.forEach(p => {
    const sId = p.storeId || 'global';
    paidByStore[sId] = (paidByStore[sId] || 0) + (Number(p.amount) || 0);
  });

  const unpaidByStore = {};
  outstandingSales
    .filter(s => s.status !== 'Annulée')
    .forEach(s => {
      const sId = s.storeId || 'global';
      unpaidByStore[sId] = (unpaidByStore[sId] || 0) + ((Number(s.totalAmount) || 0) - (Number(s.amountPaid) || 0));
    });

  const getStoreName = (storeId) => {
    if (storeId === 'global' || !storeId) return 'Global / Autre';
    const store = stores.find(s => String(s.id) === String(storeId));
    return store ? store.name : `Magasin #${storeId}`;
  };

  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    return Number(val).toLocaleString('fr-FR');
  };

  return (
    <div className="page">
      <div className="page-header"><div><h1>Règlements</h1><p>Suivi des encaissements et dettes</p></div></div>

      {/* Cards de statistiques */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: '1.5rem', gap: '1rem' }}>
        {/* Card Réglés */}
        <div className="stat-card stat-card-premium bg-gradient-green">
          <div className="stat-icon-bg"><DollarSign size={48} /></div>
          <div className="stat-label">Total des Encaissements</div>
          <div className="stat-value">{formatPrice(totalPaid)} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>FCFA</span></div>
          
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', zIndex: 2 }}>
            <div style={{ fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '4px' }}>Par Magasin :</div>
            {Object.keys(paidByStore).length === 0 ? (
              <div style={{ opacity: 0.8 }}>Aucun encaissement</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                {Object.entries(paidByStore).map(([sId, amt]) => (
                  <div key={sId} style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9 }}>
                    <span>{getStoreName(sId)} :</span>
                    <span style={{ fontWeight: 700 }}>{formatPrice(amt)} FCFA</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card Impayés */}
        <div className="stat-card stat-card-premium bg-gradient-red">
          <div className="stat-icon-bg"><ListFilter size={48} /></div>
          <div className="stat-label">Total des Impayés</div>
          <div className="stat-value">{formatPrice(totalUnpaid)} <span style={{ fontSize: '1rem', fontWeight: 'normal' }}>FCFA</span></div>
          
          <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', zIndex: 2 }}>
            <div style={{ fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '4px', marginBottom: '4px' }}>Par Magasin :</div>
            {Object.keys(unpaidByStore).length === 0 ? (
              <div style={{ opacity: 0.8 }}>Aucun impayé</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                {Object.entries(unpaidByStore).map(([sId, amt]) => (
                  <div key={sId} style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.9 }}>
                    <span>{getStoreName(sId)} :</span>
                    <span style={{ fontWeight: 700 }}>{formatPrice(amt)} FCFA</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
        <button className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('history')}><History size={18} /> Historique</button>
        <button className={`btn ${activeTab === 'outstanding' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('outstanding')}><ListFilter size={18} /> Impayés</button>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input type="text" className="form-control" placeholder="Rechercher..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: '2.5rem' }} />
        </div>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              {activeTab === 'history' ? (
                <tr><th>Date</th><th>Vente</th><th>Client</th><th style={{ textAlign: 'right' }}>Montant</th><th>Action</th></tr>
              ) : (
                <tr><th>Vente</th><th>Client</th><th style={{ textAlign: 'right' }}>Total</th><th style={{ textAlign: 'right' }}>Payé</th><th style={{ textAlign: 'right' }}>RESTE</th><th>Action</th></tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
              ) : activeTab === 'history' ? (
                filteredHistory.map(p => (
                  <tr key={p.id}>
                    <td>{new Date(p.date).toLocaleString('fr-FR')}</td>
                    <td style={{ color: 'var(--primary)', fontWeight: 600 }}>#{p.saleRef?.substring(0, 8).toUpperCase()}</td>
                    <td>{p.clientName}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{p.amount.toLocaleString()} FCFA</td>
                    <td><button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Printer size={16} /></button></td>
                  </tr>
                ))
              ) : (
                filteredOutstanding.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--primary)', fontWeight: 600 }}>#{s.id.substring(0, 8).toUpperCase()}</td>
                    <td><strong>{s.clientName}</strong></td>
                    <td style={{ textAlign: 'right' }}>{s.totalAmount.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)' }}>{s.amountPaid.toLocaleString()}</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--danger)' }}>{(s.totalAmount - s.amountPaid).toLocaleString()} FCFA</td>
                    <td>
                      {user?.role !== 'observateur' && (
                        <button className="btn btn-primary btn-sm" onClick={() => setPayModal({ open: true, sale: s, amount: '', notes: '' })}><DollarSign size={16} /> Encaisser</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header"><h3>Encaisser un versement</h3><button className="modal-close" onClick={() => setPayModal({ open: false })}><X size={20} /></button></div>
            <form onSubmit={handleAddPayment}>
              <div className="modal-body">
                <p>Vente #{payModal.sale.id.substring(0, 8).toUpperCase()} - {payModal.sale.clientName}</p>
                <div className="form-group"><label className="form-label">Montant (Reste: {(payModal.sale.totalAmount - payModal.sale.amountPaid).toLocaleString()} FCFA)</label><input type="number" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} min="0" className="form-control" required value={payModal.amount} onChange={e => setPayModal({...payModal, amount: e.target.value})} autoFocus /></div>
                <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" value={payModal.notes} onChange={e => setPayModal({...payModal, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setPayModal({ open: false })}>Annuler</button><button type="submit" className="btn btn-primary">Confirmer</button></div>
            </form>
          </div>
        </div>
      )}
      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={() => setAlertModal({...alertModal, open: false})} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
