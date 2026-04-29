import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Plus, ShoppingCart, Calendar, User, ChevronDown, ChevronUp, Package, Printer, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { DollarSign, AlertCircle, Search, XCircle } from 'lucide-react';
import AlertModal from '../components/AlertModal';

const Sales = () => {
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
  // Modal d'alerte/confirmation
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
    setSales(await storage.get('sales'));
  };

  const handlePrint = (sale) => {
    setPrintData(sale);
    setIsPrinting(true);
    // Give state time to update and DOM to re-render
    setTimeout(() => {
      window.print();
      // Reset after print dialog is closed
      setIsPrinting(false);
      setPrintData(null);
    }, 500);
  };

  const toggleExpand = (id) => {
    if (expandedSale === id) {
      setExpandedSale(null);
    } else {
      setExpandedSale(id);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
        notes: newPayment.notes,
        date: new Date().toISOString()
      });
      setPaymentModal({ ...paymentModal, open: false });
      setNewPayment({ amount: '', notes: '' });
      loadSales();
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
          const token = sessionStorage.getItem('token');
          const response = await fetch(`/api/sales/${id}/cancel`, {
            method: 'POST',
            headers: {
              'Authorization': token ? `Bearer ${token}` : ''
            }
          });
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || "Erreur lors de l'annulation");
          }
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
      <div className="receipt-print-only" style={{ display: 'block', backgroundColor: 'white', minHeight: '100vh', padding: '20px' }}>
        <div className="receipt-header" style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ color: 'black', margin: '0', fontSize: '22px', textTransform: 'uppercase', fontWeight: '800' }}>GESTION DE STOCK</h1>
          <div style={{ margin: '10px 0' }}>
            <p style={{ margin: '2px 0', fontSize: '15px' }}><strong>Entreprise :</strong> VOTRE BOUTIQUE</p>
            <p style={{ margin: '2px 0', fontSize: '13px' }}><strong>Adresse :</strong> ******</p>
            <p style={{ margin: '2px 0', fontSize: '13px' }}><strong>Contact :</strong> ******</p>
          </div>
          <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '10px' }}>
            <p style={{ margin: '0', fontWeight: 'bold', color: 'black' }}>REÇU DE VENTE #{printData.id.substring(0, 8).toUpperCase()}</p>
            <p style={{ margin: '0', fontSize: '12px' }}>Date : {formatDate(printData.date)}</p>
          </div>
        </div>
        
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ margin: '0.25rem 0' }}><strong>Client :</strong> {printData.clientName}</p>
          {printData.clientPhone && <p style={{ margin: '0.25rem 0' }}><strong>Tél Client :</strong> {printData.clientPhone}</p>}
          <p style={{ margin: '0.25rem 0' }}><strong>Vendeur :</strong> {printData.sellerName}</p>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black' }}>
              <th style={{ textAlign: 'left', padding: '8px', color: 'black' }}>Article</th>
              <th style={{ textAlign: 'center', padding: '8px', color: 'black' }}>Qté</th>
              <th style={{ textAlign: 'right', padding: '8px', color: 'black' }}>Prix Unitaire</th>
              <th style={{ textAlign: 'right', padding: '8px', color: 'black' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {printData.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{item.articleName}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{item.unitPrice.toLocaleString('fr-FR')} FCFA</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>
                  {(item.quantity * item.unitPrice).toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid black' }}>
              <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: '1rem' }}>Sous-total</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: '1rem' }}>
                {(printData.totalAmount + (printData.discount || 0)).toLocaleString('fr-FR')} FCFA
              </td>
            </tr>
            {printData.discount > 0 && (
              <tr style={{ color: 'black' }}>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Remise</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  -{printData.discount.toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            )}
            <tr style={{ borderTop: '1px solid black' }}>
              <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Net</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.2rem' }}>
                {printData.totalAmount.toLocaleString('fr-FR')} FCFA
              </td>
            </tr>
            <tr>
              <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Montant Versé</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                {printData.amountPaid.toLocaleString('fr-FR')} FCFA
              </td>
            </tr>
            {printData.totalAmount - printData.amountPaid > 0 && (
              <tr style={{ color: 'black' }}>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Reste à Payer</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '1px solid black' }}>
                  {(printData.totalAmount - printData.amountPaid).toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            )}
          </tfoot>
        </table>
        
        <div className="receipt-footer" style={{ textAlign: 'center', marginTop: '3rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <p style={{ margin: '0.25rem 0' }}>Merci de votre confiance !</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="no-print">
        <div className="page-header">
        <div>
          <h1>Ventes</h1>
          <p>Historique des ventes effectuées</p>
        </div>
        <Link to="/sales/new" className="btn btn-primary">
          <Plus size={16} /> Nouvelle Vente
        </Link>
      </div>

        <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher une vente par référence ou nom du client..." 
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
                <th style={{ width: '130px', minWidth: '130px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSales.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {searchTerm ? "Aucune vente ne correspond à votre recherche" : "Aucune vente enregistrée"}
                  </td>
                </tr>
              ) : (
                currentSales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    <tr onClick={() => toggleExpand(sale.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        {expandedSale === sale.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                        #{sale.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User size={14} className="text-muted" />
                          {sale.clientName}
                        </div>
                      </td>
                      {currentUser?.role === 'admin' && (
                        <td>
                          <span className="badge badge-secondary" style={{ textTransform: 'none' }}>
                            {sale.sellerName}
                          </span>
                        </td>
                      )}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar size={14} className="text-muted" />
                          {formatDate(sale.date)}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{sale.totalAmount.toLocaleString('fr-FR')} FCFA</td>
                      <td>
                        {getStatusBadge(sale.status)}
                        {sale.status !== 'payé' && sale.dueDate && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '2px' }}>
                            Échéance: {formatShortDate(sale.dueDate)}
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(sale.id);
                          }} title="Détails">
                            <Eye size={14} />
                          </button>
                          {sale.status !== 'payé' && sale.status !== 'annulée' && (
                            <button className="btn btn-primary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => {
                              e.stopPropagation();
                              setPaymentModal({ open: true, saleId: sale.id, total: sale.totalAmount, paid: sale.amountPaid });
                              setNewPayment({ amount: sale.totalAmount - sale.amountPaid, notes: '' });
                            }} title="Encaisser">
                              <DollarSign size={14} />
                            </button>
                          )}
                          <button className="btn btn-secondary btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => {
                            e.stopPropagation();
                            handlePrint(sale);
                          }} title="Imprimer">
                            <Printer size={14} />
                          </button>
                          {sale.status !== 'annulée' && (
                            <button className="btn btn-danger-outline btn-sm" style={{ padding: '0.25rem 0.5rem' }} onClick={(e) => {
                              e.stopPropagation();
                              handleCancelSale(sale.id);
                            }} title="Annuler la vente">
                              <XCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedSale === sale.id && (
                      <tr className="expanded-row" style={{ backgroundColor: 'var(--bg-light)' }}>
                        <td colSpan={currentUser?.role === 'admin' ? 7 : 6}>
                          <div style={{ padding: '1rem', borderLeft: '3px solid var(--primary)' }}>
                            <h4 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Package size={16} /> Articles vendus
                            </h4>
                            <div className="table-wrapper" style={{ backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                              <table style={{ margin: 0 }}>
                                <thead>
                                  <tr>
                                    <th style={{ color: 'var(--text-muted)' }}>Article</th>
                                    <th style={{ color: 'var(--text-muted)' }}>Quantité</th>
                                    <th style={{ color: 'var(--text-muted)' }}>Unit Price</th>
                                    <th style={{ color: 'var(--text-muted)', textAlign: 'right' }}>Sous-total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {sale.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td style={{ color: 'var(--text-main)' }}>{item.articleName}</td>
                                      <td style={{ color: 'var(--text-main)' }}>{item.quantity}</td>
                                      <td style={{ color: 'var(--text-main)' }}>{item.unitPrice.toLocaleString('fr-FR')} FCFA</td>
                                      <td style={{ fontWeight: 500, color: 'var(--text-main)', textAlign: 'right' }}>
                                        {(item.quantity * item.unitPrice).toLocaleString('fr-FR')} FCFA
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr>
                                    <th colSpan="3" style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Total</th>
                                    <th style={{ color: 'var(--primary)', fontSize: '1.2rem', textAlign: 'right' }}>
                                      {sale.totalAmount.toLocaleString('fr-FR')} FCFA
                                    </th>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>

                            <div style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                              <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                                  <DollarSign size={16} /> État du paiement
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Total facturé</span>
                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{sale.totalAmount.toLocaleString('fr-FR')} FCFA</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Déjà payé</span>
                                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>{sale.amountPaid.toLocaleString('fr-FR')} FCFA</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Reste à payer</span>
                                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{(sale.totalAmount - sale.amountPaid).toLocaleString('fr-FR')} FCFA</span>
                                  </div>
                                </div>
                              </div>
                              
                              {sale.dueDate && (
                                <div style={{ padding: '1.25rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                  <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
                                    <Calendar size={16} /> Échéance
                                  </h4>
                                  <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--danger)' }}>
                                      {formatShortDate(sale.dueDate)}
                                    </div>
                                    <p style={{ fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                                      Date limite de paiement complet
                                    </p>
                                  </div>
                                </div>
                              )}
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
          <div className="pagination" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '1rem', 
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--primary-light)',
            borderRadius: '0 0 8px 8px'
          }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--primary-dark)', fontWeight: 500 }}>
              Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredSales.length)} sur {filteredSales.length} ventes
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button 
                className="btn btn-primary-light btn-sm" 
                onClick={() => {
                   setCurrentPage(prev => Math.max(prev - 1, 1));
                   window.scrollTo(0, 0);
                }}
                disabled={currentPage === 1}
                style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--primary)' }}
              >
                <ChevronLeft size={16} color="var(--primary)" />
              </button>
              
              <span style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: '80px', textAlign: 'center', color: 'var(--primary-dark)' }}>
                Page {currentPage} / {totalPages}
              </span>

              <button 
                className="btn btn-primary-light btn-sm" 
                onClick={() => {
                  setCurrentPage(prev => Math.min(prev + 1, totalPages));
                  window.scrollTo(0, 0);
                }}
                disabled={currentPage === totalPages}
                style={{ padding: '0.25rem 0.5rem', backgroundColor: 'var(--surface)', border: '1px solid var(--primary)' }}
              >
                <ChevronRight size={16} color="var(--primary)" />
              </button>
            </div>
          </div>
        )}
      </div>


      {/* Payment Modal */}
      {paymentModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ margin: 0 }}>Enregistrer un paiement</h3>
                <p className="text-muted" style={{ fontSize: '0.8rem', margin: '4px 0 0' }}>Vente #{paymentModal.saleId?.substring(0,8).toUpperCase()}</p>
              </div>
              <button className="modal-close" onClick={() => setPaymentModal({ ...paymentModal, open: false })}>
                &times;
              </button>
            </div>
            
            <form onSubmit={handleAddPayment}>
              <div className="modal-body">
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="text-muted">Solde restant :</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1.1rem' }}>
                      {(paymentModal.total - paymentModal.paid).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Montant du versement</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    required 
                    value={newPayment.amount}
                    onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                    max={paymentModal.total - paymentModal.paid}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Notes (Optionnel)</label>
                  <textarea 
                    className="form-control" 
                    rows="2"
                    value={newPayment.notes}
                    onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}
                    placeholder="Ex: Espèces, Virement..."
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal({ ...paymentModal, open: false })}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  Valider le paiement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'alerte/confirmation */}
      <AlertModal
        isOpen={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={closeAlert}
        onConfirm={alertModal.onConfirm}
        confirmLabel={alertModal.type === 'confirm' ? 'Confirmer l\'annulation' : undefined}
      />
    </div>
  </div>
);
};

export default Sales;
