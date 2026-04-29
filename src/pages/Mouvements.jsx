import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { X, ArrowDownRight, ArrowUpRight, CheckCircle, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';
import AlertModal from '../components/AlertModal';
import { useAuth } from '../context/AuthContext';

const Mouvements = () => {
  const { user: currentUser } = useAuth();
  const [mouvements, setMouvements] = useState([]);
  const [articles, setArticles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('IN'); // 'IN' or 'OUT'
  
  
  // Filtering states
  const [filterArticleId, setFilterArticleId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    setCurrentPage(1);
  }, [filterArticleId, filterType, startDate, endDate, searchTerm]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setMouvements(await storage.get('mouvements'));
    setArticles(await storage.get('articles'));
    setSuppliers(await storage.get('fournisseurs'));
  };

  const handleExport = () => {
    const headers = [
      { key: 'dateFormatted', label: 'Date' },
      { key: 'typeLabel', label: 'Type' },
      { key: 'articleName', label: 'Article' },
      { key: 'quantity', label: 'Quantité' },
      { key: 'notes', label: 'Notes' }
    ];
    
    const dataToExport = filteredMouvements.map(mov => ({
      ...mov,
      dateFormatted: formatDate(mov.date),
      typeLabel: mov.type === 'IN' ? 'Entrée' : 'Sortie',
      articleName: getArticleName(mov.articleId)
    }));
    
    exportToCSV(dataToExport, headers, 'mouvements_stock');
    showAlert('success', 'Succès', "Exportation CSV réussie !");
  };

  const handleOpenModal = (type) => {
    setModalType(type);
    setFormData({
      articleId: articles.length > 0 ? articles[0].id : '',
      quantity: '',
      notes: '',
      supplierId: ''
    });
    setIsModalOpen(true);
  };
  
  const [formData, setFormData] = useState({
    articleId: '',
    quantity: '',
    notes: '',
    supplierId: ''
  });

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const quantity = parseInt(formData.quantity) || 0;
    
    if (quantity <= 0) {
      showAlert('error', 'Erreur', "La quantité doit être supérieure à 0.");
      return;
    }

    const article = articles.find(a => a.id === formData.articleId);
    if (!article) return;

    if (modalType === 'OUT' && article.currentStock < quantity) {
      showAlert('error', 'Erreur', `Stock insuffisant. Stock actuel: ${article.currentStock}`);
      return;
    }

    const selectedStore = localStorage.getItem('selectedStore');
    const isAdmin = currentUser?.role === 'admin';
    const storeId = isAdmin ? (selectedStore !== 'all' ? selectedStore : null) : currentUser?.storeId;

    const newMouvement = {
      articleId: formData.articleId,
      type: modalType,
      quantity: quantity,
      date: new Date().toISOString(),
      notes: formData.notes,
      supplierId: modalType === 'IN' ? formData.supplierId : null,
      storeId: storeId
    };

    // Demander confirmation avant de valider
    showConfirm(
      'Confirmer le mouvement ?',
      `Voulez-vous enregistrer cette ${modalType === 'IN' ? 'entrée' : 'sortie'} de ${quantity} unités pour "${article.name}" ?`,
      async () => {
        closeAlert();
        try {
          await storage.create('mouvements', newMouvement);
          await loadData();
          handleCloseModal();
          showAlert('success', 'Succès', "Mouvement enregistré avec succès !");
        } catch (error) {
          console.error("Error saving movement:", error);
          showAlert('error', 'Erreur', `Erreur lors de l'enregistrement : ${error.message}`);
        }
      }
    );
  };

  const getArticleName = (id) => {
    const a = articles.find(x => x.id === id);
    return a ? a.name : 'Article Supprimé';
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredMouvements = mouvements.filter(mov => {
    const matchesArticle = filterArticleId === '' || mov.articleId === filterArticleId;
    const matchesType = filterType === '' || mov.type === filterType;
    const matchesSearch = searchTerm === '' || 
      (mov.notes && mov.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      getArticleName(mov.articleId).toLowerCase().includes(searchTerm.toLowerCase());
    
    // Date filtering
    let matchesDate = true;
    if (startDate || endDate) {
      const movDate = new Date(mov.date);
      movDate.setHours(0, 0, 0, 0); // Normalize to start of day for comparison
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (movDate < start) matchesDate = false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        if (movDate > end) matchesDate = false;
      }
    }

    return matchesArticle && matchesType && matchesSearch && matchesDate;
  });

  const totalPages = Math.ceil(filteredMouvements.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMouvements = filteredMouvements.slice(indexOfFirstItem, indexOfLastItem);

  const resetFilters = () => {
    setFilterArticleId('');
    setFilterType('');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Mouvements de Stock</h1>
          <p>Historique des entrées et sorties</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={18} /> Exporter
          </button>
          <button className="btn btn-success" onClick={() => handleOpenModal('IN')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowDownRight size={16} /> Entrée de Stock
          </button>
          <button className="btn btn-danger" onClick={() => handleOpenModal('OUT')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowUpRight size={16} /> Sortie de Stock
          </button>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Rechercher</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Article ou notes..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Article</label>
          <select 
            className="form-control"
            value={filterArticleId}
            onChange={(e) => setFilterArticleId(e.target.value)}
          >
            <option value="">Tous les articles</option>
            {articles.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Type</label>
          <select 
            className="form-control"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Tous les types</option>
            <option value="IN">Entrées uniquement</option>
            <option value="OUT">Sorties uniquement</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Du</label>
          <input 
            type="date" 
            className="form-control" 
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" style={{ fontSize: '0.75rem' }}>Au</label>
          <input 
            type="date" 
            className="form-control" 
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <button 
          className="btn btn-secondary" 
          onClick={resetFilters}
          style={{ height: '38px' }}
        >
          Réinitialiser
        </button>
      </div>
      
      <div className="content-card" style={{ marginTop: '1.5rem' }}>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Article</th>
                <th>Fournisseur</th>
                <th>Quantité</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {currentMouvements.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Aucun mouvement ne correspond aux filtres.
                  </td>
                </tr>
              ) : (
                currentMouvements.map((mov) => (
                  <tr key={mov.id}>
                    <td>{formatDate(mov.date)}</td>
                    <td>
                      {mov.type === 'IN' ? (
                        <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ArrowDownRight size={12} /> Entrée
                        </span>
                      ) : (
                        <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <ArrowUpRight size={12} /> Sortie
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{getArticleName(mov.articleId)}</td>
                    <td>{mov.supplierName || '-'}</td>
                    <td style={{ fontWeight: 'bold' }}>
                      {mov.type === 'IN' ? '+' : '-'}{mov.quantity}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{mov.notes}</td>
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
              Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredMouvements.length)} sur {filteredMouvements.length} mouvements
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
              <h3>{modalType === 'IN' ? 'Nouvelle Entrée de Stock' : 'Nouvelle Sortie de Stock'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Article</label>
                  <select 
                    className="form-control"
                    required
                    value={formData.articleId}
                    onChange={(e) => setFormData({...formData, articleId: e.target.value})}
                  >
                    <option value="" disabled>Sélectionnez un article</option>
                    {articles.map(a => (
                      <option key={a.id} value={a.id}>{a.name} (Stock: {a.currentStock})</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Quantité</label>
                  <input 
                    type="number" 
                    min="1"
                    className="form-control" 
                    required 
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  />
                </div>

                {modalType === 'IN' && (
                  <div className="form-group">
                    <label className="form-label">Fournisseur (Optionnel)</label>
                    <select 
                      className="form-control"
                      value={formData.supplierId}
                      onChange={(e) => setFormData({...formData, supplierId: e.target.value})}
                    >
                      <option value="">Sélectionnez un fournisseur</option>
                      {suppliers.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Notes (Optionnel)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder={modalType === 'IN' ? "Ex: Livraison fournisseur A" : "Ex: Vente comptoir"}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Annuler
                </button>
                <button type="submit" className={modalType === 'IN' ? 'btn btn-success' : 'btn btn-danger'}>
                  Enregistrer
                </button>
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

export default Mouvements;
