import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Plus, Edit2, Trash2, X, AlertTriangle, CheckCircle, Search, Filter, Download, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { exportToCSV } from '../utils/csvExport';
import { calculateStockOutPrediction } from '../utils/stockPrediction';
import AlertModal from '../components/AlertModal';
import { useAuth } from '../context/AuthContext';

const Articles = () => {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stores, setStores] = useState([]);
  const [sales, setSales] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    categoryId: '',
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
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setArticles(await storage.get('articles'));
    setCategories(await storage.get('categories'));
    setStores(await storage.get('stores'));
    setSales(await storage.get('sales'));
  };

  const handleExport = () => {
    const headers = [
      { key: 'name', label: 'Nom' },
      { key: 'categoryName', label: 'Catégorie' },
      { key: 'price', label: 'Prix (XOF)' },
      { key: 'currentStock', label: 'Stock Actuel' },
      { key: 'minStock', label: 'Seuil d\'Alerte' }
    ];
    
    // Map articles to include category name for the CSV
    const dataToExport = filteredArticles.map(art => ({
      ...art,
      categoryName: getCategoryName(art.categoryId)
    }));
    
    exportToCSV(dataToExport, headers, 'articles_stock');
    showAlert('success', 'Succès !', "Exportation CSV réussie !");
  };

  const handleOpenModal = async (article = null) => {
    // Refresh categories to make sure we have the latest list
    const updatedCategories = await storage.get('categories');
    setCategories(updatedCategories);

    if (article) {
      setFormData(article);
    } else {
      setFormData({
        id: '',
        name: '',
        categoryId: updatedCategories.length > 0 ? updatedCategories[0].id : '',
        price: '',
        minStock: '',
        currentStock: 0,
        barcode: '',
        storeId: localStorage.getItem('selectedStore') !== 'all' ? localStorage.getItem('selectedStore') : ''
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Parse numeric fields
    const selectedStore = localStorage.getItem('selectedStore');
    const newArticle = {
      ...formData,
      price: parseFloat(formData.price) || 0,
      minStock: parseInt(formData.minStock) || 0,
      currentStock: parseInt(formData.currentStock) || 0,
      barcode: formData.barcode || '',
      storeId: formData.storeId || (selectedStore !== 'all' ? selectedStore : null)
    };

    // Validation des valeurs négatives
    if (newArticle.price < 0 || newArticle.minStock < 0 || newArticle.currentStock < 0) {
      showAlert('error', 'Erreur de saisie', "Le prix, le stock et le seuil d'alerte ne peuvent pas être négatifs.");
      return;
    }
    
    try {
      if (formData.id) {
        // Update
        await storage.update('articles', formData.id, newArticle);
        showAlert('success', 'Succès !', "Produit mis à jour !");
      } else {
        // Create
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

  const getCategoryName = (id) => {
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : 'Non défini';
  };

  const filteredArticles = articles.filter(article => {
    const matchesSearch = article.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === '' || article.categoryId === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const totalPages = Math.ceil(filteredArticles.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentArticles = filteredArticles.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Articles</h1>
          <p>Gestion des articles en stock</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className="btn btn-secondary" 
            onClick={handleExport}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Download size={18} /> Exporter
          </button>
          <button 
            className="btn btn-primary" 
            onClick={() => handleOpenModal()}
            disabled={categories.length === 0}
            title={categories.length === 0 ? "Ajoutez une catégorie avant de créer un article" : ""}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={16} /> Nouvel Article
          </button>
        </div>
      </div>

      <div className="toolbar">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher un article..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-wrapper">
          <select 
            className="form-control filter-select"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Toutes les catégories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {categories.length === 0 && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fff3cd', 
          color: '#856404', 
          borderRadius: '8px', 
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          border: '1px solid #ffeeba'
        }}>
          <AlertTriangle size={20} />
          <span>Attention : Vous devez d'abord <a href="/categories" style={{ fontWeight: 'bold', color: 'inherit' }}>créer une catégorie</a> avant de pouvoir ajouter des articles.</span>
        </div>
      )}
      
      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Code-barres</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Stock Actuel</th>
                <th>Seuil d'Alerte</th>
                <th>Prédiction</th>
                <th style={{ width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentArticles.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {searchTerm || filterCategory ? 'Aucun article ne correspond à votre recherche.' : 'Aucun article trouvé.'}
                  </td>
                </tr>
              ) : (
                currentArticles.map((article) => {
                    const isLowStock = article.currentStock <= article.minStock;
                    
                    const prediction = calculateStockOutPrediction(article.id, sales, article.currentStock);
                    
                    // Parse storeDetails safely
                    let storeDetails = [];
                    try {
                      storeDetails = typeof article.storeDetails === 'string' 
                        ? JSON.parse(article.storeDetails) 
                        : (article.storeDetails || []);
                    } catch (e) {
                      console.error("Error parsing storeDetails", e);
                    }

                    return (
                      <tr key={article.id} className={isLowStock ? 'tr-danger' : ''}>
                        <td style={{ fontWeight: 600 }}>{article.name}</td>
                      <td style={{ fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {article.barcode || '-'}
                      </td>
                      <td>
                        <span className="badge badge-primary">
                          {getCategoryName(article.categoryId)}
                        </span>
                      </td>
                      <td>{article.price} XOF</td>
                      <td>
                        <div className="stock-container" style={{ position: 'relative' }}>
                          <span style={{ 
                            color: isLowStock ? 'var(--danger)' : 'var(--success)',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            cursor: storeDetails.length > 0 ? 'help' : 'default'
                          }} title={storeDetails.length > 0 ? 
                            storeDetails.map(d => `${d.storeName}: ${d.qty}`).join('\n') : 
                            'Aucun stock local'
                          }>
                            {article.currentStock}
                            {isLowStock && <AlertTriangle size={14} />}
                            {storeDetails.length > 0 && <Info size={12} style={{ marginLeft: '4px', opacity: 0.6 }} />}
                          </span>
                        </div>
                      </td>
                      <td>{article.minStock}</td>
                      <td>
                        {prediction.daysRemaining !== null ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className={`prediction-badge prediction-${prediction.status}`}>
                              {prediction.daysRemaining === Infinity ? 'Stable' : 
                               prediction.daysRemaining === 0 ? 'Rupture !' :
                               `${prediction.daysRemaining} jours restants`}
                            </span>
                            {prediction.dailyVelocity > 0 && (
                              <span className="velocity-info">
                                Vitesse: {prediction.dailyVelocity} / jour
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.75rem' }}>Données insuffisantes</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '0.375rem 0.5rem' }}
                            onClick={() => handleOpenModal(article)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            className="btn btn-danger-outline" 
                            style={{ padding: '0.375rem 0.5rem' }}
                            onClick={() => handleDelete(article.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
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
              Affichage de {indexOfFirstItem + 1} à {Math.min(indexOfLastItem, filteredArticles.length)} sur {filteredArticles.length} articles
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
              <h3>{formData.id ? 'Modifier l\'Article' : 'Nouvel Article'}</h3>
              <button className="modal-close" onClick={handleCloseModal}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nom de l'article</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: Ordinateur Portable XYZ"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Code-barres (Optionnel)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={formData.barcode || ''}
                    onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                    placeholder="Scannez ou tapez le code-barres"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Catégorie</label>
                  <select 
                    className="form-control"
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                  >
                    <option value="" disabled>Sélectionnez une catégorie</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label">Prix unitaire (XOF)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      className="form-control" 
                      required 
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Seuil Minimal (Alerte)</label>
                    <input 
                      type="number" 
                      min="0"
                      className="form-control" 
                      required 
                      value={formData.minStock}
                      onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                    />
                  </div>
                </div>

                {user?.role === 'admin' && !formData.id && (
                  <div className="form-group">
                    <label className="form-label">Magasin de Destination</label>
                    <select 
                      className="form-control"
                      required
                      value={formData.storeId}
                      onChange={(e) => setFormData({...formData, storeId: e.target.value})}
                    >
                      <option value="" disabled>Choisir un magasin</option>
                      {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {!formData.id && (
                  <div className="form-group">
                    <label className="form-label">Stock Initial</label>
                    <input 
                      type="number" 
                      min="0"
                      className="form-control" 
                      required 
                      value={formData.currentStock}
                      onChange={(e) => setFormData({...formData, currentStock: e.target.value})}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
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

export default Articles;
