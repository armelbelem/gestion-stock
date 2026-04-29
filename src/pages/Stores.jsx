import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Store, Plus, Edit2, Trash2, X, MapPin, Building2 } from 'lucide-react';
import AlertModal from '../components/AlertModal';

const Stores = () => {
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', address: '' });
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    const data = await storage.get('stores');
    setStores(data);
  };

  const handleOpenModal = (store = null) => {
    if (store) {
      setFormData(store);
    } else {
      setFormData({ id: '', name: '', address: '' });
    }
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
      message: 'Voulez-vous vraiment supprimer ce magasin ? Cela ne marchera que s\'il est vide.',
      onConfirm: async () => {
        try {
          await storage.remove('stores', id);
          loadStores();
          setAlertModal({ open: true, type: 'success', title: 'Supprimé', message: 'Le magasin a été retiré.' });
        } catch (err) {
          setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
        }
      }
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Gestion des Magasins</h1>
          <p>Configurez vos différents points de vente et dépôts</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={18} /> Nouveau Magasin
        </button>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {stores.map(store => (
          <div key={store.id} className="content-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="avatar" style={{ borderRadius: '12px', width: '48px', height: '48px' }}>
                <Store size={24} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleOpenModal(store)}><Edit2 size={14} /></button>
                <button className="btn btn-danger-outline btn-sm" onClick={() => handleDelete(store.id)}><Trash2 size={14} /></button>
              </div>
            </div>
            <div>
              <h3 style={{ margin: '0.5rem 0' }}>{store.name}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                <MapPin size={14} />
                {store.address || 'Aucune adresse renseignée'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>{formData.id ? 'Modifier le Magasin' : 'Ajouter un Magasin'}</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nom du Magasin</label>
                <input 
                  className="form-control"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Ex: Dépôt Nord, Boutique Centre..."
                />
              </div>
              <div className="form-group">
                <label className="form-label">Adresse / Emplacement</label>
                <textarea 
                  className="form-control"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Adresse complète du magasin"
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
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
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
};

export default Stores;
