import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Calendar, DollarSign, Printer, Search, User, Wallet, CreditCard, ArrowRight, AlertCircle, CheckCircle2, History, ListFilter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';

const Payments = () => {
  const [activeTab, setActiveTab] = useState('history'); // 'history' or 'outstanding'
  const [payments, setPayments] = useState([]);
  const [outstandingSales, setOutstandingSales] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const { user: currentUser } = useAuth();
  
  // Modal pour nouveau versement
  const [payModal, setPayModal] = useState({ open: false, sale: null, amount: '', notes: '' });
  
  // Modal d'alerte
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '' });
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message });

  useEffect(() => {
    if (activeTab === 'history') {
      loadPayments();
    } else {
      loadOutstandingSales();
    }
  }, [activeTab]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await storage.get('payments');
      setPayments(data);
    } catch (error) {
      console.error("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadOutstandingSales = async () => {
    setLoading(true);
    try {
      const data = await storage.get('sales?pending=true');
      setOutstandingSales(data);
    } catch (error) {
      console.error("Error loading debt sales:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (payment) => {
    setPrintData(payment);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintData(null);
    }, 500);
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    if (!payModal.amount || Number(payModal.amount) <= 0) {
      showAlert('error', 'Erreur', 'Veuillez saisir un montant valide');
      return;
    }

    const remaining = payModal.sale.totalAmount - payModal.sale.amountPaid;
    if (Number(payModal.amount) > remaining) {
      showAlert('warning', 'Attention', `Le montant saisi (${payModal.amount} FCFA) dépasse le reste à payer (${remaining} FCFA).`);
      return;
    }

    // Demander confirmation avant de valider
    setPayModal(prev => ({ ...prev, open: false })); // Fermer le formulaire de saisie
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Confirmer l\'encaissement',
      message: `Voulez-vous enregistrer un versement de ${Number(payModal.amount).toLocaleString('fr-FR')} FCFA pour ${payModal.sale.clientName} ?`,
      onConfirm: async () => {
        setAlertModal(prev => ({ ...prev, open: false }));
        try {
          await storage.create(`sales/${payModal.sale.id}/payments`, {
            amount: Number(payModal.amount),
            notes: payModal.notes,
            date: new Date().toISOString()
          });
          
          setPayModal({ open: false, sale: null, amount: '', notes: '' });
          showAlert('success', 'Paiement enregistré', 'Le versement a été ajouté avec succès !');
          loadOutstandingSales();
        } catch (error) {
          showAlert('error', 'Erreur', error.message);
        }
      }
    });
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

  const filteredHistory = payments.filter(p => 
    p.saleRef?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredOutstanding = outstandingSales
    .filter(s => (s.totalAmount - s.amountPaid) > 1)
    .filter(s => 
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  if (isPrinting && printData) {
    const remaining = printData.saleTotal - printData.saleTotalPaid;
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
            <h2 style={{ margin: '0', fontWeight: 'bold', color: 'black', fontSize: '18px' }}>REÇU DE RÈGLEMENT</h2>
            <p style={{ margin: '5px 0', fontSize: '12px' }}>Date : {formatDate(printData.date)}</p>
          </div>
        </div>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ margin: '0.5rem 0' }}><strong>Référence Vente :</strong> #{printData.saleRef?.substring(0, 8).toUpperCase()}</p>
          <p style={{ margin: '0.5rem 0' }}><strong>Client :</strong> {printData.clientName}</p>
          {printData.clientPhone && <p style={{ margin: '0.5rem 0' }}><strong>Tél Client :</strong> {printData.clientPhone}</p>}
        </div>
        <div style={{ padding: '1.5rem', border: '1px solid black', borderRadius: '4px', marginBottom: '2rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Montant Versé ce jour :</p>
          <p style={{ fontSize: '2rem', fontWeight: '800', margin: '0' }}>{printData.amount.toLocaleString('fr-FR')} FCFA</p>
        </div>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ borderBottom: '1px solid #000', paddingBottom: '0.5rem', marginBottom: '1rem' }}>SITUATION DU COMPTE</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Total de la vente :</span>
              <span style={{ fontWeight: 'bold' }}>{printData.saleTotal?.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Cumul Payé (à ce jour) :</span>
              <span style={{ fontWeight: 'bold' }}>{printData.saleTotalPaid?.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '0.5rem', borderTop: '2px solid black' }}>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>RESTE À PAYER :</span>
              <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>{remaining.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>
        </div>
        <div className="receipt-footer" style={{ textAlign: 'center', marginTop: '5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
          <p style={{ margin: '0.25rem 0' }}>Merci de votre confiance !</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page no-print">
      <div className="page-header">
        <div>
          <h1>Module Règlements</h1>
          <p>Suivi des encaissements et gestion des dettes clients</p>
        </div>
      </div>

      <div className="tab-container" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
          style={{ 
            padding: '0.75rem 1.5rem', 
            borderRadius: '8px 8px 0 0', 
            border: 'none', 
            cursor: 'pointer',
            backgroundColor: activeTab === 'history' ? 'var(--primary-light)' : 'transparent',
            color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <History size={18} /> Historique des Versements
        </button>
        <button 
          className={`tab-btn ${activeTab === 'outstanding' ? 'active' : ''}`}
          onClick={() => setActiveTab('outstanding')}
          style={{ 
            padding: '0.75rem 1.5rem', 
            borderRadius: '8px 8px 0 0', 
            border: 'none', 
            cursor: 'pointer',
            backgroundColor: activeTab === 'outstanding' ? 'var(--danger-light)' : 'transparent',
            color: activeTab === 'outstanding' ? 'var(--danger)' : 'var(--text-muted)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
        >
          <ListFilter size={18} /> Dettes en cours (Impayés)
        </button>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder={activeTab === 'history' ? "Rechercher un versement..." : "Rechercher un débiteur..."}
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
              {activeTab === 'history' ? (
                <tr>
                  <th>Date</th>
                  <th>Réf. Vente</th>
                  <th>Client</th>
                  <th style={{ textAlign: 'right' }}>Montant Versé</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th>Réf. Vente</th>
                  <th>Client / Tél</th>
                  <th style={{ textAlign: 'right' }}>Total Vente</th>
                  <th style={{ textAlign: 'right' }}>Cumul Payé</th>
                  <th style={{ textAlign: 'right' }}>NET À PAYER</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
              ) : activeTab === 'history' ? (
                filteredHistory.length === 0 ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun versement trouvé</td></tr>
                ) : (
                  filteredHistory.map(payment => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.date)}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>#{payment.saleRef?.substring(0, 8).toUpperCase()}</td>
                      <td>{payment.clientName}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>{payment.amount.toLocaleString('fr-FR')} FCFA</td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(payment)}>
                          <Printer size={16} /> Reçu
                        </button>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                filteredOutstanding.length === 0 ? (
                  <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucune dette en cours. Bravo !</td></tr>
                ) : (
                  filteredOutstanding.map(sale => {
                    const balance = sale.totalAmount - sale.amountPaid;
                    return (
                      <tr key={sale.id}>
                        <td style={{ fontWeight: 600, color: 'var(--primary)' }}>#{sale.id.substring(0, 8).toUpperCase()}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{sale.clientName}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sale.clientPhone || 'Pas de tél.'}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{sale.totalAmount.toLocaleString('fr-FR')} FCFA</td>
                        <td style={{ textAlign: 'right', color: 'var(--success)' }}>{sale.amountPaid.toLocaleString('fr-FR')} FCFA</td>
                        <td style={{ textAlign: 'right', fontWeight: 800, color: 'var(--danger)', fontSize: '1.05rem' }}>{balance.toLocaleString('fr-FR')} FCFA</td>
                        <td style={{ textAlign: 'right' }}>
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => setPayModal({ open: true, sale, amount: '', notes: '' })}
                          >
                            <DollarSign size={16} /> Encaisser
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal pour encaisser un paiement */}
      {payModal.open && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, backdropFilter: 'blur(4px)' }}>
          <div className="modal-content" style={{ 
            backgroundColor: 'var(--surface)', 
            color: 'var(--text-main)',
            padding: '2rem', 
            borderRadius: '12px', 
            width: '90%', 
            maxWidth: '430px', 
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            border: '1px solid var(--border-color)'
          }}>
            <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-main)' }}>Encaisser un versement</h2>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
              Vente #{payModal.sale.id.substring(0, 8).toUpperCase()} - {payModal.sale.clientName}
            </p>
            
            <form onSubmit={handleAddPayment}>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  Montant à verser (Reste : {(payModal.sale.totalAmount - payModal.sale.amountPaid).toLocaleString('fr-FR')} FCFA)
                </label>
                <div style={{ position: 'relative' }}>
                  <DollarSign size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input 
                      type="number" 
                      className="form-control" 
                      min="1"
                      value={payModal.amount}
                      onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })}
                      placeholder="Saisir le montant..."
                      required
                      autoFocus
                      style={{ paddingLeft: '2.5rem' }}
                    />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)' }}>Notes (Optionnel)</label>
                <textarea 
                  className="form-control" 
                  value={payModal.notes}
                  onChange={(e) => setPayModal({ ...payModal, notes: e.target.value })}
                  placeholder="Ex: Paiement par Liquidité..."
                  rows="2"
                />
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setPayModal({ open: false, sale: null, amount: '', notes: '' })}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Confirmer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal 
        isOpen={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={alertModal.onConfirm}
        onClose={() => setAlertModal({ ...alertModal, open: false, onConfirm: null })}
      />
    </div>
  );
};

export default Payments;
