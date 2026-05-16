'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Calendar, Printer, DollarSign } from 'lucide-react';
import { useAuth } from '../../providers';

export default function FinancesPage() {
  const [payments, setPayments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const { user: currentUser } = useAuth();
  
  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  useEffect(() => {
    loadDailyPayments();
    loadSettings();
  }, [selectedDate]);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

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

      <div className="dashboard-grid no-print" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: '2rem' }}>
        <div className="stat-card stat-card-premium bg-gradient-green">
          <div className="stat-icon-bg"><DollarSign size={48} /></div>
          <div className="stat-label">Total Encaissé</div>
          <div className="stat-value">
            {formatPrice(totalCollected)} FCFA
          </div>
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: '100%' }}></div>
          </div>
          <div className="card-trend">
            <span>Rapport journalier</span>
          </div>
        </div>
        
        <div className="stat-card stat-card-premium bg-gradient-blue">
          <div className="stat-icon-bg"><Calendar size={48} /></div>
          <div className="stat-label">Transactions</div>
          <div className="stat-value">
            {activePaymentsCount}
          </div>
          <div className="card-progress-container">
            <div className="card-progress-bar" style={{ width: '100%' }}></div>
          </div>
          <div className="card-trend">
            <span>Volume du jour</span>
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          {/* Version Impression */}
          <div className="receipt-print-only" style={{ display: 'none' }}>
            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
              {settings?.logo ? (
                <img src={settings.logo} alt="Logo" style={{ maxHeight: '80px', marginBottom: '10px' }} />
              ) : (
                <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'MINING AUTOLOG'}</h1>
              )}
              {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
              {settings?.phone && <p style={{ margin: '2px 0' }}>Tél : {settings.phone}</p>}
              {settings?.nif && <p style={{ margin: '2px 0' }}>NIF : {settings.nif}</p>}
              {settings?.rccm && <p style={{ margin: '2px 0' }}>RCCM : {settings.rccm}</p>}
              <h2 style={{ marginTop: '15px' }}>RAPPORT DE CAISSE JOURNALIER</h2>
              <p>Date : {new Date(selectedDate).toLocaleDateString('fr-FR')}</p>
            </div>
          </div>
          
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    <td>{payment.notes || '-'}</td>
                    <td style={{ 
                      textAlign: 'right', 
                      fontWeight: 700, 
                      color: payment.saleStatus === 'annulée' ? 'var(--text-muted)' : 'var(--success)',
                      textDecoration: payment.saleStatus === 'annulée' ? 'line-through' : 'none'
                    }}>
                      {formatPrice(payment.amount)} FCFA
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
                    {formatPrice(totalCollected)} FCFA
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
