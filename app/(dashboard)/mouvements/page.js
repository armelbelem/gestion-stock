'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  ChevronLeft, ChevronRight, Search, Filter, XCircle,
  Download, ArrowDownRight, ArrowUpRight, X
} from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';
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
    exportToExcel(dataToExport, headers, 'mouvements_stock');
    showAlert('success', 'Succès', "Exportation Excel réussie !");
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

  const setQuickRange = (type) => {
    const end = new Date();
    const start = new Date();
    if (type === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (type === 'week') {
      start.setDate(start.getDate() - 7);
    } else if (type === 'month') {
      start.setDate(1);
    }
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const getArticleName = (id) => articles.find(x => x.id === id)?.name || 'Article Inconnu';
  const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR');

  const filteredMouvements = mouvements.filter(mov => {
    const matchesArticle = filterArticleId === '' || mov.articleId === filterArticleId;
    const matchesType = filterType === '' || mov.type === filterType;
    const matchesSearch = searchTerm === '' || mov.notes?.toLowerCase().includes(searchTerm.toLowerCase()) || getArticleName(mov.articleId).toLowerCase().includes(searchTerm.toLowerCase());
    
    const movDate = new Date(mov.date);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    
    const matchesDate = (!start || movDate >= start) && (!end || movDate <= end);

    return matchesArticle && matchesType && matchesSearch && matchesDate;
  });

  const currentMouvements = filteredMouvements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [articleSearch, setArticleSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleArticleSearch = (val) => {
    setArticleSearch(val);
    if (val.length > 1) {
      const filtered = articles.filter(a => 
        a.name.toLowerCase().includes(val.toLowerCase()) || 
        (a.code && a.code.toLowerCase().includes(val.toLowerCase())) ||
        (a.barcode && a.barcode.toLowerCase().includes(val.toLowerCase()))
      ).slice(0, 10);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const selectArticle = (article) => {
    setFormData({ ...formData, articleId: article.id });
    setArticleSearch(`${article.name} (${article.code || ''})`);
    setSuggestions([]);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Mouvements</h1><p>Historique des entrées et sorties</p></div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExport}><Download size={18} /> Exporter</button>
          <button className="btn btn-success" onClick={() => { handleOpenModal('IN'); setArticleSearch(''); }}><ArrowDownRight size={16} /> Entrée</button>
          <button className="btn btn-danger" onClick={() => { handleOpenModal('OUT'); setArticleSearch(''); }}><ArrowUpRight size={16} /> Sortie</button>
        </div>
      </div>

      <div className="content-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="search-input-wrapper" style={{ margin: 0, flex: '1 1 250px' }}>
            <Search size={18} className="search-icon" />
            <input type="text" className="form-control" style={{ paddingLeft: '2.5rem' }} placeholder="Rechercher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          
          <select className="form-control" style={{ flex: '1 1 150px' }} value={filterArticleId} onChange={(e) => setFilterArticleId(e.target.value)}>
            <option value="">Tous les articles</option>
            {articles.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>

          <select className="form-control" style={{ flex: '1 1 120px' }} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="IN">Entrées</option>
            <option value="OUT">Sorties</option>
          </select>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="text-muted" style={{ fontSize: '0.85rem' }}>au</span>
              <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange('today')}>Aujourd'hui</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange('week')}>7 j</button>
              <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange('month')}>Mois</button>
              <button className="btn btn-secondary" title="Réinitialiser" onClick={() => { setSearchTerm(''); setFilterArticleId(''); setFilterType(''); setStartDate(''); setEndDate(''); }}><XCircle size={16} /></button>
            </div>
          </div>
        </div>
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
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Rechercher l'article (Nom, Code ou Scan)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Saisissez le nom ou code..." 
                    value={articleSearch}
                    required
                    onChange={(e) => handleArticleSearch(e.target.value)}
                  />
                  {suggestions.length > 0 && (
                    <div className="search-suggestions" style={{ top: '100%', left: 0, right: 0, zIndex: 1000 }}>
                      {suggestions.map(a => (
                        <div key={a.id} className="suggestion-item" onClick={() => selectArticle(a)}>
                          <div style={{ fontWeight: 600 }}>{a.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Code: {a.code || '-'} | Stock: <span style={{ fontWeight: 'bold', color: a.currentStock <= a.minStock ? 'var(--danger)' : 'var(--success)' }}>{a.currentStock}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
