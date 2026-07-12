'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, Edit2, Trash2, X, AlertTriangle, Search, Download, ChevronLeft, ChevronRight, Info, FileText } from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';
import { calculateStockOutPrediction } from '../../utils/stockPrediction';
import AlertModal from '../../components/AlertModal';
import { useAuth } from '../../providers';
import { hasPermission } from '../../lib/auth';

export default function ArticlesPage() {
  const [articles, setArticles] = useState([]);
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [stockFilter, setStockFilter] = useState('all');
  const [importStoreId, setImportStoreId] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [settings, setSettings] = useState(null);
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    id: '',
    code: '',
    name: '',
    price: '',
    minStock: '',
    currentStock: 0,
    barcode: '',
    storeId: ''
  });

  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, page: 1, limit: 50 });
  const [isLoading, setIsLoading] = useState(false);
  const itemsPerPage = 50;

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    const selStore = localStorage.getItem('selectedStore');
    if (selStore && selStore !== 'all') setImportStoreId(selStore);
  }, []);
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
    loadData();
    loadSettings();
  }, []);

  // Recharge les articles quand la page, la recherche ou le filtre de stock change
  useEffect(() => {
    loadArticles();
  }, [currentPage, debouncedSearch, stockFilter]);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadArticles = async () => {
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
      if (selectedStore) params.set('storeId', selectedStore);
      if (stockFilter !== 'all') params.set('stockFilter', stockFilter);

      const res = await fetch(`/api/articles?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      const result = await res.json();
      setArticles(result.data || []);
      setPagination(result.pagination || { total: 0, totalPages: 1, page: 1, limit: 50 });
    } catch (err) {
      console.error('Error loading articles:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const storesData = await storage.get('stores');
      setStores(storesData);
    } catch (err) {
      console.error('Error loading stores:', err);
    }
  };

  const handleExport = async () => {
    // Pour l'export, on récupère tous les articles sans pagination
    try {
      showAlert('info', 'Export en cours...', 'Chargement de tous les articles pour l\'export.');
      const selectedStore = localStorage.getItem('selectedStore');
      const token = sessionStorage.getItem('token');
      const params = new URLSearchParams({ page: 1, limit: 9999, _t: Date.now() });
      if (selectedStore) params.set('storeId', selectedStore);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (stockFilter !== 'all') params.set('stockFilter', stockFilter);
      const res = await fetch(`/api/articles?${params.toString()}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        cache: 'no-store'
      });
      const result = await res.json();
      const allArticles = result.data || [];

      const headers = [
        { key: 'code', label: 'Code' },
        { key: 'name', label: 'Désignation' },
        { key: 'barcode', label: 'Code-barres' },
        ...(hasPermission(user, 'sales', 'view_prices') ? [{ key: 'price', label: 'Prix (XOF)' }] : []),
        { key: 'currentStock', label: 'Stock Actuel' },
        { key: 'minStock', label: 'Seuil d\'Alerte' }
      ];
      exportToExcel(allArticles, headers, 'inventaire_stock', {
        title: 'INVENTAIRE DES ARTICLES',
        companyName: settings?.companyName || 'NS AUTO',
        period: `Le ${new Date().toLocaleDateString('fr-FR')}`
      });
      showAlert('success', 'Succès !', 'Exportation Excel réussie !');
    } catch (err) {
      console.error(err);
      showAlert('error', 'Erreur', 'Impossible d\'exporter les articles.');
    }
  };

  const handlePrintReport = () => {
    setIsReporting(true);
    setTimeout(() => {
      window.print();
      setIsReporting(false);
    }, 500);
  };

  const handleOpenModal = async (article = null) => {
    if (article) {
      setFormData(article);
    } else {
      setFormData({
        id: '',
        code: '',
        name: '',
        price: '',
        minStock: '',
        currentStock: 0,
        barcode: '',
        storeId: localStorage.getItem('selectedStore') || ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const selectedStore = localStorage.getItem('selectedStore');
    const newArticle = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      minStock: parseInt(formData.minStock) || 0,
      currentStock: parseInt(formData.currentStock) || 0,
      barcode: formData.barcode || '',
      storeId: formData.storeId || (selectedStore && selectedStore !== 'all' ? selectedStore : null)
    };

    if (newArticle.price < 0 || newArticle.minStock < 0 || newArticle.currentStock < 0) {
      showAlert('error', 'Erreur de saisie', "Le prix, le stock et le seuil d'alerte ne peuvent pas être négatifs.");
      return;
    }
    
    try {
      if (formData.id) {
        await storage.update('articles', formData.id, newArticle);
        showAlert('success', 'Succès !', 'Produit mis à jour !');
      } else {
        await storage.create('articles', newArticle);
        showAlert('success', 'Succès !', 'Produit ajouté avec succès !');
      }
      await loadArticles();
      handleCloseModal();
    } catch (error) {
      showAlert('error', 'Erreur', `Erreur lors de l'enregistrement : ${error.message}`);
    }
  };

  const handleDelete = (id) => {
    showConfirm(
      'Confirmation',
      'Êtes-vous sûr de vouloir supprimer cet article ?',
      async () => {
        closeAlert();
        try {
          await storage.remove('articles', id);
          await loadArticles();
          showAlert('success', 'Succès !', 'Produit supprimé !');
        } catch (error) {
          console.error('Error deleting article:', error);
          showAlert('error', 'Erreur', `Erreur lors de la suppression : ${error.message}`);
        }
      }
    );
  };

  // Les articles affichés viennent directement du serveur, déjà filtrés et paginés
  const currentArticles = articles;
  const totalPages = pagination.totalPages;

  if (isReporting) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'NS AUTO'}</h1>
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          <h2 style={{ marginTop: '15px' }}>INVENTAIRE DU STOCK</h2>
          <p>Généré le : {new Date().toLocaleString('fr-FR')}</p>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Code</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Désignation</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Prix</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Stock</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Seuil</th>
            </tr>
          </thead>
          <tbody>
            {currentArticles.map((article) => (
              <tr key={article.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{article.code || '-'}</td>
                <td style={{ padding: '8px', fontWeight: 500 }}>{article.name}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{formatPrice(article.price)} FCFA</td>
                <td style={{ textAlign: 'center', padding: '8px', fontWeight: 'bold' }}>{article.currentStock}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{article.minStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '30px', fontSize: '0.8rem', textAlign: 'right' }}>
          Nombre total d'articles : {currentArticles.length}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Articles</h1>
          <p>Gestion des articles en stock</p>
        </div>
        <div className="header-actions">
          {hasPermission(user, 'stock', 'edit') && (
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
              <Plus size={18} /> Importer
            </button>
          )}
          {hasPermission(user, 'stock', 'view') && (
            <button className="btn btn-secondary" onClick={handleExport} title="Exporter Excel">
              <Download size={18} /> Excel
            </button>
          )}
          <button className="btn btn-secondary" onClick={handlePrintReport} title="Imprimer / PDF">
            <FileText size={18} /> PDF
          </button>
          {hasPermission(user, 'stock', 'create') && (
            <button className="btn btn-primary" onClick={() => handleOpenModal()} >
              <Plus size={16} /> Nouvel Article
            </button>
          )}
        </div>
      </div>

      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Importer des articles (Excel)</h3>
              <button className="modal-close" onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: '1.5rem', fontSize: '0.85rem', borderLeft: '4px solid var(--info)', padding: '1rem' }}>
                <div style={{ fontWeight: 800, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Info size={16} /> RÈGLES D'IMPORTATION (EXCEL)
                </div>
                <ul style={{ paddingLeft: '1.2rem', margin: 0, lineHeight: '1.6' }}>
                  <li><strong>Nombres :</strong> Pas de séparateur de milliers (ex: <code>15000</code> et non <code>15 000</code>).</li>
                  <li><strong>Virgules :</strong> Utilisez le point pour les décimales (ex: <code>12.5</code>).</li>
                  <li><strong>Monnaie :</strong> Ne mettez pas "FCFA" dans les cases de prix.</li>
                  <li><strong>Colonnes :</strong> Nom, Code, Code-barres, Prix, Stock, Seuil (en ligne 1).</li>
                </ul>
                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--success)', fontWeight: 600 }}>
                  💡 Note : Si vous faites une erreur (ex: 15 000 ou 15,5), le système nettoiera automatiquement la donnée pour vous.
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Magasin de destination</label>
                <select 
                  className="form-control" 
                  required 
                  value={importStoreId} 
                  onChange={(e) => setImportStoreId(e.target.value)}
                >
                  <option value="">Sélectionner un magasin...</option>
                  {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Tous les articles du fichier seront importés dans ce magasin.
                </p>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Fichier Excel</label>
                <input 
                  type="file" 
                  className="form-control"
                  accept=".xlsx, .xls"
                  disabled={!importStoreId}
                  onChange={async (e) => {
                    const file = e.target.files[0];
                    if (!file || !importStoreId) return;
                    
                    const reader = new FileReader();
                    reader.onload = async (evt) => {
                      try {
                        const { read, utils } = await import('xlsx');
                        const wb = read(evt.target.result, { type: 'binary' });
                        const wsname = wb.SheetNames[0];
                        const ws = wb.Sheets[wsname];
                        const data = utils.sheet_to_json(ws);
                        
                        const mappedData = data.map(row => {
                          const keys = {};
                          // Normalisation robuste : minuscule + suppression des espaces
                          Object.keys(row).forEach(k => {
                            keys[k.toLowerCase().trim()] = row[k];
                          });

                          const resultRow = { id: keys.id };

                          const codeKey = Object.keys(keys).find(k => k === 'code' || k === 'référence' || k === 'reference' || k === 'ref');
                          if (codeKey !== undefined) resultRow.code = String(keys[codeKey] || '').trim();

                          const nameKey = Object.keys(keys).find(k => k === 'name' || k === 'nom' || k === 'article');
                          if (nameKey !== undefined) resultRow.name = String(keys[nameKey] || '').trim();

                          const priceKey = Object.keys(keys).find(k => k === 'price' || k === 'prix' || k === 'tarif');
                          if (priceKey !== undefined) resultRow.price = keys[priceKey];

                          const stockKey = Object.keys(keys).find(k => k === 'currentstock' || k === 'stock' || k === 'quantité' || k === 'quantite' || k === 'stock actuel');
                          if (stockKey !== undefined) resultRow.currentStock = keys[stockKey];

                          const minStockKey = Object.keys(keys).find(k => k === 'minstock' || k === 'seuil' || k === 'seuil alerte');
                          if (minStockKey !== undefined) resultRow.minStock = keys[minStockKey];

                          const barcodeKey = Object.keys(keys).find(k => k === 'barcode' || k === 'code-barres' || k === 'codebarre');
                          if (barcodeKey !== undefined) resultRow.barcode = String(keys[barcodeKey] || '').trim();

                          return resultRow;
                        }).filter(row => row.barcode || row.name);

                        if (mappedData.length === 0) throw new Error("Aucune donnée valide trouvée.");

                        // Validation locale des colonnes
                        const localWarnings = [];
                        if (data.length > 0) {
                          const keys = Object.keys(data[0]).map(k => k.toLowerCase().trim());
                          const expected = [
                            { name: 'Nom / Désignation', match: ['nom', 'name', 'article', 'designation', 'désignation'] },
                            { name: 'Code / Référence', match: ['code', 'référence', 'reference', 'ref'] },
                            { name: 'Code-barres', match: ['code-barres', 'codebarre', 'barcode', 'barres'] },
                            { name: 'Prix', match: ['prix', 'price', 'tarif'] },
                            { name: 'Stock', match: ['stock', 'quantité', 'quantite', 'qte', 'qté', 'stock actuel'] },
                            { name: 'Seuil d\'alerte', match: ['seuil', 'alert', 'minstock', 'min'] }
                          ];
                          expected.forEach(exp => {
                            const found = keys.some(k => exp.match.some(m => k.includes(m)));
                            if (!found) {
                              localWarnings.push(`La colonne standard pour "${exp.name}" semble manquante.`);
                            }
                          });
                        }

                        const res = await storage.create('articles/import', { 
                          data: mappedData, 
                          storeId: importStoreId 
                        });
                        
                        const allWarnings = [...localWarnings, ...(res.warnings || [])];
                        setImportReport({
                          summary: res.summary || {
                            total: mappedData.length,
                            created: res.created || 0,
                            updated: res.updated || 0,
                            ignored: 0,
                            valuationChange: 0
                          },
                          details: res.details || [],
                          warnings: allWarnings
                        });
                        setIsImportModalOpen(false);
                        setIsReportModalOpen(true);
                        loadData();
                        loadArticles();
                      } catch (err) {
                        showAlert('error', 'Erreur d\'import', err.message);
                      }
                    };
                    reader.readAsBinaryString(file);
                    e.target.value = null;
                  }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      <div className="toolbar" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher par code, nom ou code-barres..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ minWidth: '220px' }}>
          <select
            className="form-control"
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">📦 Tous les stocks</option>
            <option value="empty">⚠️ En rupture (Stock = 0)</option>
            <option value="available">✅ En stock (Stock ≥ 1)</option>
          </select>
        </div>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Nom</th>
                <th>Code-barres</th>
                {hasPermission(user, 'sales', 'view_prices') && <th>Prix</th>}
                <th>Stock Actuel</th>
                <th>Seuil d'Alerte</th>
                <th>Prédiction</th>
                {hasPermission(user, 'stock', 'edit') && <th style={{ width: '150px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '20px', height: '20px', border: '3px solid var(--border-color)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                      Chargement des articles...
                    </div>
                  </td>
                </tr>
              ) : currentArticles.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Aucun article trouvé.</td>
                </tr>
              ) : (
                currentArticles.map((article) => {
                    const isLowStock = article.currentStock <= article.minStock;
                    const prediction = calculateStockOutPrediction(article.id, null, article.currentStock, article.soldLast30Days);
                    return (
                      <tr key={article.id} className={isLowStock ? 'tr-danger' : ''}>
                        <td style={{ fontWeight: 500 }}>{article.code || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{article.name}</td>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{article.barcode || '-'}</td>
                        {hasPermission(user, 'sales', 'view_prices') && <td>{formatPrice(article.price)} FCFA</td>}
                        <td>
                          <span style={{ color: isLowStock ? 'var(--danger)' : 'var(--success)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {article.currentStock}
                            {isLowStock && <AlertTriangle size={14} />}
                          </span>
                        </td>
                        <td>{article.minStock}</td>
                        <td>
                          {prediction.daysRemaining !== null ? (
                            <span className={`prediction-badge prediction-${prediction.status}`}>
                              {prediction.daysRemaining === Infinity ? 'Stable' : `${prediction.daysRemaining} j`}
                            </span>
                          ) : '-'}
                        </td>
                        {(hasPermission(user, 'stock', 'edit') || hasPermission(user, 'stock', 'delete')) && (
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {hasPermission(user, 'stock', 'edit') && <button className="btn btn-secondary" onClick={() => handleOpenModal(article)}><Edit2 size={16} /></button>}
                              {hasPermission(user, 'stock', 'delete') && <button className="btn btn-danger-outline" onClick={() => handleDelete(article.id)}><Trash2 size={16} /></button>}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1 || isLoading}><ChevronLeft size={16} /></button>
            <span>Page {currentPage} / {totalPages} ({pagination.total} articles)</span>
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages || isLoading}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{formData.id ? 'Modifier l\'Article' : 'Nouvel Article'}</h3>
              <button className="modal-close" onClick={handleCloseModal}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Code article</label>
                    <input type="text" className="form-control" value={formData.code || ''} onChange={(e) => setFormData({...formData, code: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Nom de l'article</label>
                    <input type="text" className="form-control" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label className="form-label">Code-barres</label>
                  <input type="text" className="form-control" value={formData.barcode || ''} onChange={(e) => setFormData({...formData, barcode: e.target.value})} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Prix (FCFA)</label>
                    <input type="number" min="0" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} className="form-control" required value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Seuil Alerte</label>
                    <input type="number" min="0" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} className="form-control" required value={formData.minStock} onChange={(e) => setFormData({...formData, minStock: e.target.value})} />
                  </div>
                </div>
                {(user?.role === 'admin' || user?.role === 'gestionnaire') && !formData.id && (
                  <div className="form-group">
                    <label className="form-label">Magasin</label>
                    <select className="form-control" required value={formData.storeId} onChange={(e) => setFormData({...formData, storeId: e.target.value})}>
                      <option value="">Choisir...</option>
                      {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {!formData.id && (
                  <div className="form-group">
                    <label className="form-label">Stock Initial</label>
                    <input type="number" min="0" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} className="form-control" required value={formData.currentStock} onChange={(e) => setFormData({...formData, currentStock: e.target.value})} />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isReportModalOpen && importReport && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3>Rapport d'importation Excel</h3>
              <button className="modal-close" onClick={() => setIsReportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              
              {/* Summary KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8f9fa', border: '1px solid #dee2e6', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#6c757d', fontWeight: 600 }}>Total traité</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#212529', marginTop: '0.25rem' }}>{importReport.summary?.total || 0}</div>
                </div>
                <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#2e7d32', fontWeight: 600 }}>Créés</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#1b5e20', marginTop: '0.25rem' }}>{importReport.summary?.created || 0}</div>
                </div>
                <div style={{ background: '#e3f2fd', border: '1px solid #bbdefb', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#1565c0', fontWeight: 600 }}>Mis à jour</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0d47a1', marginTop: '0.25rem' }}>{importReport.summary?.updated || 0}</div>
                </div>
                <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.85rem', color: '#ef6c00', fontWeight: 600 }}>Ignorés / Vides</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#e65100', marginTop: '0.25rem' }}>{importReport.summary?.ignored || 0}</div>
                </div>
              </div>

              {/* Financial Valuation Impact */}
              <div style={{ 
                background: (importReport.summary?.valuationChange || 0) >= 0 ? '#e8f5e9' : '#ffebee', 
                borderLeft: `5px solid ${(importReport.summary?.valuationChange || 0) >= 0 ? '#4caf50' : '#f44336'}`,
                padding: '1rem', 
                borderRadius: '6px', 
                marginBottom: '1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 600, color: '#333' }}>Impact financier sur la valeur du stock :</span>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#666' }}>Calculé sur les prix et quantités ajoutés ou mis à jour</p>
                </div>
                <div style={{ 
                  fontSize: '1.25rem', 
                  fontWeight: 'bold', 
                  color: (importReport.summary?.valuationChange || 0) >= 0 ? '#2e7d32' : '#c62828' 
                }}>
                  {(importReport.summary?.valuationChange || 0) >= 0 ? '+' : ''}
                  {formatPrice(importReport.summary?.valuationChange || 0)} FCFA
                </div>
              </div>

              {/* Warnings / anomalies */}
              {importReport.warnings && importReport.warnings.length > 0 && (
                <div style={{ background: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', padding: '1rem', borderRadius: '6px', marginBottom: '1.5rem' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={16} /> Avertissements détectés ({importReport.warnings.length}) :
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem' }}>
                    {importReport.warnings.slice(0, 10).map((warn, index) => (
                      <li key={index}>{warn}</li>
                    ))}
                    {importReport.warnings.length > 10 && (
                      <li>... et {importReport.warnings.length - 10} autres anomalies de formatage.</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Detailed Modification Log */}
              {importReport.details && importReport.details.length > 0 ? (
                <div>
                  <h4 style={{ marginBottom: '0.75rem', color: '#333' }}>Détails des modifications</h4>
                  <div style={{ border: '1px solid #dee2e6', borderRadius: '6px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', margin: 0, fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Article</th>
                          <th style={{ padding: '10px', textAlign: 'left' }}>Action / Modifications</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importReport.details.map((detail, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #dee2e6' }}>
                            <td style={{ padding: '10px', verticalAlign: 'top' }}>
                              <div style={{ fontWeight: 600 }}>
                                {detail.action === 'error' ? `Ligne ${detail.row} : ${detail.name}` : detail.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                                {detail.action === 'error' ? '' : `Code-barres : ${detail.barcode || 'N/A'}`}
                              </div>
                            </td>
                            <td style={{ padding: '10px', verticalAlign: 'top' }}>
                              {detail.action === 'create' ? (
                                <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                                  Créé (Stock: {detail.stock} | Prix: {formatPrice(detail.price)} FCFA)
                                </span>
                              ) : detail.action === 'error' ? (
                                <div>
                                  <span style={{ background: '#ffebee', color: '#c62828', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block', marginBottom: '4px' }}>
                                    Rejeté
                                  </span>
                                  <div style={{ fontSize: '0.8rem', color: '#c62828', fontWeight: 600 }}>
                                    ⚠️ {detail.reason}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <span style={{ background: '#e3f2fd', color: '#1565c0', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block', marginBottom: '4px' }}>
                                    Mis à jour
                                  </span>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.8rem', color: '#333' }}>
                                    {detail.changes.name && (
                                      <div>Nom : <s>{detail.changes.name.old}</s> ➔ <strong>{detail.changes.name.new}</strong></div>
                                    )}
                                    {detail.changes.code && (
                                      <div>Réf : <s>{detail.changes.code.old}</s> ➔ <strong>{detail.changes.code.new}</strong></div>
                                    )}
                                    {detail.changes.price && (
                                      <div>Prix : <s>{formatPrice(detail.changes.price.old)} FCFA</s> ➔ <strong>{formatPrice(detail.changes.price.new)} FCFA</strong></div>
                                    )}
                                    {detail.changes.stock && (
                                      <div>Stock : <s>{detail.changes.stock.old}</s> ➔ <strong>{detail.changes.stock.new}</strong></div>
                                    )}
                                    {detail.changes.minStock && (
                                      <div>Seuil : <s>{detail.changes.minStock.old}</s> ➔ <strong>{detail.changes.minStock.new}</strong></div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p style={{ textAlign: 'center', color: '#6c757d', margin: '2rem 0' }}>Aucun article n'a subi de modification de valeur.</p>
              )}

            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setIsReportModalOpen(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
