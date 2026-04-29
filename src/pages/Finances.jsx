import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Calendar, DollarSign, Printer, Download, ArrowRight, Wallet } from 'lucide-react';

const Finances = () => {
  const [payments, setPayments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDailyPayments();
  }, [selectedDate]);

  const loadDailyPayments = async () => {
    setLoading(true);
    try {
      // Use the generic get with a query filter if supported, 
      // or fetch all and filter client-side for simplicity if API isn't fully ready
      const allPayments = await storage.get(`payments?date=${selectedDate}`);
      setPayments(allPayments);
    } catch (error) {
      console.error("Error loading payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalCollected = payments.reduce((sum, p) => {
    if (p.saleStatus === 'annulée') return sum;
    return sum + p.amount;
  }, 0);

  const activePaymentsCount = payments.filter(p => p.saleStatus !== 'annulée').length;

  const handlePrint = () => {
    window.print();
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="page">
      <div className="page-header no-print">
        <div>
          <h1>Clôture de Caisse</h1>
          <p>Suivi des encaissements journaliers</p>
        </div>
        <div className="header-actions">
          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} className="text-muted" />
            <input 
              type="date" 
              className="form-control" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <Printer size={16} /> Imprimer
          </button>
        </div>
      </div>

      <div className="dashboard-grid no-print">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {totalCollected.toLocaleString('fr-FR')} FCFA
          </div>
          <div className="stat-label">Total Encaissé</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {activePaymentsCount}
          </div>
          <div className="stat-label">Transactions Valides</div>
        </div>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          <div className="receipt-print-only">
             <h2 style={{ textAlign: 'center' }}>Rapport de Caisse Journalier</h2>
             <p style={{ textAlign: 'center' }}>Date : {new Date(selectedDate).toLocaleDateString('fr-FR')}</p>
          </div>
          
          <table className="payments-table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Référence Vente</th>
                <th>Client</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center' }}>Chargement...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Aucun encaissement pour cette date</td></tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      #{payment.saleRef?.substring(0, 8).toUpperCase()}
                      {payment.saleStatus === 'annulée' && (
                        <span className="badge badge-danger" style={{ fontSize: '0.65rem', padding: '2px 4px' }}>Annulée</span>
                      )}
                    </td>
                    <td>{payment.clientName}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{payment.notes || '-'}</td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontWeight: 700, 
                      color: payment.saleStatus === 'annulée' ? 'var(--text-muted)' : 'var(--success)',
                      textDecoration: payment.saleStatus === 'annulée' ? 'line-through' : 'none'
                    }}>
                      {payment.amount.toLocaleString('fr-FR')} FCFA
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {payments.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right', fontWeight: 700, paddingTop: '1.5rem' }}>TOTAL ENCAISSÉ</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.2rem', color: 'var(--success)', paddingTop: '1.5rem' }}>
                    {totalCollected.toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

    </div>
  );
};

export default Finances;
