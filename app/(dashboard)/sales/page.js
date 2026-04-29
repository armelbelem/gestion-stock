'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  Plus, ShoppingCart, Calendar, User, ChevronDown, ChevronUp, 
  Package, Printer, Eye, ChevronLeft, ChevronRight,
  DollarSign, Search, XCircle 
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '../../providers';
import AlertModal from '../../components/AlertModal';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [expandedSale, setExpandedSale] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ open: false, saleId: null, total: 0, paid: 0 });
  const [newPayment, setNewPayment] = useState({ amount: '', notes: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { user: currentUser } = useAuth();
  
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async () => {
    try {
      const data = await storage.get('sales');
      setSales(data);
    } catch (err) {
      console.error("Error loading sales:", err);
    }
  };

  const handlePrint = (sale) => {
    setPrintData(sale);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintData(null);
    }, 500);
  };

  const toggleExpand = (id) => {
    setExpandedSale(expandedSale === id ? null : id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'payé': return <span className="badge badge-success">Payé</span>;
      case 'partiel': return <span className="badge badge-warning">Partiel</span>;
      case 'en_attente': return <span className="badge badge-danger">En attente</span>;
      case 'annulée': return <span className="badge badge-danger">Annulée</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      await storage.create(`sales/${paymentModal.saleId}/payments`, {
        amount: Number(newPayment.amount),
        notes: newPayment.notes
      });
      setPaymentModal({ ...paymentModal, open: false });
      setNewPayment({ amount: '', notes: '' });
      loadSales();
      showAlert('success', 'Succès', 'Paiement enregistré !');
    } catch (error) {
      showAlert('error', 'Erreur', error.message);
    }
  };

  const handleCancelSale = (id) => {
    showConfirm(
      'Annuler la vente',
      'Êtes-vous sûr de vouloir annuler cette vente ? Le stock sera restitué et la vente sera marquée comme annulée.',
      async () => {
        closeAlert();
        try {
          await storage.create(`sales/${id}/cancel`, {});
          showAlert('success', 'Succès', 'Vente annulée avec succès.');
          loadSales();
        } catch (error) {
          showAlert('error', 'Erreur', error.message);
        }
      }
    );
  };

  const filteredSales = sales.filter(sale => 
    sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.clientName && sale.clientName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSales = filteredSales.slice(indexOfFirstItem, indexOfLastItem);

  if (isPrinting && printData) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '22px', fontWeight: '800' }}>MINING AUTOLOG</h1>
          <p>REÇU DE VENTE #{printData.id.substring(0, 8).toUpperCase()}</p>
          <p>Date : {formatDate(printData.date)}</p>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <p><strong>Client :</strong> {printData.clientName}</p>
          <p><strong>Vendeur :</strong> {printData.sellerName}</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Article</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Qté</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {printData.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{item.articleName}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{(item.quantity * item.unitPrice).toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan="2" style={{ textAlign: 'right', padding: '8px' }}>TOTAL NET</td>
              <td style={{ textAlign: 'right', padding: '8px' }}>{printData.totalAmount.toLocaleString()} FCFA</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Ventes</h1>
          <p>Historique des ventes effectuées</p>
        </div>
        <Link href="/sales/new" className="btn btn-primary">
          <Plus size={16} /> Nouvelle Vente
        </Link>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher une vente..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>
      
      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Référence</th>
                <th>Client</th>
                {currentUser?.role === 'admin' && <th>Vendeur</th>}
                <th>Date</th>
                <th>Montant</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSales.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Aucune vente trouvée.</td></tr>
              ) : (
                currentSales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    <tr onClick={() => toggleExpand(sale.id)} style={{ cursor: 'pointer' }}>
                      <td>{expandedSale === sale.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>#{sale.id.substring(0, 8).toUpperCase()}</td>
                      <td>{sale.clientName}</td>
                      {currentUser?.role === 'admin' && <td>{sale.sellerName}</td>}
                      <td>{formatDate(sale.date)}</td>
                      <td style={{ fontWeight: 600 }}>{sale.totalAmount.toLocaleString()} FCFA</td>
                      <td>{getStatusBadge(sale.status)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); toggleExpand(sale.id); }}><Eye size={14} /></button>
                          {sale.status !== 'payé' && sale.status !== 'annulée' && (
                            <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setPaymentModal({ open: true, saleId: sale.id, total: sale.totalAmount, paid: sale.amountPaid }); setNewPayment({ amount: sale.totalAmount - sale.amountPaid, notes: '' }); }}><DollarSign size={14} /></button>
                          )}
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); handlePrint(sale); }}><Printer size={14} /></button>
                          {sale.status !== 'annulée' && (
                            <button className="btn btn-danger-outline btn-sm" onClick={(e) => { e.stopPropagation(); handleCancelSale(sale.id); }}><XCircle size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedSale === sale.id && (
                      <tr className="expanded-row">
                        <td colSpan="8">
                          <div style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
                            <h4>Articles vendus</h4>
                            <div className="table-wrapper">
                              <table>
                                <thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
                                <tbody>
                                  {sale.items.map((item, idx) => (
                                    <tr key={idx}><td>{item.articleName}</td><td>{item.quantity}</td><td>{item.unitPrice.toLocaleString()} FCFA</td><td style={{ textAlign: 'right' }}>{(item.quantity * item.unitPrice).toLocaleString()} FCFA</td></tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '2rem' }}>
                              <div style={{ textAlign: 'right' }}>
                                <p className="text-muted">Payé : {sale.amountPaid.toLocaleString()} FCFA</p>
                                <p style={{ fontWeight: 700, color: 'var(--danger)' }}>Reste : {(sale.totalAmount - sale.amountPaid).toLocaleString()} FCFA</p>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
            <span>Page {currentPage} / {totalPages}</span>
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {paymentModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Enregistrer un paiement</h3>
              <button className="modal-close" onClick={() => setPaymentModal({ ...paymentModal, open: false })}>&times;</button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Montant (Reste: {(paymentModal.total - paymentModal.paid).toLocaleString()} FCFA)</label>
                  <input type="number" className="form-control" required value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} max={paymentModal.total - paymentModal.paid} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows="2" value={newPayment.notes} onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal({ ...paymentModal, open: false })}>Annuler</button>
                <button type="submit" className="btn btn-primary">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
