'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../../lib/storage';
import { 
  Plus, Trash2, CheckCircle, ArrowLeft, Search, 
  User, CreditCard, ShoppingCart, Printer, ScanBarcode 
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../../providers';
import AlertModal from '../../../components/AlertModal';

export default function NewSalePage() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [clients, setClients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [saleItems, setSaleItems] = useState([]); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [paymentType, setPaymentType] = useState('credit');
  const [initialPayment, setInitialPayment] = useState(0);
  const [discount, setDiscount] = useState(0);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  const [hasActiveYear, setHasActiveYear] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [clientsData, articlesData, fyData] = await Promise.all([
        storage.get('clients'),
        storage.get('articles'),
        storage.get('fiscal-years')
      ]);
      setClients(clientsData);
      setArticles(articlesData);
      setHasActiveYear(fyData.some(f => f.status === 'active'));
    } catch (err) {
      console.error("Error loading sales form data:", err);
    }
  };

  const addItem = () => {
    setSaleItems([...saleItems, {
      id: Math.random().toString(36).substr(2, 9),
      articleId: '',
      quantity: 1,
      unitPrice: 0,
      maxStock: 0
    }]);
  };

  const removeItem = (id) => {
    setSaleItems(saleItems.filter(item => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    const updatedItems = saleItems.map(item => {
      if (item.id === id) {
        let newItem = { ...item, [field]: value };
        if (field === 'articleId') {
          const article = articles.find(a => String(a.id) === String(value));
          if (article) {
            newItem.unitPrice = article.price;
            newItem.maxStock = article.currentStock;
          }
        }
        if (field === 'quantity') {
          const article = articles.find(a => String(a.id) === String(item.articleId));
          if (article) {
            const remainingStockAfter = article.currentStock - value;
            if (remainingStockAfter <= article.minStock) {
              showAlert('info', 'Stock Faible', `Attention : Suite à cet ajout, le stock de "${article.name}" sera au niveau critique (${remainingStockAfter} restant).`);
            }
          }
        }
        return newItem;
      }
      return item;
    });
    setSaleItems(updatedItems);
  };

  const calculateTotal = () => {
    return saleItems.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  useEffect(() => {
    if (paymentType === 'complet') {
      const netTotal = calculateTotal() - discount;
      setInitialPayment(netTotal > 0 ? netTotal : 0);
    } else {
      setInitialPayment(0);
    }
  }, [paymentType, saleItems, discount]);

  const handleSearchChange = (val) => {
    setBarcodeInput(val);
    if (val.length > 1) {
      const filtered = articles.filter(a => 
        a.name.toLowerCase().includes(val.toLowerCase()) || 
        a.code?.toLowerCase().includes(val.toLowerCase()) ||
        a.barcode?.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 10);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectArticle = (article) => {
    if (article.currentStock <= 0) {
      showAlert('error', 'Erreur', `Stock épuisé pour ${article.name}`);
      setBarcodeInput('');
      setSuggestions([]);
      return;
    }
    const existingItem = saleItems.find(item => String(item.articleId) === String(article.id));
    if (existingItem) {
      if (existingItem.quantity < article.currentStock) {
        updateItem(existingItem.id, 'quantity', existingItem.quantity + 1);
      } else {
        showAlert('error', 'Erreur', `Pas plus de stock pour ${article.name}`);
      }
    } else {
      setSaleItems([...saleItems, {
        id: Math.random().toString(36).substr(2, 9),
        articleId: article.id,
        quantity: 1,
        unitPrice: article.price,
        maxStock: article.currentStock
      }]);
    }
    setBarcodeInput('');
    setSuggestions([]);
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (!code) return;

      if (suggestions.length > 0) {
        handleSelectArticle(suggestions[0]);
        return;
      }

      const article = articles.find(a => a.barcode === code || a.code === code);
      if (article) {
        handleSelectArticle(article);
      } else {
        showAlert('error', 'Erreur', "Article non trouvé");
        setBarcodeInput('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasActiveYear) return showAlert('error', 'Action bloquée', "Aucun exercice fiscal n'est ouvert. Veuillez ouvrir un exercice dans les réglages avant de pouvoir effectuer une vente.");
    if (!selectedClientId) return showAlert('error', 'Erreur', "Sélectionnez un client");
    const selectedStore = localStorage.getItem('selectedStore');
    const isAdmin = currentUser?.role === 'admin';
    if (isAdmin && (!selectedStore || selectedStore === 'all')) return showAlert('error', 'Action impossible', "Sélectionnez un magasin spécifique.");
    if (saleItems.length === 0) return showAlert('error', 'Erreur', "Panier vide");

    const totalAmount = calculateTotal();
    const storeId = isAdmin ? selectedStore : currentUser?.storeId;

    showConfirm('Valider la vente ?', 'Confirmez-vous l\'enregistrement de cette transaction ?', async () => {
      closeAlert();
      setIsSubmitting(true);
      try {
        const response = await storage.create('sales', {
          clientId: selectedClientId,
          items: saleItems,
          paymentType,
          amountPaid: Number(initialPayment),
          discount: Number(discount),
          storeId
        });
        setSuccessData({ ...response, clientName: clients.find(c => String(c.id) === String(selectedClientId))?.name, items: saleItems.map(si => ({ ...si, articleName: articles.find(a => String(a.id) === String(si.articleId))?.name })) });
      } catch (err) {
        showAlert('error', 'Erreur', err.message);
        setIsSubmitting(false);
      }
    });
  };

  if (successData) {
    return (
      <div className="page" style={{ maxWidth: '600px', textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="content-card">
          <div style={{ marginBottom: '2rem' }}>
            <div className="avatar" style={{ width: '80px', height: '80px', margin: '0 auto 1.5rem', backgroundColor: 'var(--success)' }}>
              <CheckCircle size={48} />
            </div>
            <h1>Vente réussie !</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={() => window.print()} className="btn btn-primary"><Printer size={18} /> Reçu</button>
            <button onClick={() => router.push('/sales')} className="btn btn-secondary">Historique</button>
            <button onClick={() => window.location.reload()} className="btn btn-secondary">Nouvelle vente</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <Link href="/sales" style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}><ArrowLeft size={16} /> Retour</Link>
          <h1>Nouvelle Vente</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 600px' }}>
            <div className="content-card" style={{ marginBottom: '2rem', position: 'relative', overflow: 'visible' }}>
              <div className="form-group" style={{ position: 'relative', margin: 0 }}>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Saisissez le nom, code ou scannez..." 
                  value={barcodeInput} 
                  onChange={(e) => handleSearchChange(e.target.value)} 
                  onKeyDown={handleBarcodeScan} 
                  autoFocus 
                  style={{ border: '2px solid var(--success)', paddingLeft: '3rem', height: '50px', fontSize: '1.1rem' }} 
                />
                <Search size={24} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--success)' }} />
                
                {suggestions.length > 0 && (
                  <div className="suggestions-dropdown" style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, 
                    backgroundColor: 'white', border: '1px solid var(--border)', 
                    borderRadius: '8px', marginTop: '4px', zIndex: 100, 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)', overflow: 'hidden'
                  }}>
                    {suggestions.map(a => (
                      <div 
                        key={a.id} 
                        className="suggestion-item" 
                        onClick={() => handleSelectArticle(a)}
                        style={{ 
                          padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-color)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{a.name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ref: {a.code || '-'} | Stock: {a.currentStock}</div>
                        </div>
                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{a.price.toLocaleString()} FCFA</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="content-card" style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <label className="form-label">Client</label>
                <select className="form-control" required value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
                  <option value="">Sélectionner un client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="content-card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3>Panier</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={14} /> Ajouter</button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th>Qté</th>
                      {currentUser?.role !== 'vendeur' && (
                        <>
                          <th>Prix</th>
                          <th>Total</th>
                        </>
                      )}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleItems.map(item => (
                      <tr key={item.id}>
                        <td>
                          <select className="form-control" value={item.articleId} onChange={(e) => updateItem(item.id, 'articleId', e.target.value)}>
                            <option value="">Choisir...</option>
                            {articles.map(a => <option key={a.id} value={a.id} disabled={a.currentStock <= 0}>{a.name} ({a.currentStock})</option>)}
                          </select>
                        </td>
                        <td><input type="number" className="form-control" value={item.quantity} onChange={(e) => updateItem(item.id, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value))} /></td>
                        {currentUser?.role !== 'vendeur' && (
                          <>
                            <td><input type="number" className="form-control" value={item.unitPrice} onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))} /></td>
                            <td style={{ fontWeight: 600 }}>{(item.quantity * item.unitPrice).toLocaleString()}</td>
                          </>
                        )}
                        <td><button type="button" onClick={() => removeItem(item.id)} className="text-danger"><Trash2 size={18} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ flex: '1 1 300px' }}>
            <div className="content-card" style={{ position: 'sticky', top: '2rem' }}>
              <h3>Résumé</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                {currentUser?.role !== 'vendeur' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sous-total</span><span>{calculateTotal().toLocaleString()} FCFA</span></div>
                    <div className="form-group"><label className="form-label">Remise</label><input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(Number(e.target.value) || 0)} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}><strong>Total Net</strong><strong style={{ color: 'var(--primary)', fontSize: '1.5rem' }}>{(calculateTotal() - discount).toLocaleString()} FCFA</strong></div>
                  </>
                )}
                
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <label className="form-label">Mode</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button type="button" className={`btn ${paymentType === 'complet' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setPaymentType('complet')}>Complet</button>
                    <button type="button" className={`btn ${paymentType === 'credit' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setPaymentType('credit')}>Consommation</button>
                  </div>
                  {currentUser?.role !== 'vendeur' && (
                    <div className="form-group"><label className="form-label">Versement</label><input type="number" className="form-control" value={initialPayment} onChange={(e) => setInitialPayment(Number(e.target.value) || 0)} disabled={paymentType === 'credit'} /></div>
                  )}
                </div>
                <button type="submit" className="btn btn-primary btn-lg" disabled={isSubmitting || saleItems.length === 0}>{isSubmitting ? '...' : 'Valider la vente'}</button>
              </div>
            </div>
          </div>
        </div>
      </form>
      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
