'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Calendar, Printer, DollarSign } from 'lucide-react';

export default function FinancesPage() {
  const [payments, setPayments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDailyPayments();
  }, [selectedDate]);

  const loadDailyPayments = async () => {
    setLoading(true);
    try {
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

  return (
    <div className="page">
      <div className="page-header no-print">
        <div>
          <h1>Clôture de Caisse</h1>
          <p>Suivi des encaissements journaliers</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} className="text-muted" />
            <input 
              type="date" 
              className="form-control" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ width: 'auto' }}
            />
          </div>
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimer
          </button>
        </div>
      </div>

      <div className="dashboard-grid no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <DollarSign size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value" style={{ color: 'var(--success)' }}>
              {totalCollected.toLocaleString('fr-FR')} FCFA
            </div>
            <div className="stat-label">Total Encaissé</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Calendar size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">
              {activePaymentsCount}
            </div>
            <div className="stat-label">Transactions</div>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          <div className="receipt-print-only" style={{ textAlign: 'center', marginBottom: '2rem' }}>
             <h2>Rapport de Caisse Journalier</h2>
             <p>Date : {new Date(selectedDate).toLocaleDateString('fr-FR')}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Heure</th>
                <th>Vente</th>
                <th>Client</th>
                <th>Notes</th>
                <th style={{ textAlign: 'right' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Chargement...</td></tr>
              ) : payments.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Aucun encaissement</td></tr>
              ) : (
                payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{new Date(payment.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td style={{ fontWeight: 600, color: 'var(--primary)' }}>
                      #{payment.saleRef?.substring(0, 8).toUpperCase()}
                      {payment.saleStatus === 'annulée' && <span className="badge badge-danger" style={{ marginLeft: '8px', fontSize: '0.7rem' }}>Annulée</span>}
                    </td>
                    <td>{payment.clientName}</td>
                    <td className="text-muted">{payment.notes || '-'}</td>
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
                  <td colSpan="4" style={{ textAlign: 'right', fontWeight: 700, paddingTop: '1rem' }}>TOTAL</td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.2rem', color: 'var(--success)', paddingTop: '1rem' }}>
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
}
