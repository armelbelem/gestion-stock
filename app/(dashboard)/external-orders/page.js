'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, CheckCircle, XCircle, Clock, Trash2, Search, X, PackageOpen, ListPlus, Printer } from 'lucide-react';
import AlertModal from '../../components/AlertModal';

export default function ExternalOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [formData, setFormData] = useState({ 
    clientId: '', supplierId: '', items: [{ description: '', quantity: 1, price: '' }]
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [oData, cData, sData] = await Promise.all([
        storage.get('external-orders'),
        storage.get('clients'),
        storage.get('fournisseurs')
      ]);
      setOrders(oData);
      setClients(cData);
      setSuppliers(sData);
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const handleOpenModal = () => {
    setFormData({ clientId: '', supplierId: '', items: [{ description: '', quantity: 1, price: '' }] });
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, price: '' }]
    });
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    if (field === 'quantity') value = parseInt(value) || 1;
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        items: formData.items.map(item => ({
          ...item,
          purchasePrice: item.price,
          sellPrice: item.price
        }))
      };
      await storage.create('external-orders', payload);
      showAlert('success', 'Succès', "Commande externe créée avec succès !");
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      showAlert('error', 'Erreur', error.message || "Erreur lors de la création");
    }
  };

  const handleAction = (id, action) => {
    if (action === 'vendre') {
      showConfirm(
        "Validation de la vente",
        "Confirmez-vous la réception et la vente de TOUS les produits de cette commande ? (Cela générera une facture de vente).",
        async () => {
          closeAlert();
          try {
            await fetch(`/api/external-orders/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
              body: JSON.stringify({ action: 'vendre' })
            });
            showAlert('success', 'Succès', "La commande a été réceptionnée et vendue au client !");
            loadData();
          } catch (e) { showAlert('error', 'Erreur', e.message); }
        }
      );
    } else if (action === 'annuler') {
      showConfirm("Annuler la commande", "Voulez-vous annuler cette commande ?", async () => {
        closeAlert();
        try {
          await fetch(`/api/external-orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }, body: JSON.stringify({ action: 'annuler' }) });
          showAlert('success', 'Succès', "La commande est annulée.");
          loadData();
        } catch (e) { showAlert('error', 'Erreur', e.message); }
      });
    } else if (action === 'delete') {
      showConfirm("Supprimer la commande", "Voulez-vous supprimer définitivement cet enregistrement ?", async () => {
        closeAlert();
        try {
          await storage.remove('external-orders', id);
          showAlert('success', 'Succès', "Commande supprimée !");
          loadData();
        } catch (e) { showAlert('error', 'Erreur', e.message); }
      });
    }
  };

  const handlePrint = (order) => {
    setPrintData(order);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintData(null);
    }, 500);
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'en_attente': return <span className="badge badge-warning"><Clock size={12} style={{marginRight:4}}/> En attente</span>;
      case 'termine': return <span className="badge badge-success"><CheckCircle size={12} style={{marginRight:4}}/> Livré & Vendu</span>;
      case 'annule': return <span className="badge badge-danger"><XCircle size={12} style={{marginRight:4}}/> Annulé</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => 
    (o.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (o.items && o.items.some(i => i.description.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  if (isPrinting && printData) {
    const totalVente = printData.items ? printData.items.reduce((sum, item) => sum + (item.quantity * item.sellPrice), 0) : 0;
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '22px', fontWeight: '800' }}>MINING AUTOLOG</h1>
          <p>BON DE COMMANDE FOURNISSEUR #{printData.id.substring(0, 8).toUpperCase()}</p>
          <p>Date : {new Date(printData.date).toLocaleDateString('fr-FR')}</p>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <p><strong>Fournisseur :</strong> {printData.supplierName}</p>
          <p><strong>Référence Client :</strong> {printData.clientName}</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Description du produit</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Qté</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>P.U</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {printData.items && printData.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{item.description}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{Number(item.sellPrice).toLocaleString()} FCFA</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{(item.quantity * item.sellPrice).toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', padding: '8px' }}>MONTANT TOTAL</td>
              <td style={{ textAlign: 'right', padding: '8px' }}>{totalVente.toLocaleString()} FCFA</td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: '50px', display: 'flex', justifyContent: 'space-between' }}>
          <div><strong>Signature Direction :</strong></div>
          <div><strong>Signature Fournisseur :</strong></div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Commandes Externes</h1>
          <p>Gérez les pièces hors-catalogue commandées spécifiquement pour des clients</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <Plus size={16} /> Nouvelle Commande Externe
        </button>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div className="form-group" style={{ margin: 0, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-control" 
            placeholder="Rechercher par description ou client..." 
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
                <th>Date</th>
                <th>Client</th>
                <th>Fournisseur</th>
                <th>Produits demandés</th>
                <th>Montant Total</th>
                <th>Statut</th>
                <th style={{ width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Aucune commande trouvée.</td></tr>
              ) : (
                filteredOrders.map(order => {
                  const totalAchat = order.items ? order.items.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0) : 0;
                  const totalVente = order.items ? order.items.reduce((sum, item) => sum + (item.quantity * item.sellPrice), 0) : 0;
                  
                  return (
                    <tr key={order.id}>
                      <td>{new Date(order.date).toLocaleDateString()}</td>
                      <td style={{fontWeight:500}}>{order.clientName || '-'}</td>
                      <td>{order.supplierName || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          {order.items && order.items.map(item => (
                            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                              <PackageOpen size={14} className="text-muted" />
                              <span>{item.quantity}x {item.description}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{display:'flex', flexDirection:'column', fontSize:'0.9rem'}}>
                          <span style={{fontWeight:600}}>{totalVente} FCFA</span>
                        </div>
                      </td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td>
                        {order.status === 'en_attente' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-success" title="Réceptionner et Vendre" onClick={() => handleAction(order.id, 'vendre')}><CheckCircle size={16} /></button>
                            <button className="btn btn-secondary" title="Imprimer le bon de commande" onClick={() => handlePrint(order)}><Printer size={16} /></button>
                            <button className="btn btn-warning" title="Annuler" onClick={() => handleAction(order.id, 'annuler')}><XCircle size={16} /></button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-secondary" title="Imprimer le reçu" onClick={() => handlePrint(order)}><Printer size={16} /></button>
                            <button className="btn btn-danger-outline" title="Supprimer l'historique" onClick={() => handleAction(order.id, 'delete')}><Trash2 size={16} /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '800px', width: '90%'}}>
            <div className="modal-header">
              <h3>Nouvelle Commande Externe</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Client cible</label>
                    <select className="form-control" required value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                      <option value="">Sélectionner...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fournisseur</label>
                    <select className="form-control" required value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value})}>
                      <option value="">Sélectionner...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0 }}>Produits commandés</h4>
                  <button type="button" className="btn btn-secondary" onClick={handleAddItem} style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}>
                    <ListPlus size={16} /> Ajouter un produit
                  </button>
                </div>

                {formData.items.map((item, index) => (
                  <div key={index} style={{ background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', position: 'relative', border: '1px solid var(--border-color)' }}>
                    {formData.items.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(index)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                        <X size={18} />
                      </button>
                    )}
                    
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Description du produit (Texte libre) #{index + 1}</label>
                      <input type="text" className="form-control" required placeholder="Ex: Filtre à Huile Caterpillar XYZ" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} style={{ paddingRight: '2rem' }} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Quantité</label>
                        <input type="number" className="form-control" required min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Prix du produit (Fournisseur)</label>
                        <input type="number" className="form-control" required min="0" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}

                <div className="alert alert-info" style={{marginTop: '1.5rem', padding: '1rem', backgroundColor: 'rgba(0,102,255,0.1)', borderRadius: '8px'}}>
                  <p style={{margin:0, fontSize: '0.9rem', color: 'var(--text-muted)'}}>
                    <strong>Note:</strong> Ces produits ne seront <strong>pas</strong> ajoutés au catalogue d'articles. Lors de la réception, une facture globale de vente sera générée.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Créer la commande</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
