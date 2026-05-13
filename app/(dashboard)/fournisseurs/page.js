'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, Edit2, Trash2, X, Truck, Search, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { exportToExcel } from '../../utils/excelExport';

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [formData, setFormData] = useState({ id: '', name: '', email: '', phone: '', rccm: '', nif: '', bp: '' });
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
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadSuppliers = async () => {
    try {
      const data = await storage.get('fournisseurs?storeId=all');
      setSuppliers(data);
    } catch (err) {
      console.error("Error loading suppliers:", err);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      { key: 'name', label: 'Nom' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Téléphone' },
      { key: 'bp', label: 'BP' },
      { key: 'rccm', label: 'RCCM' },
      { key: 'nif', label: 'NIF / IFU' }
    ];
    
    exportToExcel(filteredSuppliers, headers, 'liste_fournisseurs', {
      title: "LISTE DES FOURNISSEURS",
      companyName: settings?.companyName || "NS AUTO",
      period: `Le ${new Date().toLocaleDateString('fr-FR')}`
    });
    showAlert('success', 'Succès', "Exportation Excel réussie !");
  };

  const handlePrintReport = () => {
    setIsReporting(true);
    setTimeout(() => {
      window.print();
      setIsReporting(false);
    }, 500);
  };

  const handleOpenModal = (supplier = null) => {
    if (supplier) {
      setFormData(supplier);
    } else {
      setFormData({ id: '', name: '', email: '', phone: '', rccm: '', nif: '', bp: '' });
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
          const selectedStore = localStorage.getItem('selectedStore');
          const storeId = selectedStore && selectedStore !== 'all' ? selectedStore : '';
          await storage.remove('fournisseurs', id, { storeId });
          await loadSuppliers();
          showAlert('success', 'Succès', "Fournisseur supprimé !");
        } catch (error) {
          showAlert('error', 'Erreur', error.message || "Erreur lors de la suppression");
        }
      }
    );
  };

  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supplier.email && supplier.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.phone && supplier.phone.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.rccm && supplier.rccm.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.nif && supplier.nif.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (supplier.bp && supplier.bp.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredSuppliers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSuppliers = filteredSuppliers.slice(indexOfFirstItem, indexOfLastItem);

  if (isReporting) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'NS AUTO'}</h1>
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          <h2 style={{ marginTop: '15px' }}>LISTE DES FOURNISSEURS</h2>
          <p>Généré le : {new Date().toLocaleString('fr-FR')}</p>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Nom</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Téléphone</th>
               <th style={{ textAlign: 'left', padding: '8px' }}>RCCM</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>BP</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>IFU</th>
            </tr>
          </thead>
          <tbody>
            {filteredSuppliers.map((supplier) => (
              <tr key={supplier.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px', fontWeight: 500 }}>{supplier.name}</td>
                <td style={{ padding: '8px' }}>{supplier.email || '-'}</td>
                <td style={{ padding: '8px' }}>{supplier.phone || '-'}</td>
                <td style={{ padding: '8px' }}>{supplier.rccm || '-'}</td>
                <td style={{ padding: '8px' }}>{supplier.bp || '-'}</td>
                <td style={{ padding: '8px' }}>{supplier.nif || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '30px', fontSize: '0.8rem', textAlign: 'right' }}>
          Nombre total de fournisseurs : {filteredSuppliers.length}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Fournisseurs</h1>
          <p>Gestion de vos sources d'approvisionnement</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel} title="Exporter Excel">
            <Download size={18} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={handlePrintReport} title="Imprimer / PDF">
            <FileText size={18} /> PDF
          </button>
          <button className="btn btn-primary" onClick={() => handleOpenModal()}>
            <Plus size={16} /> Nouveau Fournisseur
          </button>
        </div>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher par nom, email ou téléphone..." 
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
                <th>RCCM</th>
                <th>BP</th>
                <th>IFU</th>
                <th style={{ width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSuppliers.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Aucun fournisseur trouvé.</td>
                </tr>
              ) : (
                currentSuppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar" style={{ width: '32px', height: '32px' }}>
                          <Truck size={16} />
                        </div>
                        <span style={{ fontWeight: 500 }}>{supplier.name}</span>
                      </div>
                    </td>
                    <td>{supplier.email || '-'}</td>
                    <td>{supplier.phone || '-'}</td>
                    <td>{supplier.rccm || '-'}</td>
                    <td>{supplier.bp || '-'}</td>
                    <td>{supplier.nif || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => handleOpenModal(supplier)}><Edit2 size={16} /></button>
                        <button className="btn btn-danger-outline" onClick={() => handleDelete(supplier.id)}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
            <span>Page {currentPage} / {totalPages}</span>
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
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
                  <input type="text" className="form-control" required value={formData.name || ''} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={formData.email || ''} onChange={(e) => setFormData({...formData, email: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input type="text" className="form-control" value={formData.phone || ''} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label">Boîte Postale (BP)</label>
                  <input type="text" className="form-control" placeholder="ex: 01 BP 23 Ouaga 01" value={formData.bp || ''} onChange={(e) => setFormData({...formData, bp: e.target.value})} />
                </div>

                <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">RCCM</label>
                    <input type="text" className="form-control" value={formData.rccm || ''} onChange={(e) => setFormData({...formData, rccm: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">NIF / IFU</label>
                    <input type="text" className="form-control" value={formData.nif || ''} onChange={(e) => setFormData({...formData, nif: e.target.value})} />
                  </div>
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

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
