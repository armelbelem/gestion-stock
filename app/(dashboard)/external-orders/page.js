'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, CheckCircle, XCircle, Clock, Trash2, Search, X, PackageOpen, ListPlus, Printer, Truck, AlertCircle, Download } from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { exportToExcel } from '../../utils/excelExport';
import { useAuth } from '../../providers';

export default function ExternalOrdersPage() {
  const { user: currentUser } = useAuth();
  
  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [formData, setFormData] = useState({ 
    clientId: '', supplierId: '', items: [{ description: '', quantity: 1, purchasePrice: '', sellPrice: '' }]
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateRange({
      start: firstDay.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    });
  }, []);
  
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  const [hasActiveYear, setHasActiveYear] = useState(true);

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      loadData();
    }
  }, [dateRange]);

  const loadData = async () => {
    try {
      const [oData, cData, sData, fyData, stData] = await Promise.all([
        storage.get(`external-orders?storeId=all&startDate=${dateRange.start}&endDate=${dateRange.end}`),
        storage.get('clients'),
        storage.get('fournisseurs'),
        storage.get('fiscal-years'),
        storage.get('settings')
      ]);
      setOrders(oData);
      setClients(cData);
      setSuppliers(sData);
      setSettings(stData);
      setHasActiveYear(fyData.some(f => f.status === 'active'));
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const handleExport = () => {
    const exportData = [];
    filteredOrders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          exportData.push({
            date: new Date(order.date).toLocaleDateString(),
            client: order.clientName,
            fournisseur: order.supplierName,
            article: item.description,
            quantite: item.quantity,
            prixAchat: item.purchasePrice,
            prixVente: item.sellPrice,
            benefice: (item.sellPrice - item.purchasePrice) * item.quantity,
            statut: order.status === 'termine' ? 'Livré & Vendu' : (order.status === 'annule' ? 'Annulé' : 'En attente')
          });
        });
      }
    });

    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'client', label: 'Client' },
      { key: 'fournisseur', label: 'Fournisseur' },
      { key: 'article', label: 'Article' },
      { key: 'quantite', label: 'Qté' },
      { key: 'prixAchat', label: 'Prix Achat' },
      { key: 'prixVente', label: 'Prix Vente' },
      { key: 'benefice', label: 'Bénéfice' },
      { key: 'statut', label: 'Statut' }
    ];

    exportToExcel(exportData, headers, `commandes_speciales_${new Date().toISOString().split('T')[0]}`);
  };

  const handleOpenModal = () => {
    setFormData({ clientId: '', supplierId: '', items: [{ description: '', quantity: 1, purchasePrice: '', sellPrice: '' }] });
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, purchasePrice: '', sellPrice: '' }]
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
    if (field === 'purchasePrice' || field === 'sellPrice') value = parseFloat(value) || 0;
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasActiveYear) return showAlert('error', 'Action bloquée', "Aucun exercice fiscal n'est ouvert. Veuillez ouvrir un exercice dans les réglages avant de créer une commande spéciale.");
    try {
      await storage.create('external-orders', { ...formData, storeId: null });
      showAlert('success', 'Succès', "Commande spéciale créée avec succès dans le Magasin Global !");
      await loadData();
      setIsModalOpen(false);
    } catch (error) {
      showAlert('error', 'Erreur', error.message || "Erreur lors de la création");
    }
  };

  const handleAction = (id, action) => {
      if (action === 'vendre') {
        if (!hasActiveYear) return showAlert('error', 'Action bloquée', "Aucun exercice fiscal n'est ouvert. Veuillez ouvrir un exercice avant de valider cette vente.");
        showConfirm(
          "Validation de la réception",
          "Confirmez-vous la réception et la livraison de cette commande ? (Le bénéfice sera enregistré uniquement dans ce module spécial).",
          async () => {
          closeAlert();
          try {
            const res = await fetch(`/api/external-orders/${id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
              body: JSON.stringify({ action: 'vendre' })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
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

  const handlePrintSummary = () => {
    setIsPrintingSummary(true);
    setTimeout(() => {
      window.print();
      setIsPrintingSummary(false);
    }, 500);
  };

  const setQuickPeriod = (period) => {
    const end = new Date();
    const start = new Date();
    if (period === 'week') {
      start.setDate(end.getDate() - 7);
    } else if (period === 'month') {
      start.setDate(1);
    } else if (period === 'last30') {
      start.setDate(end.getDate() - 30);
    }
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'en_attente': return <span className="badge badge-warning"><Clock size={12} style={{marginRight:4}}/> En attente</span>;
      case 'termine': return <span className="badge badge-success"><CheckCircle size={12} style={{marginRight:4}}/> Livré & Vendu</span>;
      case 'annule': return <span className="badge badge-danger"><XCircle size={12} style={{marginRight:4}}/> Annulé</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => {
    return (o.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.items && o.items.some(i => i.description.toLowerCase().includes(searchTerm.toLowerCase())));
  });

  if (isPrinting && printData) {
    const totalVente = printData.items ? printData.items.reduce((sum, item) => sum + (item.quantity * item.sellPrice), 0) : 0;
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          {settings?.logo ? (
            <img src={settings.logo} alt="Logo" style={{ maxHeight: '80px', marginBottom: '10px' }} />
          ) : (
            <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'NS AUTOFLOW'}</h1>
          )}
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          {settings?.phone && <p style={{ margin: '2px 0' }}>Tél : {settings.phone}</p>}
          {(settings?.nif || settings?.rccm) && (
            <p style={{ fontSize: '0.8rem', margin: '2px 0' }}>
              {settings?.nif && `NIF: ${settings.nif}`} {settings?.rccm && `| RCCM: ${settings.rccm}`}
            </p>
          )}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ccc' }}>
            <h2 style={{ margin: '0', fontSize: '18px' }}>BON DE COMMANDE SPÉCIALE #{printData.id.substring(0, 8).toUpperCase()}</h2>
            <p style={{ margin: '5px 0' }}>Date : {new Date(printData.date).toLocaleDateString('fr-FR')}</p>
          </div>
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
              <th style={{ textAlign: 'right', padding: '8px' }}>P.U Vente</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {printData.items && printData.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{item.description}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{formatPrice(item.sellPrice)} FCFA</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{formatPrice(item.quantity * item.sellPrice)} FCFA</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', padding: '8px' }}>MONTANT TOTAL À PAYER</td>
              <td style={{ textAlign: 'right', padding: '8px' }}>{formatPrice(totalVente)} FCFA</td>
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

  if (isPrintingSummary) {
    const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity * i.sellPrice), 0) : 0), 0);
    const totalCost = filteredOrders.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity * i.purchasePrice), 0) : 0), 0);
    const totalProfit = totalRevenue - totalCost;

    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '30px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid black', paddingBottom: '15px' }}>
          {settings?.logo ? (
            <img src={settings.logo} alt="Logo" style={{ maxHeight: '80px', marginBottom: '10px' }} />
          ) : (
            <h1 style={{ margin: '0', fontSize: '26px', fontWeight: '800' }}>{settings?.companyName || 'MINING AUTOLOG'}</h1>
          )}
          <h2 style={{ margin: '10px 0 0 0', fontSize: '18px' }}>BILAN DES COMMANDES SPÉCIALES</h2>
          <p style={{ margin: '5px 0' }}>
            {dateRange.start || dateRange.end 
              ? `Période : ${dateRange.start ? new Date(dateRange.start).toLocaleDateString() : 'Début'} au ${dateRange.end ? new Date(dateRange.end).toLocaleDateString() : 'Fin'}`
              : 'Période : Historique Complet'}
          </p>
          <p>Édité le : {new Date().toLocaleDateString('fr-FR')} à {new Date().toLocaleTimeString('fr-FR')}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px', backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>CHIFFRE D'AFFAIRES</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatPrice(totalRevenue)} FCFA</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>TOTAL ACHATS</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatPrice(totalCost)} FCFA</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>BÉNÉFICE NET</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'green' }}>{formatPrice(totalProfit)} FCFA</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ backgroundColor: '#eee', borderBottom: '2px solid black' }}>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>DATE</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>CLIENT / FOURNISSEUR</th>
              <th style={{ textAlign: 'left', padding: '10px', fontSize: '12px' }}>DÉTAILS PRODUITS</th>
              <th style={{ textAlign: 'right', padding: '10px', fontSize: '12px' }}>VENTE</th>
              <th style={{ textAlign: 'right', padding: '10px', fontSize: '12px' }}>MARGE</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order, idx) => {
              const orderRevenue = order.items ? order.items.reduce((s, i) => s + (i.quantity * i.sellPrice), 0) : 0;
              const orderCost = order.items ? order.items.reduce((s, i) => s + (i.quantity * i.purchasePrice), 0) : 0;
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px', fontSize: '11px' }}>{new Date(order.date).toLocaleDateString()}</td>
                  <td style={{ padding: '10px', fontSize: '11px' }}>
                    <strong>{order.clientName}</strong><br/>
                    <small>F: {order.supplierName}</small>
                  </td>
                  <td style={{ padding: '10px', fontSize: '11px' }}>
                    {order.items?.map((it, iindex) => (
                      <div key={iindex}>{it.quantity}x {it.description}</div>
                    ))}
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px', fontSize: '11px' }}>{formatPrice(orderRevenue)}</td>
                  <td style={{ textAlign: 'right', padding: '10px', fontSize: '11px', fontWeight: 'bold', color: 'green' }}>+{formatPrice(orderRevenue - orderCost)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: '100px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ borderBottom: '1px solid black', marginBottom: '10px' }}>Signature Direction</div>
          </div>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <div style={{ borderBottom: '1px solid black', marginBottom: '10px' }}>Cachet de l'Entreprise</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1>Commandes Spéciales (Achat-Revente)</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem', verticalAlign: 'middle' }}>VUE GLOBALE</span>
          </div>
          <p>Gérez les produits hors-catalogue achetés pour vos clients et suivez vos marges</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrintSummary} disabled={filteredOrders.length === 0}>
            <Printer size={16} /> Bilan PDF
          </button>
          <button className="btn btn-secondary" onClick={handleExport} disabled={filteredOrders.length === 0}>
            <Download size={16} /> Exporter
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleOpenModal}
          >
            <Plus size={16} /> Nouvelle Commande Spéciale
          </button>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">
            {formatPrice(filteredOrders.filter(o => o.status === 'termine').reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity * i.sellPrice), 0) : 0), 0))} FCFA
          </div>
          <div className="stat-label">Ventes Totales (Réalisées)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger)' }}>
            {formatPrice(filteredOrders.filter(o => o.status === 'termine').reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity * i.purchasePrice), 0) : 0), 0))} FCFA
          </div>
          <div className="stat-label">Total Achats (Effectués)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            {formatPrice(filteredOrders.filter(o => o.status === 'termine').reduce((sum, o) => {
              const totalAchat = o.items ? o.items.reduce((s, i) => s + (i.quantity * i.purchasePrice), 0) : 0;
              const totalVente = o.items ? o.items.reduce((s, i) => s + (i.quantity * i.sellPrice), 0) : 0;
              return sum + (totalVente - totalAchat);
            }, 0))} FCFA
          </div>
          <div className="stat-label">Bénéfice Net Réalisé</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {filteredOrders.filter(o => o.status === 'en_attente').length}
          </div>
          <div className="stat-label">Commandes en attente</div>
        </div>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0, position: 'relative', flex: '1 1 300px' }}>
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
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('week')}>Semaine</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('month')}>Mois</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickPeriod('last30')}>30 j</button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="date" className="form-control" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
            <span className="text-muted">au</span>
            <input type="date" className="form-control" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
            {(dateRange.start || dateRange.end) && (
              <button className="btn btn-secondary" onClick={() => setDateRange({start:'', end:''})}><X size={16} /></button>
            )}
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Client / Fournisseur</th>
                <th>Produits & Détails Prix</th>
                <th>Montant Total</th>
                <th>Bénéfice (Marge)</th>
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
                  const profit = totalVente - totalAchat;
                  
                  return (
                    <tr key={order.id}>
                      <td>{new Date(order.date).toLocaleDateString()}</td>
                      <td>
                        <div style={{fontWeight:600}}>{order.clientName || '-'}</div>
                        <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}><Truck size={12} /> {order.supplierName || '-'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {order.items && order.items.map(item => (
                            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem', padding: '4px 0', borderBottom: '1px dashed var(--border-color)' }}>
                              <div style={{fontWeight:500}}>{item.quantity}x {item.description}</div>
                              <div style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>
                                Achat: {formatPrice(item.purchasePrice)} | Vente: {formatPrice(item.sellPrice)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{fontWeight:600}}>{formatPrice(totalVente)} FCFA</div>
                      </td>
                      <td>
                        <div style={{fontWeight:600, color:'var(--success)'}}>+{formatPrice(profit)} FCFA</div>
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
          <div className="modal-content" style={{maxWidth: '850px', width: '95%'}}>
            <div className="modal-header">
              <h3>Nouvelle Commande Spéciale (Produit Externe)</h3>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label">Client qui commande</label>
                    <select className="form-control" required value={formData.clientId} onChange={e => setFormData({...formData, clientId: e.target.value})}>
                      <option value="">Sélectionner un client...</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Fournisseur où acheter</label>
                    <select className="form-control" required value={formData.supplierId} onChange={e => setFormData({...formData, supplierId: e.target.value})}>
                      <option value="">Sélectionner un fournisseur...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0 }}>Détail des produits & Marges</h4>
                  <button type="button" className="btn btn-secondary" onClick={handleAddItem} style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}>
                    <ListPlus size={16} /> Ajouter un autre produit
                  </button>
                </div>

                {formData.items.map((item, index) => (
                  <div key={index} style={{ background: 'var(--bg-light)', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem', position: 'relative', border: '1px solid var(--border)' }}>
                    {formData.items.length > 1 && (
                      <button type="button" onClick={() => handleRemoveItem(index)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                        <X size={20} />
                      </button>
                    )}
                    
                    <div className="form-group" style={{ marginBottom: '1rem' }}>
                      <label className="form-label">Description précise du produit #{index + 1}</label>
                      <input type="text" className="form-control" required placeholder="Ex: Injecteur complet pour moteur Cummins QSK60" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', alignItems: 'flex-end' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Quantité</label>
                        <input type="number" className="form-control" required min="1" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Prix Achat Unit.</label>
                        <input type="number" className="form-control" required min="0" placeholder="0" value={item.purchasePrice} onChange={e => handleItemChange(index, 'purchasePrice', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Prix Vente Unit.</label>
                        <input type="number" className="form-control" required min="0" placeholder="0" value={item.sellPrice} onChange={e => handleItemChange(index, 'sellPrice', e.target.value)} />
                      </div>
                      <div style={{ padding: '10px', backgroundColor: 'var(--bg-color)', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Bénéfice estimé</div>
                        <div style={{ fontWeight: 700, color: (item.sellPrice - item.purchasePrice) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          {formatPrice((item.sellPrice - item.purchasePrice) * item.quantity)} FCFA
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="alert alert-info" style={{marginTop: '1.5rem', padding: '1.25rem', backgroundColor: 'rgba(0,102,255,0.05)', borderRadius: '12px', borderLeft: '4px solid var(--primary)'}}>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <AlertCircle size={24} className="text-primary" />
                    <div>
                      <p style={{margin:'0 0 5px 0', fontWeight: 600}}>Fonctionnement de l'Achat-Revente direct :</p>
                      <p style={{margin:0, fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                        1. Ces produits sont <strong>hors-inventaire</strong> (ils ne touchent pas à votre stock habituel).<br/>
                        2. Lors de la validation, l'opération est clôturée et le bénéfice est enregistré uniquement dans ce module (pas de mélange avec la comptabilité générale).<br/>
                        3. Vous pouvez imprimer un bon de commande spécifique pour votre fournisseur.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 2rem' }}>Enregistrer la commande</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
