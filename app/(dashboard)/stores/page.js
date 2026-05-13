'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Store, Plus, Edit2, Trash2, X, MapPin } from 'lucide-react';
import AlertModal from '../../components/AlertModal';

export default function StoresPage() {
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', address: '' });
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const data = await storage.get('stores');
      setStores(data);
    } catch (err) { console.error(err); }
  };

  const handleOpenModal = (store = null) => {
    setFormData(store ? store : { id: '', name: '', address: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await storage.update('stores', formData.id, formData);
      } else {
        await storage.create('stores', formData);
      }
      setIsModalOpen(false);
      loadStores();
      setAlertModal({ open: true, type: 'success', title: 'Succès', message: 'Magasin enregistré !' });
    } catch (err) {
      setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
    }
  };

  const handleDelete = (id) => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Confirmation',
      message: 'Supprimer ce magasin ? (Doit être vide)',
      onConfirm: async () => {
        try {
          await storage.remove('stores', id);
          loadStores();
          setAlertModal({ open: true, type: 'success', title: 'Supprimé', message: 'Magasin retiré.' });
        } catch (err) {
          setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
        }
      }
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Magasins</h1><p>Gestion de vos points de vente</p></div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}><Plus size={18} /> Nouveau Magasin</button>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {stores.map(store => (
          <div key={store.id} className="content-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="avatar" style={{ borderRadius: '12px', width: '48px', height: '48px' }}><Store size={24} /></div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(store)}><Edit2 size={14} /></button>
                <button className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(store.id)}><Trash2 size={14} /></button>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '8px 0' }}>{store.name}</h3>
              <div className="text-muted" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                <MapPin size={14} /> {store.address || 'Sans adresse'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header"><h3>{formData.id ? 'Modifier' : 'Ajouter'}</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nom</label><input className="form-control" required value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Adresse</label><textarea className="form-control" value={formData.address || ''} onChange={e => setFormData({...formData, address: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button><button type="submit" className="btn btn-primary">Enregistrer</button></div>
            </form>
          </div>
        </div>
      )}
      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={() => setAlertModal({...alertModal, open: false})} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
