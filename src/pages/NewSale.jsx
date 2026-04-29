import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Plus, Trash2, CheckCircle, ArrowLeft, Search, User, CreditCard, ShoppingCart, Printer, ScanBarcode } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';

const NewSale = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [clients, setClients] = useState([]);
  const [articles, setArticles] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [saleItems, setSaleItems] = useState([]); // [{id: Math.random().toString(36).substr(2, 9), articleId: '', quantity: 1, unitPrice: 0, maxStock: 0}]
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentType, setPaymentType] = useState('complet');
  const [initialPayment, setInitialPayment] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [dueDate, setDueDate] = useState('');

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  const handleReset = () => {
    if (saleItems.length > 0) {
      showConfirm(
        'Abandonner la vente ?',
        'Votre panier contient des articles. Voulez-vous vraiment annuler cette vente et recommencer ?',
        () => {
          setSaleItems([]);
          setSelectedClientId('');
          setInitialPayment(0);
          setDiscount(0);
          closeAlert();
        }
      );
    } else {
      setSaleItems([]);
      setSelectedClientId('');
      setInitialPayment(0);
      setDiscount(0);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [clientsData, articlesData] = await Promise.all([
      storage.get('clients'),
      storage.get('articles')
    ]);
    setClients(clientsData);
    setArticles(articlesData);
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

        // If article changes, update price and maxStock
        if (field === 'articleId') {
          const article = articles.find(a => a.id === value);
          if (article) {
            newItem.unitPrice = article.price;
            newItem.maxStock = article.currentStock;
          }
        }

        // Alerte Stock Faible Proactive lors de la modification de quantité
        if (field === 'quantity') {
          const article = articles.find(a => a.id === item.articleId);
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
    }
  }, [saleItems, paymentType, discount]);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleBarcodeScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = barcodeInput.trim();
      if (!code) return;

      const article = articles.find(a => a.barcode === code);
      if (article) {
        if (article.currentStock <= 0) {
          showAlert('error', 'Erreur', `Stock épuisé pour ${article.name}`);
          setBarcodeInput('');
          return;
        }

        const existingItem = saleItems.find(item => item.articleId === article.id);
        if (existingItem) {
          if (existingItem.quantity < article.currentStock) {
            updateItem(existingItem.id, 'quantity', existingItem.quantity + 1);
            showAlert('success', 'Succès', `Quantité augmentée pour ${article.name}`);
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
          
          // Alerte Stock Faible Proactive
          const remainingStockAfter = article.currentStock - 1;
          if (remainingStockAfter <= article.minStock) {
            showAlert('info', 'Stock Faible', `Attention : Suite à cet ajout, le stock de "${article.name}" sera au niveau critique (${remainingStockAfter} restant).`);
          } else {
            showAlert('success', 'Succès', `${article.name} ajouté au panier`);
          }
        }
        setBarcodeInput('');
      } else {
        showAlert('error', 'Erreur', "Code-barres inconnu");
        setBarcodeInput('');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedClientId) {
      showAlert('error', 'Erreur', "Veuillez sélectionner un client");
      return;
    }

    const selectedStore = localStorage.getItem('selectedStore');
    const isAdmin = currentUser?.role === 'admin';
    
    // Si c'est un admin et qu'il est en vue globale, on bloque
    if (isAdmin && (!selectedStore || selectedStore === 'all')) {
      showAlert('error', 'Action impossible', "En tant qu'administrateur, vous devez sélectionner un magasin spécifique (ex: Houndé ou Manda) en haut de l'écran avant d'effectuer une vente.");
      return;
    }

    // Le storeId final à envoyer
    const storeId = isAdmin ? selectedStore : currentUser?.storeId;

    if (saleItems.length === 0) {
      showAlert('error', 'Erreur', "Veuillez ajouter au moins un article");
      return;
    }

    const totalAmount = saleItems.reduce((total, item) => total + (item.unitPrice * item.quantity), 0);
    const client = clients.find(c => c.id === selectedClientId);

    // Validation
    const invalidItem = saleItems.find(item => !item.articleId || item.quantity <= 0 || item.quantity > item.maxStock || item.unitPrice < 0);
    if (invalidItem) {
      if (!invalidItem.articleId) showAlert('error', 'Erreur', "Un article n'a pas été sélectionné");
      else if (invalidItem.quantity <= 0) showAlert('error', 'Erreur', "La quantité doit être supérieure à 0");
      else if (invalidItem.unitPrice < 0) showAlert('error', 'Erreur', "Le prix unitaire ne peut pas être négatif");
      else showAlert('error', 'Erreur', `Stock insuffisant pour certains articles`);
      return;
    }

    if (Number(discount) < 0) {
      showAlert('error', 'Erreur', "La remise ne peut pas être négative");
      return;
    }

    if (Number(initialPayment) < 0) {
      showAlert('error', 'Erreur', "Le montant versé ne peut pas être négatif");
      return;
    }

    if (Number(discount) > totalAmount) {
      showAlert('error', 'Erreur', "La remise ne peut pas dépasser le montant total");
      return;
    }

    const finalAmount = totalAmount - Number(discount);

    // Confirmation avant validation
    showConfirm(
      'Confirmer la vente ?',
      `Voulez-vous enregistrer cette vente de ${finalAmount.toLocaleString('fr-FR')} FCFA pour ${client ? client.name : 'le client'} ?`,
      async () => {
        closeAlert();
        setIsSubmitting(true);
        try {
          const newSale = await storage.create('sales', {
            clientId: selectedClientId,
            items: saleItems.map(item => ({
              articleId: item.articleId,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            })),
            date: new Date().toISOString(),
            paymentType,
            amountPaid: Number(initialPayment),
            dueDate: paymentType === 'credit' ? dueDate : null,
            discount: Number(discount),
            storeId: storeId
          });

          const itemsWithNames = saleItems.map(si => {
            const article = articles.find(a => a.id === si.articleId);
            return { ...si, articleName: article ? article.name : 'Article inconnu' };
          });

          setSuccessData({
            ...newSale,
            clientName: client ? client.name : 'Client inconnu',
            clientPhone: client ? client.phone : '',
            items: itemsWithNames
          });

          showAlert('success', 'Succès', "Vente effectuée avec succès !");
        } catch (error) {
          console.error("Error creating sale:", error);
          showAlert('error', 'Erreur', `Erreur : ${error.message}`);
          setIsSubmitting(false);
        }
      }
    );
  };

  const handlePrint = () => {
    window.print();
  };

  if (successData) {
    return (
      <div className="page" style={{ maxWidth: '600px', textAlign: 'center', padding: '4rem 1rem' }}>
        <div className="content-card">
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: 'var(--success)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem'
            }}>
              <CheckCircle size={48} />
            </div>
            <h1 style={{ marginBottom: '0.5rem' }}>Vente réussie !</h1>
            <p className="text-muted">La transaction a été enregistrée et le stock a été mis à jour.</p>
          </div>

          <div style={{ padding: '1.5rem', backgroundColor: 'var(--bg-color)', borderRadius: '8px', marginBottom: '2rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="text-muted">Référence</span>
              <span style={{ fontWeight: 600 }}>#{successData.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span className="text-muted">Client</span>
              <span>{successData.clientName}</span>
            </div>
            {Number(successData.discount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="text-muted">Remise</span>
                <span style={{ color: 'var(--danger)' }}>-{Number(successData.discount).toLocaleString('fr-FR')} FCFA</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
              <span style={{ fontWeight: 600 }}>Total Net</span>
              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.2rem' }}>{Number(successData.totalAmount).toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button onClick={handlePrint} className="btn btn-primary">
              <Printer size={18} /> Imprimer le reçu
            </button>
            <button onClick={() => navigate('/sales')} className="btn btn-secondary">
              Voir historique
            </button>
            <button onClick={() => window.location.reload()} className="btn btn-secondary">
              Nouvelle vente
            </button>
          </div>
        </div>

        {/* Hidden printable receipt */}
        <div className="receipt-print-only" style={{ textAlign: 'left' }}>
          <div className="receipt-header" style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
            <h1 style={{ color: 'black', margin: '0', fontSize: '22px', textTransform: 'uppercase', fontWeight: '800' }}>GESTION DE STOCK</h1>
            <div style={{ margin: '10px 0' }}>
              <p style={{ margin: '2px 0', fontSize: '15px' }}><strong>Entreprise :</strong> VOTRE BOUTIQUE</p>
              <p style={{ margin: '2px 0', fontSize: '13px' }}><strong>Adresse :</strong> ******</p>
              <p style={{ margin: '2px 0', fontSize: '13px' }}><strong>Contact :</strong> ******</p>
            </div>
            <div style={{ borderTop: '1px dashed #000', marginTop: '10px', paddingTop: '10px' }}>
              <p style={{ margin: '0', fontWeight: 'bold', color: 'black' }}>REÇU DE VENTE #{successData.id.substring(0, 8).toUpperCase()}</p>
              <p style={{ margin: '0', fontSize: '13px' }}>Date : {formatDate(successData.date)}</p>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ margin: '0.25rem 0' }}><strong>Client :</strong> {successData.clientName}</p>
            {successData.clientPhone && <p style={{ margin: '0.25rem 0' }}><strong>Tél Client :</strong> {successData.clientPhone}</p>}
            <p style={{ margin: '0.25rem 0' }}><strong>Vendeur :</strong> {currentUser?.username || 'Inconnu'}</p>
          </div>

          <table style={{ border: 'none', marginBottom: '2rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid black' }}>
                <th style={{ color: 'black' }}>Article</th>
                <th style={{ color: 'black' }}>Qté</th>
                <th style={{ color: 'black' }}>Prix Unitaire</th>
                <th style={{ color: 'black' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {successData.items.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.articleName}</td>
                  <td>{item.quantity}</td>
                  <td>{Number(item.unitPrice).toLocaleString('fr-FR')} FCFA</td>
                  <td style={{ textAlign: 'right' }}>
                    {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid black' }}>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: '1rem' }}>Sous-total</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', paddingTop: '1rem' }}>
                  {(Number(successData.totalAmount) + Number(successData.discount)).toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
              {Number(successData.discount) > 0 && (
                <tr style={{ color: 'black' }}>
                  <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Remise</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    -{Number(successData.discount).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              )}
              <tr style={{ borderTop: '1px solid black' }}>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Total Net</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.2rem' }}>
                  {Number(successData.totalAmount).toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
              <tr>
                <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Montant Versé</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  {Number(successData.amountPaid).toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
              {successData.totalAmount - successData.amountPaid > 0 && (
                <tr style={{ color: 'black' }}>
                  <td colSpan="3" style={{ textAlign: 'right', fontWeight: 'bold' }}>Reste à Payer</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', borderTop: '1px solid black' }}>
                    {(Number(successData.totalAmount) - Number(successData.amountPaid)).toLocaleString('fr-FR')} FCFA
                  </td>
                </tr>
              )}
            </tfoot>
          </table>

          <div className="receipt-footer">
            <p>Merci de votre confiance !</p>

          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            <Link to="/sales" style={{ display: 'flex', alignItems: 'center', color: 'inherit' }}>
              <ArrowLeft size={16} /> Retour aux ventes
            </Link>
          </div>
          <h1>Nouvelle Vente</h1>
          <p>Enregistrez une nouvelle transaction</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="row" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Main Form */}
          <div style={{ flex: '1 1 600px' }}>
            <div className="content-card" style={{ marginBottom: '2rem' }}>
              <div className="card-header" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ScanBarcode size={20} className="text-success" /> Saisie Rapide (Lecteur)
                </h3>
              </div>
              <div className="form-group" style={{ position: 'relative' }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Scannez un code-barres ici..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                  autoFocus
                  style={{
                    border: '2px solid var(--success)',
                    padding: '1rem 1rem 1rem 3rem',
                    fontSize: '1.1rem'
                  }}
                />
                <ScanBarcode
                  size={24}
                  style={{
                    position: 'absolute',
                    left: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--success)'
                  }}
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                L'article sera automatiquement ajouté au panier après le scan.
              </p>
            </div>

            <div className="content-card" style={{ marginBottom: '2rem' }}>
              <div className="card-header" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={20} className="text-primary" /> Sélection du Client
                </h3>
              </div>
              <div className="form-group">
                <label className="form-label">Client</label>
                <select
                  className="form-control"
                  required
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">-- Sélectionner un client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ''}</option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p style={{ fontSize: '0.8rem', mt: 1, color: 'var(--danger)' }}>
                    Aucun client disponible. <Link to="/clients">Créer un client</Link>
                  </p>
                )}
              </div>
            </div>

            <div className="content-card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <ShoppingCart size={20} className="text-primary" /> Articles à vendre
                </h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                  <Plus size={14} /> Ajouter un article
                </button>
              </div>

              <div className="table-wrapper">
                <table style={{ border: 'none' }}>
                  <thead>
                    <tr>
                      <th>Article</th>
                      <th style={{ width: '120px' }}>Quantité</th>
                      <th style={{ width: '150px' }}>Prix Unitaire</th>
                      <th style={{ width: '150px' }}>Sous-total</th>
                      <th style={{ width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {saleItems.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                          Cliquez sur "Ajouter un article" pour commencer
                        </td>
                      </tr>
                    ) : (
                      saleItems.map((item) => {
                        const subtotal = item.quantity * item.unitPrice;
                        return (
                          <tr key={item.id}>
                            <td>
                              <select
                                className="form-control"
                                value={item.articleId}
                                onChange={(e) => updateItem(item.id, 'articleId', e.target.value)}
                                style={{ border: '1px solid var(--border-color)' }}
                              >
                                <option value="">Choisir...</option>
                                {articles.map(a => (
                                  <option key={a.id} value={a.id} disabled={a.currentStock <= 0}>
                                    {a.name} (Stock: {a.currentStock})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                min="1"
                                max={item.maxStock}
                                value={item.quantity}
                                onChange={(e) => updateItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                                style={{ border: '1px solid var(--border-color)' }}
                              />
                              {item.articleId && item.quantity > item.maxStock && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--danger)' }}>Max: {item.maxStock}</span>
                              )}
                            </td>
                            <td>
                              <div style={{ position: 'relative' }}>
                                <input
                                  type="number"
                                  className="form-control"
                                  min="0"
                                  step="0.01"
                                  value={item.unitPrice}
                                  onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                                  style={{ border: '1px solid var(--border-color)' }}
                                />
                              </div>
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {subtotal.toLocaleString('fr-FR')} FCFA
                            </td>
                            <td>
                              <button
                                type="button"
                                className="text-danger"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                onClick={() => removeItem(item.id)}
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Checkout Info */}
          <div style={{ flex: '1 1 300px' }}>
            <div className="content-card" style={{ position: 'sticky', top: '2rem' }}>
              <div className="card-header" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CreditCard size={20} className="text-primary" /> Résumé
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-color)' }}>
                  <span className="text-muted">Nombre d'articles</span>
                  <span style={{ fontWeight: 500 }}>{saleItems.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
                  <span className="text-muted">Sous-total</span>
                  <span style={{ fontWeight: 600 }}>{calculateTotal().toLocaleString('fr-FR')} FCFA</span>
                </div>
                <div className="form-group" style={{ marginTop: '0.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Remise (FCFA)</label>
                  <input
                    type="number"
                    className="form-control"
                    min="0"
                    placeholder="Montant remise"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Total Net</span>
                </div>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: 'var(--primary)',
                  textAlign: 'right',
                  marginBottom: '1rem'
                }}>
                  {(calculateTotal() - discount).toLocaleString('fr-FR')} <span style={{ fontSize: '1rem' }}>FCFA</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <label className="form-label">Mode de Paiement</label>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      className={`btn ${paymentType === 'complet' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '0.5rem' }}
                      onClick={() => setPaymentType('complet')}
                    >
                      Complet
                    </button>
                    <button
                      type="button"
                      className={`btn ${paymentType === 'credit' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, padding: '0.5rem' }}
                      onClick={() => setPaymentType('credit')}
                    >
                      Crédit
                    </button>
                  </div>

                  <div className="form-group">
                    <label className="form-label">{paymentType === 'complet' ? 'Montant Payé' : 'Avance versée'}</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      value={initialPayment}
                      onChange={(e) => setInitialPayment(parseFloat(e.target.value) || 0)}
                      max={calculateTotal()}
                      disabled={paymentType === 'complet'}
                    />
                  </div>

                  {paymentType === 'credit' && (
                    <div className="form-group">
                      <label className="form-label">Date d'échéance</label>
                      <input
                        type="date"
                        className="form-control"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  {paymentType === 'credit' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', backgroundColor: 'var(--bg-light)', borderRadius: '4px', marginTop: '0.5rem' }}>
                      <span className="text-muted">Reste à payer</span>
                      <span style={{ fontWeight: 600, color: 'var(--danger)' }}>
                        {(calculateTotal() - discount - initialPayment).toLocaleString('fr-FR')} FCFA
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}
                  disabled={isSubmitting || saleItems.length === 0}
                >
                  {isSubmitting ? 'Traitement...' : 'Valider la vente'}
                </button>
                <Link to="/sales" className="btn btn-secondary" style={{ textAlign: 'center' }}>
                  Annuler
                </Link>
              </div>
            </div>
          </div>
        </div>
      </form>

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

export default NewSale;
