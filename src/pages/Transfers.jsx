import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { ArrowRightLeft, Package, Store, Calendar, Plus, X, ArrowRight, Download } from 'lucide-react';
import AlertModal from '../components/AlertModal';

const Transfers = () => {
  const [transfers, setTransfers] = useState([]);
  const [stores, setStores] = useState([]);
  const [articles, setArticles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  }, []);

  const loadData = async () => {
    const [transData, storeData, artData] = await Promise.all([
      storage.get('transfers'),
      storage.get('stores'),
      storage.get('articles')
    ]);
    setTransfers(transData);
    setStores(storeData);
    setArticles(artData);
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
      setAlertModal({ open: true, type: 'error', title: 'Erreur', message: 'Le magasin de départ et d\'arrivée doivent être différents.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.create('transfers', formData);
      setAlertModal({ open: true, type: 'success', title: 'Succès', message: 'Transfert effectué avec succès.' });
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Transferts de Stock</h1>
          <p>Gérez les mouvements entre vos différents magasins</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> Nouveau Transfert
        </button>
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
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {transfers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Aucun transfert enregistré.
                  </td>
                </tr>
              ) : (
                transfers.map(t => (
                  <tr key={t.id}>
                    <td>{new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>{t.articleName}</strong></td>
                    <td><span className="badge badge-secondary">{t.fromStoreName}</span></td>
                    <td><ArrowRight size={14} style={{ margin: '0 8px' }} /><span className="badge badge-primary">{t.toStoreName}</span></td>
                    <td style={{ fontWeight: 'bold' }}>{t.quantity}</td>
                    <td>{t.operatorName}</td>
                    <td><span className="badge badge-success">{t.status}</span></td>
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
              <h3>Nouveau Transfert Inter-Magasin</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Article à transférer</label>
                <select 
                  className="form-control"
                  value={formData.articleId}
                  onChange={(e) => setFormData({...formData, articleId: e.target.value})}
                  required
                >
                  <option value="">Sélectionnez un article</option>
                  {articles.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (Stock Global: {a.currentStock})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Magasin Source</label>
                  <select 
                    className="form-control"
                    value={formData.fromStoreId}
                    onChange={(e) => setFormData({...formData, fromStoreId: e.target.value})}
                    required
                  >
                    <option value="">Départ...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Magasin Destination</label>
                  <select 
                    className="form-control"
                    value={formData.toStoreId}
                    onChange={(e) => setFormData({...formData, toStoreId: e.target.value})}
                    required
                  >
                    <option value="">Arrivée...</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Quantité</label>
                <input 
                  type="number" 
                  min="1"
                  className="form-control"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: parseInt(e.target.value)})}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optionnel)</label>
                <textarea 
                  className="form-control"
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Raison du transfert..."
                />
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Transfert en cours...' : 'Valider le transfert'}
                </button>
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
        onClose={() => setAlertModal({...alertModal, open: false})}
      />
    </div>
  );
};

export default Transfers;
