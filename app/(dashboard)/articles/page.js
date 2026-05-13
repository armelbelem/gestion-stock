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
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
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

  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  useEffect(() => {
    const selStore = localStorage.getItem('selectedStore');
    if (selStore && selStore !== 'all') setImportStoreId(selStore);
  }, []);
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory]);

  useEffect(() => {
    loadData();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadData = async () => {
    try {
      const articlesData = await storage.get('articles');
      const storesData = await storage.get('stores');
      const salesData = await storage.get('sales');
      setArticles(articlesData);
      setStores(storesData);
      setSales(salesData);
    } catch (err) {
      console.error("Error loading articles data:", err);
    }
  };

  const handleExport = () => {
    const headers = [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Désignation' },
      { key: 'barcode', label: 'Code-barres' },
      { key: 'price', label: 'Prix (XOF)' },
      { key: 'currentStock', label: 'Stock Actuel' },
      { key: 'minStock', label: 'Seuil d\'Alerte' }
    ];
    
    exportToExcel(filteredArticles, headers, 'inventaire_stock', {
      title: "INVENTAIRE DES ARTICLES",
      companyName: settings?.companyName || "NS AUTO",
      period: `Le ${new Date().toLocaleDateString('fr-FR')}`
    });
    showAlert('success', 'Succès !', "Exportation Excel réussie !");
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
        showAlert('success', 'Succès !', "Produit mis à jour !");
      } else {
        await storage.create('articles', newArticle);
        showAlert('success', 'Succès !', "Produit ajouté avec succès !");
      }
      await loadData();
      handleCloseModal();
    } catch (error) {
      showAlert('error', 'Erreur', `Erreur lors de l'enregistrement : ${error.message}`);
    }
  };

  const handleDelete = (id) => {
    showConfirm(
      "Confirmation",
      "Êtes-vous sûr de vouloir supprimer cet article ?",
      async () => {
        closeAlert();
        try {
          await storage.remove('articles', id);
          await loadData();
          showAlert('success', 'Succès !', "Produit supprimé !");
        } catch (error) {
          console.error("Error deleting article:", error);
          showAlert('error', 'Erreur', `Erreur lors de la suppression : ${error.message}`);
        }
      }
    );
  };

  const filteredArticles = articles
    .filter(article => {
      return article.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
             (article.code && article.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
             (article.barcode && article.barcode.toLowerCase().includes(searchTerm.toLowerCase()));
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentArticles = filteredArticles.slice(indexOfFirstItem, indexOfLastItem);

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
            {filteredArticles.map((article) => (
              <tr key={article.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{article.code || '-'}</td>
                <td style={{ padding: '8px', fontWeight: 500 }}>{article.name}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{article.price.toLocaleString()} FCFA</td>
                <td style={{ textAlign: 'center', padding: '8px', fontWeight: 'bold' }}>{article.currentStock}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{article.minStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '30px', fontSize: '0.8rem', textAlign: 'right' }}>
          Nombre total d'articles : {filteredArticles.length}
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
            <>
              <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
                <Plus size={18} /> Importer
              </button>
              <button className="btn btn-secondary" onClick={handleExport} title="Exporter Excel">
                <Download size={18} /> Excel
              </button>
            </>
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
                  <li><strong>Colonnes :</strong> Nom, Code, Prix, Stock, Seuil (en ligne 1).</li>
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

                          return {
                            id: keys.id,
                            code: String(keys.code || keys.référence || keys.reference || keys.ref || '').trim(),
                            name: String(keys.name || keys.nom || keys.article || '').trim(),
                            price: keys.price || keys.prix || keys.tarif,
                            currentStock: keys.currentstock || keys.stock || keys.quantité || keys['stock actuel'],
                            minStock: keys.minstock || keys['seuil alerte'] || keys.seuil,
                            barcode: String(keys.barcode || keys['code-barres'] || keys.codebarre || '').trim()
                          };
                        }).filter(row => row.name);

                        if (mappedData.length === 0) throw new Error("Aucune donnée valide trouvée.");

                        const res = await storage.create('articles/import', { 
                          data: mappedData, 
                          storeId: importStoreId 
                        });
                        
                        showAlert('success', 'Import réussi !', `${res.updated} articles mis à jour, ${res.created} nouveaux créés dans le magasin sélectionné.`);
                        setIsImportModalOpen(false);
                        loadData();
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

      <div className="toolbar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher par code, nom ou code-barres..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
                <th>Code-barres</th>
                {hasPermission(user, 'sales', 'view_prices') && <th>Prix</th>}
                <th>Stock Actuel</th>
                <th>Seuil d'Alerte</th>
                <th>Prédiction</th>
                {hasPermission(user, 'stock', 'edit') && <th style={{ width: '150px' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {currentArticles.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Aucun article trouvé.</td>
                </tr>
              ) : (
                currentArticles.map((article) => {
                    const isLowStock = article.currentStock <= article.minStock;
                    const prediction = calculateStockOutPrediction(article.id, sales, article.currentStock);
                    let storeDetails = [];
                    try {
                      storeDetails = typeof article.storeDetails === 'string' ? JSON.parse(article.storeDetails) : (article.storeDetails || []);
                    } catch (e) { console.error(e); }

                    return (
                      <tr key={article.id} className={isLowStock ? 'tr-danger' : ''}>
                        <td style={{ fontWeight: 500 }}>{article.code || '-'}</td>
                        <td style={{ fontWeight: 600 }}>{article.name}</td>
                        <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{article.barcode || '-'}</td>
                        {hasPermission(user, 'sales', 'view_prices') && <td>{article.price.toLocaleString()} FCFA</td>}
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
                    <input type="number" className="form-control" required value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Seuil Alerte</label>
                    <input type="number" className="form-control" required value={formData.minStock} onChange={(e) => setFormData({...formData, minStock: e.target.value})} />
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
                    <input type="number" className="form-control" required value={formData.currentStock} onChange={(e) => setFormData({...formData, currentStock: e.target.value})} />
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

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
