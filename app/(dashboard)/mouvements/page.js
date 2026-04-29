'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  X, ArrowDownRight, ArrowUpRight, Download, 
  ChevronLeft, ChevronRight, Search, Filter 
} from 'lucide-react';
import { exportToCSV } from '../../utils/csvExport';
import AlertModal from '../../components/AlertModal';
import { useAuth } from '../../providers';

export default function MouvementsPage() {
  const { user: currentUser } = useAuth();
  const [mouvements, setMouvements] = useState([]);
  const [articles, setArticles] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('IN'); 
  
  const [filterArticleId, setFilterArticleId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    articleId: '',
    quantity: '',
    notes: '',
    supplierId: ''
  });

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
    try {
      const movementsData = await storage.get('mouvements');
      const articlesData = await storage.get('articles');
      const suppliersData = await storage.get('fournisseurs');
      setMouvements(movementsData);
      setArticles(articlesData);
      setSuppliers(suppliersData);
    } catch (err) {
      console.error("Error loading movements:", err);
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const quantity = parseInt(formData.quantity) || 0;
    if (quantity <= 0) return showAlert('error', 'Erreur', "La quantité doit être > 0.");
    const article = articles.find(a => a.id === formData.articleId);
    if (!article) return;
    if (modalType === 'OUT' && article.currentStock < quantity) return showAlert('error', 'Erreur', `Stock insuffisant (${article.currentStock} dispo).`);

    const selectedStore = localStorage.getItem('selectedStore');
    const isAdmin = currentUser?.role === 'admin';
    const storeId = isAdmin ? (selectedStore !== 'all' ? selectedStore : null) : currentUser?.storeId;

    showConfirm('Confirmer ?', `Voulez-vous enregistrer cette ${modalType === 'IN' ? 'entrée' : 'sortie'} de ${quantity} "${article.name}" ?`, async () => {
      closeAlert();
      try {
        await storage.create('mouvements', { ...formData, type: modalType, storeId, quantity });
        await loadData();
        setIsModalOpen(false);
        showAlert('success', 'Succès', "Mouvement enregistré !");
      } catch (err) { showAlert('error', 'Erreur', err.message); }
    });
  };

  const getArticleName = (id) => articles.find(x => x.id === id)?.name || 'Article Inconnu';
  const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR');

  const filteredMouvements = mouvements.filter(mov => {
    const matchesArticle = filterArticleId === '' || mov.articleId === filterArticleId;
    const matchesType = filterType === '' || mov.type === filterType;
    const matchesSearch = searchTerm === '' || mov.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || getArticleName(mov.articleId).toLowerCase().includes(searchTerm.toLowerCase());
    return matchesArticle && matchesType && matchesSearch;
  });

  const currentMouvements = filteredMouvements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Mouvements</h1><p>Historique des entrées et sorties</p></div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExport}><Download size={18} /> Exporter</button>
          <button className="btn btn-success" onClick={() => handleOpenModal('IN')}><ArrowDownRight size={16} /> Entrée</button>
          <button className="btn btn-danger" onClick={() => handleOpenModal('OUT')}><ArrowUpRight size={16} /> Sortie</button>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
        <input type="text" className="form-control" placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        <select className="form-control" value={filterArticleId} onChange={(e) => setFilterArticleId(e.target.value)}>
          <option value="">Tous les articles</option>
          {articles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="form-control" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">Tous les types</option>
          <option value="IN">Entrées</option>
          <option value="OUT">Sorties</option>
        </select>
        <button className="btn btn-secondary" onClick={() => { setSearchTerm(''); setFilterArticleId(''); setFilterType(''); }}>Réinitialiser</button>
      </div>

      <div className="content-card" style={{ marginTop: '1.5rem' }}>
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Article</th><th>Fournisseur</th><th>Qté</th><th>Notes</th></tr></thead>
            <tbody>
              {currentMouvements.map(mov => (
                <tr key={mov.id}>
                  <td>{formatDate(mov.date)}</td>
                  <td><span className={`badge ${mov.type === 'IN' ? 'badge-success' : 'badge-danger'}`}>{mov.type === 'IN' ? 'Entrée' : 'Sortie'}</span></td>
                  <td style={{ fontWeight: 500 }}>{getArticleName(mov.articleId)}</td>
                  <td>{mov.supplierName || '-'}</td>
                  <td style={{ fontWeight: 'bold' }}>{mov.type === 'IN' ? '+' : '-'}{mov.quantity}</td>
                  <td className="text-muted">{mov.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredMouvements.length > itemsPerPage && (
          <div className="pagination">
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
            <span>Page {currentPage}</span>
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, Math.ceil(filteredMouvements.length / itemsPerPage)))} disabled={currentPage >= Math.ceil(filteredMouvements.length / itemsPerPage)}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>{modalType === 'IN' ? 'Entrée de Stock' : 'Sortie de Stock'}</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Article</label><select className="form-control" required value={formData.articleId} onChange={(e) => setFormData({...formData, articleId: e.target.value})}>
                  <option value="">Choisir...</option>
                  {articles.map(a => <option key={a.id} value={a.id}>{a.name} ({a.currentStock})</option>)}
                </select></div>
                <div className="form-group"><label className="form-label">Quantité</label><input type="number" className="form-control" required value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} /></div>
                {modalType === 'IN' && <div className="form-group"><label className="form-label">Fournisseur</label><select className="form-control" value={formData.supplierId} onChange={(e) => setFormData({...formData, supplierId: e.target.value})}>
                  <option value="">Choisir...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>}
                <div className="form-group"><label className="form-label">Notes</label><input type="text" className="form-control" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button><button type="submit" className={modalType === 'IN' ? 'btn btn-success' : 'btn btn-danger'}>Enregistrer</button></div>
            </form>
          </div>
        </div>
      )}
      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
