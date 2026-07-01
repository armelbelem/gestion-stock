'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  ChevronLeft, ChevronRight, Search, Filter, XCircle,
  Download, ArrowDownRight, ArrowUpRight, X, FileText
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
  const [isReporting, setIsReporting] = useState(false);
  const [settings, setSettings] = useState(null);
  
  const [filterArticleId, setFilterArticleId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 10 });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  // Debounce la recherche : attend 400ms après la dernière frappe
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterArticleId, filterType, startDate, endDate]);

  const [hasActiveYear, setHasActiveYear] = useState(true);

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  useEffect(() => {
    loadMouvements();
  }, [currentPage, debouncedSearch, filterArticleId, filterType, startDate, endDate]);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadData = async () => {
    try {
      const articlesData = await storage.get('articles');
      const suppliersData = await storage.get('fournisseurs');
      const fyData = await storage.get('fiscal-years');
      setArticles(articlesData);
      setSuppliers(suppliersData);
      setHasActiveYear(fyData.some(f => f.status === 'active'));
    } catch (err) {
      console.error("Error loading base data:", err);
    }
  };

  const loadMouvements = async () => {
    setIsLoading(true);
    try {
      const selectedStore = localStorage.getItem('selectedStore');
      const token = sessionStorage.getItem('token');
      const params = new URLSearchParams({
        page: currentPage,
        limit: itemsPerPage,
        _t: Date.now()
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterArticleId) params.set('articleId', filterArticleId);
      if (filterType) params.set('type', filterType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedStore) params.set('storeId', selectedStore);

      const res = await fetch(`/api/mouvements?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      const result = await res.json();
      setMouvements(result.data || []);
      setPagination(result.pagination || { total: 0, totalPages: 1, page: 1, limit: 10 });
    } catch (err) {
      console.error('Error loading mouvements:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    showAlert('info', 'Exportation', 'Préparation du fichier Excel en cours...');
    const allData = await fetchAllForExport();
    
    const headers = [
      { key: 'dateFormatted', label: 'Date' },
      { key: 'typeLabel', label: 'Type' },
      { key: 'articleName', label: 'Article' },
      { key: 'articleCode', label: 'Référence' },
      { key: 'articlePrice', label: 'Prix Unitaire (FCFA)' },
      { key: 'quantity', label: 'Quantité' },
      { key: 'notes', label: 'Notes' }
    ];
    const dataToExport = allData.map(mov => ({
      ...mov,
      dateFormatted: formatDate(mov.date),
      typeLabel: mov.type === 'IN' ? 'Entrée' : 'Sortie',
      articleName: mov.articleName || getArticleName(mov.articleId),
      articleCode: mov.articleCode || getArticleCode(mov.articleId),
      articlePrice: mov.articlePrice !== undefined ? mov.articlePrice : getArticlePrice(mov.articleId)
    }));
    closeAlert();
    exportToExcel(dataToExport, headers, 'rapport_mouvements', {
      title: "RAPPORT DES MOUVEMENTS DE STOCK",
      companyName: settings?.companyName || "NS AUTO",
      period: `${startDate || 'Début'} au ${endDate || 'Fin'}`
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

  const handleOpenModal = (type) => {
    const selectedStore = localStorage.getItem('selectedStore');
    const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'gestionnaire';

    if (isAdminOrManager && (!selectedStore || selectedStore === 'all' || selectedStore === '')) {
      return showAlert('error', 'Magasin requis', "Veuillez sélectionner un magasin spécifique dans le menu en haut avant d'effectuer cette opération.");
    }

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
    if (isSaving) return;
    if (!hasActiveYear) return showAlert('error', 'Action bloquée', "Aucun exercice fiscal n'est ouvert. Veuillez ouvrir un exercice dans les réglages avant de pouvoir enregistrer des mouvements de stock.");
    const quantity = parseInt(formData.quantity) || 0;
    if (quantity <= 0) return showAlert('error', 'Erreur', "La quantité doit être > 0.");
    const article = articles.find(a => a.id === formData.articleId);
    if (!article) return;
    if (modalType === 'OUT' && article.currentStock < quantity) return showAlert('error', 'Erreur', `Stock insuffisant (${article.currentStock} dispo).`);

    const selectedStore = localStorage.getItem('selectedStore');
    const isAdminOrManager = currentUser?.role === 'admin' || currentUser?.role === 'gestionnaire';
    
    if (isAdminOrManager && (!selectedStore || selectedStore === 'all' || selectedStore === '')) {
      return showAlert('error', 'Magasin requis', "Veuillez sélectionner un magasin spécifique en haut de la page.");
    }

    const storeId = isAdminOrManager ? selectedStore : currentUser?.storeId;

    showConfirm('Confirmer ?', `Voulez-vous enregistrer cette ${modalType === 'IN' ? 'entrée' : 'sortie'} de ${quantity} "${article.name}" ?`, async () => {
      closeAlert();
      setIsSaving(true);
      try {
        await storage.create('mouvements', { ...formData, type: modalType, storeId, quantity });
        await loadMouvements(); // Recharger depuis l'API
        await loadData();       // Recharger les articles et les stocks
        setIsModalOpen(false);
        showAlert('success', 'Succès', "Mouvement enregistré !");
      } catch (err) { 
        showAlert('error', 'Erreur', err.message); 
      } finally {
        setIsSaving(false);
      }
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
  const getArticleCode = (id) => {
    const art = articles.find(x => x.id === id);
    return art ? (art.code || art.barcode || '') : '';
  };
  const getArticlePrice = (id) => {
    const art = articles.find(x => x.id === id);
    return art ? art.price : 0;
  };
  const formatDate = (iso) => new Date(iso).toLocaleString('fr-FR');

  // L'export continue de télécharger toutes les données correspondantes.
  // Pour une liste très très grande on devrait utiliser un appel API spécifique à l'export,
  // mais on laisse comme tel pour la démo ou on passe par la liste existante + un fetch spécifique si besoin.
  const fetchAllForExport = async () => {
    try {
      const selectedStore = localStorage.getItem('selectedStore');
      const token = sessionStorage.getItem('token');
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filterArticleId) params.set('articleId', filterArticleId);
      if (filterType) params.set('type', filterType);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (selectedStore) params.set('storeId', selectedStore);

      const res = await fetch(`/api/mouvements?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    } catch(e) {
      console.error(e);
      return [];
    }
  };

  const [articleSearch, setArticleSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const handleArticleSearch = (val) => {
    setArticleSearch(val);
    const trimmedVal = val.trim();
    if (trimmedVal.length > 1) {
      const cleanVal = trimmedVal.toLowerCase().replace(/[\s-]/g, '');
      const filtered = articles.filter(a => {
        const nameMatch = a.name.toLowerCase().includes(trimmedVal.toLowerCase());
        const codeClean = a.code ? a.code.toLowerCase().replace(/[\s-]/g, '') : '';
        const barcodeClean = a.barcode ? a.barcode.toLowerCase().replace(/[\s-]/g, '') : '';
        const codeMatch = codeClean.includes(cleanVal);
        const barcodeMatch = barcodeClean.includes(cleanVal);
        return nameMatch || codeMatch || barcodeMatch;
      }).slice(0, 10);
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

  if (isReporting) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'NS AUTOFLOW'}</h1>
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          <h2 style={{ marginTop: '15px' }}>RAPPORT DES MOUVEMENTS</h2>
          <p>Période : {startDate || 'Début'} au {endDate || 'Fin'}</p>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Article</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Quantité</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {mouvements.map((mov) => (
              <tr key={mov.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{formatDate(mov.date)}</td>
                <td style={{ padding: '8px' }}>{mov.type === 'IN' ? 'Entrée' : 'Sortie'}</td>
                <td style={{ padding: '8px' }}>
                  {mov.articleName || getArticleName(mov.articleId)}
                  {(mov.articleCode || getArticleCode(mov.articleId)) && (
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#666', marginTop: '2px' }}>
                      Ref: {mov.articleCode || getArticleCode(mov.articleId)}
                    </span>
                  )}
                </td>
                <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>{mov.type === 'IN' ? '+' : '-'}{mov.quantity}</td>
                <td style={{ padding: '8px', fontSize: '0.9rem' }}>{mov.notes || '-'}</td>
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
        <div><h1>Mouvements</h1><p>Historique des entrées et sorties</p></div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleExport} title="Exporter Excel">
            <Download size={18} /> Excel
          </button>
          <button className="btn btn-secondary" onClick={handlePrintReport} title="Imprimer / PDF">
            <FileText size={18} /> PDF
          </button>
          {currentUser?.role !== 'observateur' && (<button className="btn btn-success" onClick={() => { handleOpenModal('IN'); setArticleSearch(''); }}><ArrowDownRight size={16} /> Entrée</button>)}
          {currentUser?.role !== 'observateur' && (<button className="btn btn-danger" onClick={() => { handleOpenModal('OUT'); setArticleSearch(''); }}><ArrowUpRight size={16} /> Sortie</button>)}
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
              {isLoading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '20px', height: '20px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                      Chargement des mouvements...
                    </div>
                  </td>
                </tr>
              ) : mouvements.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun mouvement trouvé.</td></tr>
              ) : mouvements.map(mov => (
                <tr key={mov.id}>
                  <td>{formatDate(mov.date)}</td>
                  <td><span className={`badge ${mov.type === 'IN' ? 'badge-success' : 'badge-danger'}`}>{mov.type === 'IN' ? 'Entrée' : 'Sortie'}</span></td>
                  <td style={{ fontWeight: 500 }}>
                    {mov.articleName || getArticleName(mov.articleId)}
                    {(mov.articleCode || getArticleCode(mov.articleId)) && (
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Ref: {mov.articleCode || getArticleCode(mov.articleId)}
                      </span>
                    )}
                  </td>
                  <td>{mov.supplierName || '-'}</td>
                  <td style={{ fontWeight: 'bold' }}>{mov.type === 'IN' ? '+' : '-'}{mov.quantity}</td>
                  <td className="text-muted">{mov.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {pagination.totalPages > 1 && (
          <div className="pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Affichage de {(currentPage - 1) * itemsPerPage + 1} à {Math.min(currentPage * itemsPerPage, pagination.total)} sur {pagination.total}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1 || isLoading}><ChevronLeft size={16} /> Précédent</button>
              <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#f1f5f9', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600 }}>{currentPage} / {pagination.totalPages}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage(p => Math.min(p + 1, pagination.totalPages))} disabled={currentPage >= pagination.totalPages || isLoading}>Suivant <ChevronRight size={16} /></button>
            </div>
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
                <div className="form-group"><label className="form-label">Quantité</label><input type="number" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} min="0" className="form-control" required value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} /></div>
                {modalType === 'IN' && <div className="form-group"><label className="form-label">Fournisseur</label><select className="form-control" value={formData.supplierId} onChange={(e) => setFormData({...formData, supplierId: e.target.value})}>
                  <option value="">Choisir...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select></div>}
                <div className="form-group"><label className="form-label">Notes</label><input type="text" className="form-control" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" disabled={isSaving} onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className={modalType === 'IN' ? 'btn btn-success' : 'btn btn-danger'} disabled={isSaving}>
                  {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
