'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, Trash2, Search, X, Printer, AlertCircle, Download, FileText, Edit, Eye, XOctagon } from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { exportToExcel } from '../../utils/excelExport';
import { useAuth } from '../../providers';

export default function SpecialSalesPage() {
  const { user: currentUser } = useAuth();
  
  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [sales, setSales] = useState([]);
  const [settings, setSettings] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  
  const [formData, setFormData] = useState({ 
    clientName: '', 
    notes: '', 
    date: '', 
    items: [{ ref: '', description: '', quantity: 1, purchasePrice: '', sellingPrice: '' }]
  });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [hasActiveYear, setHasActiveYear] = useState(true);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  // Load date range defaults
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setDateRange({
      start: firstDay.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0]
    });
  }, []);

  useEffect(() => {
    if (dateRange.start && dateRange.end) {
      loadData();
    }
  }, [dateRange]);

  const loadData = async () => {
    try {
      const [sData, fyData, stData] = await Promise.all([
        storage.get(`special-sales?storeId=all&startDate=${dateRange.start}&endDate=${dateRange.end}`),
        storage.get('fiscal-years'),
        storage.get('settings')
      ]);
      setSales(sData?.data || []);
      setSettings(stData);
      setHasActiveYear(fyData.some(f => f.status === 'active'));
    } catch (err) {
      console.error("Error loading data:", err);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Filtered sales
  const filteredSales = (sales || []).filter(sale => {
    const clientMatch = sale.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const notesMatch = sale.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const itemMatch = sale.items?.some(it => 
      it.ref?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      it.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return clientMatch || notesMatch || itemMatch;
  });

  // Export to Excel
  const handleExport = () => {
    const exportData = [];
    let grandTotalHT = 0;
    let grandTotalTTC = 0;
    let grandTotalMargin = 0;

    filteredSales.forEach(sale => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach(item => {
          const qty = parseInt(item.quantity) || 0;
          const pPrice = parseFloat(item.purchasePrice) || 0;
          const sPrice = parseFloat(item.sellingPrice) || 0;

          const totalHT = qty * sPrice;
          const itemMargin = (sPrice - pPrice) * qty;

          exportData.push({
            date: new Date(sale.date).toLocaleDateString(),
            client: sale.clientName || 'N/A',
            ref: item.ref || '-',
            article: item.description,
            qty: qty,
            purchasePrice: pPrice,
            sellingPrice: sPrice,
            totalHT: totalHT,
            margin: itemMargin,
            statut: sale.status === 'termine' ? 'Validé' : 'Annulé'
          });
        });
      }
      if (sale.status === 'termine') {
        grandTotalHT += parseFloat(sale.totalHT) || 0;
        grandTotalTTC += parseFloat(sale.totalTTC) || 0;
        grandTotalMargin += parseFloat(sale.margin) || 0;
      }
    });

    const headers = [
      { key: 'date', label: 'Date' },
      { key: 'client', label: 'Client' },
      { key: 'ref', label: 'Référence' },
      { key: 'article', label: 'Désignation' },
      { key: 'qty', label: 'Quantité' },
      { key: 'purchasePrice', label: 'P. Achat' },
      { key: 'sellingPrice', label: 'P. Vente' },
      { key: 'totalHT', label: 'Total HT' },
      { key: 'margin', label: 'Marge' },
      { key: 'statut', label: 'Statut' }
    ];

    const summaryRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      grandTotalHT,
      grandTotalMargin,
      ''
    ];

    exportToExcel(
      exportData, 
      headers, 
      `ventes_speciales_${new Date().toISOString().split('T')[0]}`,
      {
        title: "Rapport Ventes Spéciales",
        summary: summaryRow
      }
    );
  };

  const handleOpenModal = () => {
    setEditingSale(null);
    setFormData({
      clientName: '',
      notes: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ ref: '', description: '', quantity: 1, purchasePrice: '', sellingPrice: '' }]
    });
    setIsModalOpen(true);
  };

  const handleEditSale = (sale) => {
    setEditingSale(sale);
    setFormData({
      clientName: sale.clientName || '',
      notes: sale.notes || '',
      date: sale.date ? sale.date.split('T')[0] : '',
      items: sale.items.map(item => ({
        id: item.id,
        ref: item.ref || '',
        description: item.description,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice
      }))
    });
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { ref: '', description: '', quantity: 1, purchasePrice: '', sellingPrice: '' }]
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
    if (field === 'quantity') {
      newItems[index][field] = value === '' ? '' : (parseInt(value) || 0);
    } else if (field === 'purchasePrice' || field === 'sellingPrice') {
      newItems[index][field] = value === '' ? '' : (parseFloat(value) || 0);
    } else {
      newItems[index][field] = value;
    }
    setFormData({ ...formData, items: newItems });
  };

  const calculateFormTotals = () => {
    let ht = 0;
    let margin = 0;
    formData.items.forEach(it => {
      const q = parseInt(it.quantity) || 0;
      const pa = parseFloat(it.purchasePrice) || 0;
      const pv = parseFloat(it.sellingPrice) || 0;
      ht += q * pv;
      margin += (pv - pa) * q;
    });
    const tvaRate = settings?.tvaRate !== undefined ? settings.tvaRate : 18;
    const tvaVal = ht * (tvaRate / 100);
    const ttc = ht + tvaVal;
    return { ht, tvaVal, ttc, margin };
  };

  const { ht: formHT, tvaVal: formTVA, ttc: formTTC, margin: formMargin } = calculateFormTotals();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasActiveYear) return showAlert('error', 'Action bloquée', "Aucun exercice fiscal n'est ouvert.");

    const { clientName, items, notes, date } = formData;

    if (!clientName.trim()) {
      showAlert('warning', 'Champs requis', "Veuillez saisir le nom du client.");
      return;
    }

    const hasInvalidItem = items.some(it => 
      !it.description.trim() || 
      !it.quantity || 
      (parseInt(it.quantity) || 0) <= 0 || 
      it.purchasePrice === '' || 
      it.sellingPrice === ''
    );
    if (hasInvalidItem) {
      showAlert('warning', 'Champs requis', "Veuillez remplir correctement la désignation, quantité, P.A. et P.V. pour tous les produits.");
      return;
    }

    showConfirm(
      editingSale ? "Confirmer la modification" : "Confirmer l'enregistrement",
      "Voulez-vous enregistrer cette vente spéciale ?",
      async () => {
        closeAlert();
        try {
          if (editingSale) {
            const res = await fetch(`/api/special-sales/${editingSale.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
              },
              body: JSON.stringify({
                action: 'edit',
                clientName,
                notes,
                date,
                items
              })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            showAlert('success', 'Succès', "Vente spéciale modifiée avec succès !");
          } else {
            const res = await fetch('/api/special-sales', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
              },
              body: JSON.stringify({
                clientName,
                notes,
                date,
                items
              })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            showAlert('success', 'Succès', "Vente spéciale enregistrée avec succès !");
          }
          await loadData();
          setIsModalOpen(false);
          setEditingSale(null);
        } catch (error) {
          showAlert('error', 'Erreur', error.message || "Erreur lors de l'enregistrement");
        }
      }
    );
  };

  const handleCancelSale = (id, clientName) => {
    showConfirm(
      "Annuler la vente",
      `Voulez-vous vraiment annuler la vente pour "${clientName}" ? (Le statut passera à Annulée et les montants ne seront plus comptabilisés dans le chiffre d'affaires).`,
      async () => {
        closeAlert();
        try {
          const res = await fetch(`/api/special-sales/${id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ action: 'annuler' })
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error);
          showAlert('success', 'Succès', "Vente spéciale annulée.");
          loadData();
        } catch (e) {
          showAlert('error', 'Erreur', e.message);
        }
      }
    );
  };

  const handleDeleteSale = (id, clientName) => {
    showConfirm(
      "Supprimer la vente",
      `Voulez-vous supprimer définitivement la vente de "${clientName}" ?`,
      async () => {
        closeAlert();
        try {
          const res = await fetch(`/api/special-sales/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error);
          showAlert('success', 'Succès', "Vente spéciale supprimée définitivement.");
          loadData();
        } catch (e) {
          showAlert('error', 'Erreur', e.message);
        }
      }
    );
  };

  const handlePrint = (sale) => {
    setSelectedSale(sale);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  const handleViewDetails = (sale) => {
    setSelectedSale(sale);
    setIsViewModalOpen(true);
  };

  // Stats calculation
  const totalTTCValid = filteredSales.reduce((acc, curr) => curr.status === 'termine' ? acc + Number(curr.totalTTC) : acc, 0);
  const totalMarginValid = filteredSales.reduce((acc, curr) => curr.status === 'termine' ? acc + Number(curr.margin) : acc, 0);

  return (
    <div className="page-wrapper">
      {/* Print styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}} />

      {/* Main Listing View (Hidden when printing) */}
      <div className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Eye size={28} style={{ color: 'var(--primary)' }} />
              Ventes Spéciales
            </h1>
            <p className="text-muted">Gérer les ventes libres pour des clients externes non rattachées au stock d'articles.</p>
          </div>
          {(currentUser?.role === 'admin' || currentUser?.role === 'gestionnaire') && (
            <button className="btn btn-primary" onClick={handleOpenModal}>
              <Plus size={18} />
              Nouvelle Vente Spéciale
            </button>
          )}
        </div>

        {/* STATS CARDS */}
        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
          <div className="stat-card bg-gradient-blue" style={{ borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ opacity: 0.9, fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Chiffre d'Affaires Spécial (TTC)</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '8px 0' }}>{formatPrice(totalTTCValid)} FCFA</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Ventes actives cumulées</div>
          </div>
          <div className="stat-card bg-gradient-green" style={{ borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ opacity: 0.9, fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Marge Bénéficiaire Réalisée</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '8px 0' }}>{formatPrice(totalMarginValid)} FCFA</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Bénéfices sur ventes actives</div>
          </div>
          <div className="stat-card bg-gradient-orange" style={{ borderRadius: '12px', padding: '20px', color: 'white' }}>
            <div style={{ opacity: 0.9, fontSize: '0.8rem', textTransform: 'uppercase', fontWeight: 600 }}>Total Ventes</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, margin: '8px 0' }}>{filteredSales.length}</div>
            <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>Annulées: {filteredSales.filter(s => s.status === 'annule').length}</div>
          </div>
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', backgroundColor: 'var(--surface)', padding: '15px', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '250px' }}>
            <Search size={18} className="text-muted" />
            <input 
              type="text" 
              placeholder="Rechercher par client, référence ou désignation..." 
              className="form-control"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>Période :</span>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: '150px' }}
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
            />
            <span className="text-muted">au</span>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: '150px' }}
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
            />
          </div>
          <button className="btn btn-secondary" onClick={handleExport}>
            <Download size={16} />
            Exporter Excel
          </button>
        </div>

        {/* TABLE */}
        <div className="table-responsive" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'rgba(0,0,0,0.02)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '12px 16px', textAlign: 'left' }}>Client</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total HT</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Total TTC</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Bénéfice/Marge</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '12px 16px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    Aucune vente spéciale trouvée sur cette période.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr key={sale.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>{new Date(sale.date).toLocaleDateString()}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{sale.clientName}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>{formatPrice(sale.totalHT)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{formatPrice(sale.totalTTC)}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: sale.status === 'annule' ? 'gray' : 'var(--success)', fontWeight: 700 }}>
                      {sale.status === 'annule' ? '-' : formatPrice(sale.margin)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span className={`badge ${sale.status === 'termine' ? 'badge-success' : 'badge-danger'}`} style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                        {sale.status === 'termine' ? 'VALIDÉ' : 'ANNULÉ'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleViewDetails(sale)} title="Voir">
                          <Eye size={14} />
                        </button>
                        {sale.status === 'termine' && (
                          <>
                            {(currentUser?.role === 'admin' || currentUser?.role === 'gestionnaire') && (
                              <>
                                <button className="btn btn-secondary btn-sm" onClick={() => handleEditSale(sale)} title="Modifier">
                                  <Edit size={14} />
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ color: 'var(--warning)' }} onClick={() => handleCancelSale(sale.id, sale.clientName)} title="Annuler">
                                  <XOctagon size={14} />
                                </button>
                              </>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(sale)} title="Imprimer">
                              <Printer size={14} />
                            </button>
                          </>
                        )}
                        {(currentUser?.role === 'admin' || currentUser?.role === 'gestionnaire') && (
                          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeleteSale(sale.id, sale.clientName)} title="Supprimer définitivement">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-container" style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', padding: '24px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                {editingSale ? "Modifier la Vente Spéciale" : "Nouvelle Vente Spéciale"}
              </h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Client (Saisie Libre) *</label>
                  <input 
                    type="text" 
                    className="form-control"
                    placeholder="Saisir le nom du client..."
                    value={formData.clientName}
                    onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Date de la vente *</label>
                  <input 
                    type="date" 
                    className="form-control"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* PRODUCTS LIST */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ fontWeight: 700, fontSize: '0.95rem' }}>Détail des produits</h4>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddItem}>
                    Ajouter un produit
                  </button>
                </div>

                <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '6px', textAlign: 'left', fontSize: '0.85rem' }}>Référence</th>
                        <th style={{ padding: '6px', textAlign: 'left', fontSize: '0.85rem' }}>Désignation *</th>
                        <th style={{ padding: '6px', width: '80px', textAlign: 'center', fontSize: '0.85rem' }}>Qté *</th>
                        <th style={{ padding: '6px', width: '110px', textAlign: 'right', fontSize: '0.85rem' }}>P. Achat *</th>
                        <th style={{ padding: '6px', width: '110px', textAlign: 'right', fontSize: '0.85rem' }}>P. Vente *</th>
                        <th style={{ padding: '6px', width: '110px', textAlign: 'right', fontSize: '0.85rem' }}>Total HT</th>
                        <th style={{ padding: '6px', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px' }}>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{ padding: '4px' }} 
                              placeholder="Réf"
                              value={item.ref}
                              onChange={(e) => handleItemChange(idx, 'ref', e.target.value)}
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <input 
                              type="text" 
                              className="form-control" 
                              style={{ padding: '4px' }} 
                              placeholder="Désignation"
                              value={item.description}
                              onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                              required
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <input 
                              type="number" 
                              className="form-control" 
                              style={{ padding: '4px', textAlign: 'center' }} 
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              required
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <input 
                              type="number" 
                              className="form-control" 
                              style={{ padding: '4px', textAlign: 'right' }} 
                              placeholder="0"
                              min="0"
                              value={item.purchasePrice}
                              onChange={(e) => handleItemChange(idx, 'purchasePrice', e.target.value)}
                              required
                            />
                          </td>
                          <td style={{ padding: '6px' }}>
                            <input 
                              type="number" 
                              className="form-control" 
                              style={{ padding: '4px', textAlign: 'right' }} 
                              placeholder="0"
                              min="0"
                              value={item.sellingPrice}
                              onChange={(e) => handleItemChange(idx, 'sellingPrice', e.target.value)}
                              required
                            />
                          </td>
                          <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            {formatPrice((parseInt(item.quantity) || 0) * (parseFloat(item.sellingPrice) || 0))}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>
                            <button 
                              type="button" 
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                              onClick={() => handleRemoveItem(idx)}
                              disabled={formData.items.length <= 1}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* NOTES / SUMMARY */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>Notes / Justificatif</label>
                  <textarea 
                    className="form-control" 
                    placeholder="Observations ou motifs de la vente..."
                    style={{ height: '110px', resize: 'none' }}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <div style={{ backgroundColor: 'rgba(0,0,0,0.02)', padding: '15px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span className="text-muted">Sous-total HT :</span>
                    <span style={{ fontWeight: 600 }}>{formatPrice(formHT)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span className="text-muted">TVA ({settings?.tvaRate || 18}%) :</span>
                    <span style={{ fontWeight: 600 }}>{formatPrice(formTVA)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '8px', fontSize: '1rem', fontWeight: 700 }}>
                    <span>TOTAL TTC :</span>
                    <span style={{ color: 'var(--primary)' }}>{formatPrice(formTTC)} FCFA</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--success)', fontWeight: 700 }}>
                    <span>Marge nette est. :</span>
                    <span>+ {formatPrice(formMargin)} FCFA</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Annuler
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingSale ? "Enregistrer les modifications" : "Enregistrer la vente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {isViewModalOpen && selectedSale && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-container" style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', width: '90%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', padding: '24px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Détail de la Vente Spéciale</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setIsViewModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px', backgroundColor: 'rgba(0,0,0,0.02)', padding: '15px', borderRadius: '8px' }}>
              <div>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Client</p>
                <p style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem' }}>{selectedSale.clientName}</p>
              </div>
              <div>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date</p>
                <p style={{ margin: 0, fontWeight: 600 }}>{new Date(selectedSale.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Réf</th>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Désignation</th>
                  <th style={{ padding: '8px', width: '60px', textAlign: 'center' }}>Qté</th>
                  <th style={{ padding: '8px', width: '100px', textAlign: 'right' }}>P. Achat</th>
                  <th style={{ padding: '8px', width: '100px', textAlign: 'right' }}>P. Vente</th>
                  <th style={{ padding: '8px', width: '100px', textAlign: 'right' }}>Marge</th>
                  <th style={{ padding: '8px', width: '110px', textAlign: 'right' }}>Total HT</th>
                </tr>
              </thead>
              <tbody>
                {selectedSale.items.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '8px' }}>{item.ref || '-'}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{item.description}</td>
                    <td style={{ padding: '8px', textAlign: 'center' }}>{item.quantity}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatPrice(item.purchasePrice)}</td>
                    <td style={{ padding: '8px', textAlign: 'right' }}>{formatPrice(item.sellingPrice)}</td>
                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--success)', fontWeight: 500 }}>
                      {formatPrice((item.sellingPrice - item.purchasePrice) * item.quantity)}
                    </td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700 }}>{formatPrice(item.quantity * item.sellingPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '20px' }}>
              <div>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Notes / Observations</p>
                <p style={{ margin: 0, fontSize: '0.9rem', whiteSpace: 'pre-wrap', backgroundColor: '#fafafa', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)', minHeight: '60px' }}>
                  {selectedSale.notes || 'Aucune observation.'}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignSelf: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>Total HT :</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(selectedSale.totalHT)} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span>TVA :</span>
                  <span style={{ fontWeight: 600 }}>{formatPrice(selectedSale.tva)} FCFA</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700, borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  <span>Total TTC :</span>
                  <span style={{ color: 'var(--primary)' }}>{formatPrice(selectedSale.totalTTC)} FCFA</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setIsViewModalOpen(false)}>
                Fermer
              </button>
              {selectedSale.status === 'termine' && (
                <button className="btn btn-primary" onClick={() => { setIsViewModalOpen(false); handlePrint(selectedSale); }}>
                  <Printer size={16} />
                  Imprimer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRINT TEMPLATE (Only visible to window.print()) */}
      {selectedSale && (
        <div className="print-section print-only" style={{ padding: '40px', color: 'black', backgroundColor: 'white', fontFamily: 'Arial, sans-serif' }}>
          {/* Logo & Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #b91c1c', paddingBottom: '15px', marginBottom: '30px' }}>
            {settings?.logo && (
              <img src={settings.logo} alt="Logo" style={{ maxHeight: '70px' }} />
            )}
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ margin: 0, color: '#b91c1c', fontWeight: 'bold', fontSize: '20px' }}>{settings?.companyName || 'NS AUTO'}</h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#666' }}>{settings?.address}</p>
            </div>
          </div>

          {/* Document Title / Info */}
          <div style={{ border: '2px solid black', padding: '12px', textAlign: 'center', marginBottom: '30px', backgroundColor: '#f3f4f6' }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>FACTURE DE VENTE SPÉCIALE</h3>
            <p style={{ margin: '5px 0 0 0', fontSize: '13px' }}>N° VSE-{selectedSale.id.substring(0, 8).toUpperCase()}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '30px' }}>
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>ÉMETTEUR</p>
              <p style={{ margin: '0 0 2px 0', fontWeight: 'bold' }}>{settings?.companyName}</p>
              <p style={{ margin: '0 0 2px 0', fontSize: '13px' }}>RCCM : {settings?.rccm}</p>
              <p style={{ margin: '0 0 2px 0', fontSize: '13px' }}>IFU : {settings?.nif}</p>
              <p style={{ margin: '0 0 2px 0', fontSize: '13px' }}>BP : {settings?.bp}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666', fontWeight: 'bold' }}>CLIENT</p>
              <p style={{ margin: 0, fontWeight: 'bold', fontSize: '15px' }}>{selectedSale.clientName}</p>
              <p style={{ margin: '15px 0 0 0', fontSize: '13px' }}>
                Date : <strong>{new Date(selectedSale.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</strong>
              </p>
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid black', padding: '10px', textAlign: 'left', width: '40px' }}>N°</th>
                <th style={{ border: '1px solid black', padding: '10px', textAlign: 'left', width: '100px' }}>Référence</th>
                <th style={{ border: '1px solid black', padding: '10px', textAlign: 'left' }}>Désignation</th>
                <th style={{ border: '1px solid black', padding: '10px', textAlign: 'center', width: '60px' }}>Qté</th>
                <th style={{ border: '1px solid black', padding: '10px', textAlign: 'right', width: '120px' }}>Prix Unitaire</th>
                <th style={{ border: '1px solid black', padding: '10px', textAlign: 'right', width: '130px' }}>Total HT</th>
              </tr>
            </thead>
            <tbody>
              {selectedSale.items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ border: '1px solid black', padding: '10px', textAlign: 'center' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid black', padding: '10px' }}>{item.ref || '-'}</td>
                  <td style={{ border: '1px solid black', padding: '10px', fontWeight: 'bold' }}>{item.description}</td>
                  <td style={{ border: '1px solid black', padding: '10px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ border: '1px solid black', padding: '10px', textAlign: 'right' }}>{formatPrice(item.sellingPrice)}</td>
                  <td style={{ border: '1px solid black', padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(item.quantity * item.sellingPrice)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan="5" style={{ border: '1px solid black', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>Montant HTVA</td>
                <td style={{ border: '1px solid black', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(selectedSale.totalHT)}</td>
              </tr>
              <tr>
                <td colSpan="5" style={{ border: '1px solid black', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>Montant TVA ({settings?.tvaRate || 18}%)</td>
                <td style={{ border: '1px solid black', padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(selectedSale.tva)}</td>
              </tr>
              <tr style={{ backgroundColor: '#e5e7eb' }}>
                <td colSpan="5" style={{ border: '1px solid black', padding: '10px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px' }}>TOTAL NET A PAYER</td>
                <td style={{ border: '1px solid black', padding: '10px', textAlign: 'right', fontWeight: 'bold', fontSize: '14px', color: '#b91c1c' }}>{formatPrice(selectedSale.totalTTC)} FCFA</td>
              </tr>
            </tbody>
          </table>

          {selectedSale.notes && (
            <div style={{ marginTop: '20px', border: '1px solid #ddd', padding: '12px', borderRadius: '4px', backgroundColor: '#fafafa' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '11px', fontWeight: 'bold', color: '#666' }}>OBSERVATIONS :</p>
              <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap' }}>{selectedSale.notes}</p>
            </div>
          )}

          {/* Signature / Stamp */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px' }}>
            <div style={{ width: '200px', textAlign: 'center' }}>
              <p style={{ fontSize: '12px', fontStyle: 'italic', margin: '0 0 10px 0' }}>Le Client</p>
              <div style={{ height: '80px', borderBottom: '1px dashed #ccc' }}></div>
            </div>
            <div style={{ minWidth: '220px', textAlign: 'right' }}>
              <p style={{ fontSize: '12px', fontStyle: 'italic', margin: '0 0 10px 0' }}>Fait à {settings?.city || 'Ouagadougou'}, le {new Date(selectedSale.date).toLocaleDateString()}</p>
              {settings?.signatureImage && (
                <img src={settings.signatureImage} alt="Signature" style={{ maxHeight: '60px', objectFit: 'contain' }} />
              )}
              <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginTop: '10px' }}>{settings?.supervisorName}</p>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal for UI */}
      <AlertModal 
        isOpen={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onConfirm={alertModal.onConfirm}
        onClose={closeAlert}
      />
    </div>
  );
}
