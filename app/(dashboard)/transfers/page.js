'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, X, ArrowRight, ArrowRightLeft, Download, FileText } from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { exportToExcel } from '../../utils/excelExport';

export default function TransfersPage() {
  const [transfers, setTransfers] = useState([]);
  const [stores, setStores] = useState([]);
  const [articles, setArticles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [formData, setFormData] = useState({
    articleId: '',
    fromStoreId: '',
    toStoreId: '',
    quantity: 1,
    notes: ''
  });

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadData = async () => {
    try {
      const [transData, storeData, artData] = await Promise.all([
        storage.get('transfers'),
        storage.get('stores'),
        storage.get('articles')
      ]);
      setTransfers(transData);
      setStores(storeData);
      setArticles(artData);
    } catch (err) {
      console.error("Error loading transfers data:", err);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      { key: 'dateFormatted', label: 'Date' },
      { key: 'articleName', label: 'Article' },
      { key: 'fromStoreName', label: 'Source' },
      { key: 'toStoreName', label: 'Destination' },
      { key: 'quantity', label: 'Quantité' },
      { key: 'operatorName', label: 'Opérateur' }
    ];
    
    const dataToExport = transfers.map(t => ({
      ...t,
      dateFormatted: new Date(t.date).toLocaleString('fr-FR')
    }));

    exportToExcel(dataToExport, headers, 'rapport_transferts', {
      title: "HISTORIQUE DES TRANSFERTS",
      companyName: settings?.companyName || "NS AUTO",
      period: `Le ${new Date().toLocaleDateString('fr-FR')}`
    });
  };

  const handlePrintReport = () => {
    setIsReporting(true);
    setTimeout(() => {
      window.print();
      setIsReporting(false);
    }, 500);
  };

  const handleOpenModal = () => {
    setFormData({
      articleId: articles[0]?.id || '',
      fromStoreId: '',
      toStoreId: '',
      quantity: 1,
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.fromStoreId === formData.toStoreId) {
      setAlertModal({ open: true, type: 'error', title: 'Erreur', message: 'Les magasins doivent être différents.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.create('transfers', formData);
      setAlertModal({ open: true, type: 'success', title: 'Succès', message: 'Transfert effectué !' });
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isReporting) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'NS AUTO'}</h1>
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          <h2 style={{ marginTop: '15px' }}>RAPPORT DES TRANSFERTS</h2>
          <p>Généré le : {new Date().toLocaleString('fr-FR')}</p>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Article</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>De</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Vers</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Qté</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{new Date(t.date).toLocaleString('fr-FR')}</td>
                <td style={{ padding: '8px', fontWeight: 500 }}>{t.articleName}</td>
                <td style={{ padding: '8px' }}>{t.fromStoreName}</td>
                <td style={{ padding: '8px' }}>{t.toStoreName}</td>
                <td style={{ textAlign: 'center', padding: '8px', fontWeight: 'bold' }}>{t.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '30px', fontSize: '0.8rem', textAlign: 'right' }}>
          Généré le {new Date().toLocaleString()}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Transferts de Stock</h1>
          <p>Mouvements entre vos différents magasins</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel} title="Exporter Excel">
            <Download size={18} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={handlePrintReport} title="Imprimer / PDF">
            <FileText size={18} /> PDF
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            <Plus size={18} /> Nouveau Transfert
          </button>
        </div>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Article</th>
                <th>De</th>
                <th>Vers</th>
                <th>Quantité</th>
                <th>Opérateur</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Aucun transfert enregistré.</td></tr>
              ) : (
                transfers.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleString('fr-FR')}</td>
                    <td><strong>{t.articleName}</strong></td>
                    <td><span className="badge badge-secondary">{t.fromStoreName}</span></td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ArrowRight size={14} /><span className="badge badge-primary">{t.toStoreName}</span></div></td>
                    <td style={{ fontWeight: 'bold' }}>{t.quantity}</td>
                    <td>{t.operatorName}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Nouveau Transfert</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Article</label>
                  <select className="form-control" value={formData.articleId} onChange={(e) => setFormData({...formData, articleId: e.target.value})} required>
                    <option value="">Sélectionner...</option>
                    {articles.map(a => <option key={a.id} value={a.id}>{a.name} (Global: {a.currentStock})</option>)}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group"><label className="form-label">De</label><select className="form-control" value={formData.fromStoreId} onChange={(e) => setFormData({...formData, fromStoreId: e.target.value})} required>
                    <option value="">Source...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                  <div className="form-group"><label className="form-label">Vers</label><select className="form-control" value={formData.toStoreId} onChange={(e) => setFormData({...formData, toStoreId: e.target.value})} required>
                    <option value="">Destination...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                </div>
                <div className="form-group"><label className="form-label">Quantité</label><input type="number" className="form-control" min="1" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})} required /></div>
                <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{isSubmitting ? 'En cours...' : 'Valider'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={() => setAlertModal({...alertModal, open: false})} />
    </div>
  );
}
