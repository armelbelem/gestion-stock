'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, Edit2, Trash2, X, Search, ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { useAuth } from '../../providers';
import { exportToExcel } from '../../utils/excelExport';

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [settings, setSettings] = useState(null);
  const [formData, setFormData] = useState({ id: '', clientCode: '', name: '', email: '', phone: '', address: '', rccm: '', nif: '', bp: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { user } = useAuth();
  const itemsPerPage = 10;

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    loadClients();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadClients = async () => {
    try {
      const data = await storage.get('clients');
      setClients(data);
    } catch (err) {
      console.error("Error loading clients:", err);
    }
  };

  const handleExportExcel = () => {
    const headers = [
      { key: 'clientCode', label: 'Code Client' },
      { key: 'name', label: 'Nom du Client' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Téléphone' },
      { key: 'address', label: 'Adresse' },
      { key: 'totalDebt', label: 'Dette (XOF)' }
    ];
    
    exportToExcel(filteredClients, headers, 'liste_clients', {
      title: "LISTE DES CLIENTS",
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

  const handleOpenModal = (client = null) => {
    if (client) {
      setFormData(client);
    } else {
      setFormData({ id: '', clientCode: '', name: '', email: '', phone: '', address: '', rccm: '', nif: '', bp: '' });
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
        await storage.update('clients', formData.id, formData);
        showAlert('success', 'Succès', "Client mis à jour !");
      } else {
        const selectedStore = localStorage.getItem('selectedStore');
        const storeId = selectedStore && selectedStore !== 'all' ? selectedStore : null;
        await storage.create('clients', { ...formData, storeId });
        showAlert('success', 'Succès', "Client ajouté !");
      }
      await loadClients();
      handleCloseModal();
    } catch (error) {
      showAlert('error', 'Erreur', `Erreur lors de l'enregistrement : ${error.message}`);
    }
  };

  const handleDelete = (id) => {
    showConfirm(
      "Confirmation",
      "Êtes-vous sûr de vouloir supprimer ce client ?",
      async () => {
        closeAlert();
        try {
          const selectedStore = localStorage.getItem('selectedStore');
          const storeId = selectedStore && selectedStore !== 'all' ? selectedStore : '';
          await storage.remove('clients', id, { storeId });
          await loadClients();
          showAlert('success', 'Succès', "Client supprimé !");
        } catch (error) {
          showAlert('error', 'Erreur', `Erreur lors de la suppression : ${error.message}`);
        }
      }
    );
  };

  const filteredClients = clients.filter(client => 
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (client.clientCode && client.clientCode.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.phone && client.phone.includes(searchTerm))
  );

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClients = filteredClients.slice(indexOfFirstItem, indexOfLastItem);

  if (isReporting) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'NS AUTO'}</h1>
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          <h2 style={{ marginTop: '15px' }}>LISTE DES CLIENTS</h2>
          <p>Généré le : {new Date().toLocaleString('fr-FR')}</p>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Code</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Nom</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Email</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Téléphone</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Dette</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
              <tr key={client.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{client.clientCode || '-'}</td>
                <td style={{ padding: '8px', fontWeight: 500 }}>{client.name}</td>
                <td style={{ padding: '8px' }}>{client.email || '-'}</td>
                <td style={{ padding: '8px' }}>{client.phone || '-'}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{(client.totalDebt || 0).toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '30px', fontSize: '0.8rem', textAlign: 'right' }}>
          Nombre total de clients : {filteredClients.length}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p>Gestion de votre base de clients</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExportExcel} title="Exporter Excel">
            <Download size={18} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={handlePrintReport} title="Imprimer / PDF">
            <FileText size={18} /> PDF
          </button>
          {user?.role !== 'vendeur' && (
            <button className="btn btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={16} /> Nouveau Client
            </button>
          )}
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
                <th>Code</th>
                <th>Nom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Dette Totale</th>
                {user?.role !== 'vendeur' && <th style={{ width: '150px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {currentClients.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Aucun client trouvé.</td>
                </tr>
              ) : (
                currentClients.map((client) => (
                  <tr key={client.id}>
                    <td>{client.clientCode || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div className="avatar" style={{ width: '32px', height: '32px', fontSize: '0.9rem' }}>
                          {client.name[0].toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{client.name}</span>
                      </div>
                    </td>
                    <td>{client.email || '-'}</td>
                    <td>{client.phone || '-'}</td>
                    <td>
                      {client.totalDebt > 0 ? (
                        <span className="badge badge-danger">
                          {(client.totalDebt || 0).toLocaleString('fr-FR')} FCFA
                        </span>
                      ) : (
                        <span className="text-success" style={{ fontWeight: 600 }}>0 FCFA</span>
                      )}
                    </td>
                    {user?.role !== 'vendeur' && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-secondary" onClick={() => handleOpenModal(client)}><Edit2 size={16} /></button>
                          <button className="btn btn-danger-outline" onClick={() => handleDelete(client.id)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    )}
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
              <h3>{formData.id ? 'Modifier le Client' : 'Nouveau Client'}</h3>
              <button className="modal-close" onClick={handleCloseModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Code Client</label>
                    <input type="text" className="form-control" placeholder="Ex: CL-001" value={formData.clientCode || ''} onChange={(e) => setFormData({...formData, clientCode: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nom complet</label>
                    <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
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
                  <label className="form-label">Adresse</label>
                  <textarea className="form-control" rows="2" value={formData.address || ''} onChange={(e) => setFormData({...formData, address: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">RCCM</label>
                    <input type="text" className="form-control" value={formData.rccm || ''} onChange={(e) => setFormData({...formData, rccm: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">NIF / IFU</label>
                    <input type="text" className="form-control" value={formData.nif || ''} onChange={(e) => setFormData({...formData, nif: e.target.value})} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Boîte Postale (BP)</label>
                  <input type="text" className="form-control" value={formData.bp || ''} onChange={(e) => setFormData({...formData, bp: e.target.value})} />
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
