import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Plus, Edit2, Trash2, X, CheckCircle, Truck, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import AlertModal from '../components/AlertModal';

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ id: '', name: '', email: '', phone: '', address: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    // API uses 'fournisseurs' but we show it as Suppliers in UI
    const data = await storage.get('fournisseurs');
    setSuppliers(data);
  };

  const handleOpenModal = (supplier = null) => {
    if (supplier) {
      setFormData(supplier);
    } else {
      setFormData({ id: '', name: '', email: '', phone: '', address: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (formData.id) {
        await storage.update('fournisseurs', formData.id, formData);
        showAlert('success', 'Succès', "Fournisseur mis à jour !");
      } else {
        await storage.create('fournisseurs', formData);
        showAlert('success', 'Succès', "Fournisseur ajouté !");
      }
      await loadSuppliers();
      handleCloseModal();
    } catch (error) {
      console.error("Error saving supplier:", error);
      showAlert('error', 'Erreur', error.message || "Erreur lors de l'enregistrement");
    }
  };

  const handleDelete = (id) => {
    showConfirm(
      "Confirmation",
      "Êtes-vous sûr de vouloir supprimer ce fournisseur ?",
      async () => {
        closeAlert();
        try {
          await storage.remove('fournisseurs', id);
          await loadSuppliers();
          showAlert('success', 'Succès', "Fournisseur supprimé !");
        } catch (error) {
          console.error("Error deleting supplier:", error);
          showAlert('error', 'Erreur', error.message || "Erreur lors de la suppression");
        }
      }
    );
  };

  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.phone && supplier.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSuppliers = filteredSuppliers.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Fournisseurs</h1>
          <p>Gérez vos sources d'approvisionnement</p>
        </div>
        <button className="btn btn-primary" onClick={() => handleOpenModal()}>
          <Plus size={16} /> Nouveau Fournisseur
        </button>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher un fournisseur par nom, email ou téléphone..." 
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
                <th>Nom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Adresse</th>
                <th style={{ width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {searchTerm ? "Aucun fournisseur ne correspond à votre recherche" : "Aucun fournisseur trouvé"}
                  </td>
                </tr>
              ) : (
                currentSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ 
                          width: '32px', height: '32px', borderRadius: '50%', 
                          backgroundColor: 'var(--primary-light)', color: 'var(--primary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <Truck size={16} />
                        </div>
                        <span style={{ fontWeight: 500 }}>{supplier.name}</span>
                      </div>
                    </td>
                    <td>{supplier.email || '-'}</td>
                    <td>{supplier.phone || '-'}</td>
                    <td>{supplier.address || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.375rem' }} onClick={() => handleOpenModal(supplier)}>
                          <Edit2 size={16} />
                        </button>
                        <button className="btn btn-danger-outline" style={{ padding: '0.375rem' }} onClick={() => handleDelete(supplier.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
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
              Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredSuppliers.length)} sur {filteredSuppliers.length} fournisseurs
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

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{formData.id ? 'Modifier le Fournisseur' : 'Nouveau Fournisseur'}</h3>
              <button className="modal-close" onClick={handleCloseModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nom du fournisseur</label>
                  <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input type="text" className="form-control" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Adresse</label>
                  <textarea className="form-control" rows="2" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
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
      />
    </div>
  );
};

export default Suppliers;
