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
  const [partners, setPartners] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  
  const [isPrintPrepModalOpen, setIsPrintPrepModalOpen] = useState(false);
  const [printFormData, setPrintFormData] = useState({
    title: 'FACTURE DE VENTE SPÉCIALE',
    sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
    reference: '',
    senderDetails: '',
    recipientDetails: '',
    date: '',
    city: '',
    siteCode: '',
    clientCode: '',
    supervisorName: '',
    supervisorTitle: '',
    hasTva: true,
    tvaRate: 18,
    docNumber: '',
    notes: '',
    hideColNo: false,
    hideColSite: false,
    hideColDesc: false,
    hideColCode: false,
    hideColRef: false,
    hideColQty: false,
    hideColPrice: false,
    hideColTotal: false,
    colNoLabel: 'N°',
    colSiteLabel: 'Site',
    colDescLabel: 'Désignation / Article',
    colCodeLabel: 'Code',
    colRefLabel: 'Référence',
    colQtyLabel: 'Qté',
    colPriceLabel: 'Prix HTVA F. CFA',
    colTotalLabel: 'Total HTVA F. CFA',
    items: []
  });

  const numberToWords = (n) => {
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const tens = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

    if (n === 0) return 'zéro';

    const convert = (num) => {
      if (num < 10) return units[num];
      if (num < 20) {
        if (num === 10) return 'dix';
        if (num === 11) return 'onze';
        if (num === 12) return 'douze';
        if (num === 13) return 'treize';
        if (num === 14) return 'quatorze';
        if (num === 15) return 'quinze';
        if (num === 16) return 'seize';
        return 'dix-' + units[num % 10];
      }
      if (num < 100) {
        const t = Math.floor(num / 10);
        const u = num % 10;
        if (u === 0) return tens[t];
        if (u === 1 && t < 8) return tens[t] + ' et un';
        if (t === 7 || t === 9) return tens[t - 1] + '-' + convert(u + 10);
        return tens[t] + '-' + units[u];
      }
      if (num < 1000) {
        const c = Math.floor(num / 100);
        const r = num % 100;
        let s = (c === 1 ? '' : units[c] + ' ') + 'cent';
        if (r === 0) return s + (c > 1 ? 's' : '');
        return s + ' ' + convert(r);
      }
      if (num < 1000000) {
        const m = Math.floor(num / 1000);
        const r = num % 1000;
        let s = (m === 1 ? '' : convert(m) + ' ') + 'mille';
        if (r === 0) return s;
        return s + ' ' + convert(r);
      }
      if (num < 1000000000) {
        const mill = Math.floor(num / 1000000);
        const r = num % 1000000;
        let s = convert(mill) + ' million';
        if (mill > 1) s += 's';
        if (r === 0) return s;
        return s + ' ' + convert(r);
      }
      return num.toLocaleString();
    };

    const res = convert(n);
    return res.charAt(0).toUpperCase() + res.slice(1);
  };
  
  const [formData, setFormData] = useState({ 
    clientName: '', 
    notes: '', 
    date: '', 
    items: [{ ref: '', description: '', quantity: '', purchasePrice: '', sellingPrice: '' }]
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
      const [sData, fyData, stData, pData] = await Promise.all([
        storage.get(`special-sales?storeId=all&startDate=${dateRange.start}&endDate=${dateRange.end}`),
        storage.get('fiscal-years'),
        storage.get('settings'),
        storage.get('contract-partners')
      ]);
      setSales(sData?.data || []);
      setSettings(stData);
      setPartners(pData || []);
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
    const cleanSearch = searchTerm.toLowerCase().replace(/-/g, '');
    const clientMatch = sale.clientName?.toLowerCase().includes(searchTerm.toLowerCase());
    const notesMatch = sale.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const itemMatch = sale.items?.some(it => {
      const matchRef = it.ref ? it.ref.toLowerCase().replace(/-/g, '').includes(cleanSearch) : false;
      const matchDesc = it.description ? it.description.toLowerCase().includes(searchTerm.toLowerCase()) : false;
      return matchRef || matchDesc;
    });
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
      items: [{ ref: '', description: '', quantity: '', purchasePrice: '', sellingPrice: '' }]
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
      items: [...formData.items, { ref: '', description: '', quantity: '', purchasePrice: '', sellingPrice: '' }]
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

    const hasZeroPriceItem = items.some(it => (parseFloat(it.sellingPrice) || 0) <= 0);
    if (hasZeroPriceItem) {
      showAlert('error', 'Action bloquée', "Impossible de vendre un article avec un prix à 0 FCFA.");
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

  const handlePrint = async (sale) => {
    setSelectedSale(sale);
    const todayStr = new Date().toISOString().split('T')[0];
    
    let activeSettings = settings;
    try {
      const freshSettings = await storage.get('settings');
      if (freshSettings && !freshSettings.error) {
        activeSettings = freshSettings;
        setSettings(freshSettings);
      }
    } catch (e) {
      console.error("Error loading fresh settings:", e);
    }

    try {
      const freshPartners = await storage.get('contract-partners');
      if (freshPartners && !freshPartners.error) {
        setPartners(freshPartners);
      }
    } catch (e) {
      console.error("Error loading fresh partners:", e);
    }

    const meta = sale.metadata ? (typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata) : null;
    
    setPrintFormData({
      title: meta?.title || 'FACTURE DE VENTE SPÉCIALE',
      sectionTitle: meta?.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE',
      reference: meta?.reference || '',
      senderDetails: meta?.senderDetails || [
        activeSettings?.companyName || 'NS AUTO SARL',
        activeSettings?.address || 'Secteur 05, Parcelle C, Lot 1317 ter',
        activeSettings?.rccm ? `RCCM : ${activeSettings.rccm}` : 'RCCM : BF BBD 2018 B 0372',
        activeSettings?.nif ? `IFU : ${activeSettings.nif}` : 'IFU : 00102506 K',
        activeSettings?.bp || 'BP 1245 Bobo-dioulasso',
        activeSettings?.division || 'Division des Grandes Entreprises',
        activeSettings?.taxSystem || 'Réel Normal d\'Imposition'
      ].filter(Boolean).join('\n'),
      recipientDetails: meta?.recipientDetails || sale.clientName || '',
      date: meta?.date || todayStr,
      city: meta?.city || activeSettings?.city || 'Ouagadougou',
      siteCode: meta?.siteCode || '',
      clientCode: meta?.clientCode || '',
      supervisorName: meta?.supervisorName || activeSettings?.supervisorName || 'Guy Roland TONDE',
      supervisorTitle: meta?.supervisorTitle || activeSettings?.supervisorTitle || 'SUPERVISEUR',
      hasTva: meta?.hasTva !== undefined ? meta.hasTva : true,
      tvaRate: meta?.tvaRate !== undefined ? meta.tvaRate : (activeSettings?.tvaRate !== undefined ? activeSettings.tvaRate : 18),
      docNumber: meta?.docNumber || '',
      notes: meta?.notes !== undefined ? meta.notes : (sale.notes || ''),
      hideColNo: meta?.hideColNo || false,
      hideColSite: meta?.hideColSite || false,
      hideColDesc: meta?.hideColDesc || false,
      hideColCode: meta?.hideColCode || false,
      hideColRef: meta?.hideColRef || false,
      hideColQty: meta?.hideColQty || false,
      hideColPrice: meta?.hideColPrice || false,
      hideColTotal: meta?.hideColTotal || false,
      colNoLabel: meta?.colNoLabel || 'N°',
      colSiteLabel: meta?.colSiteLabel || 'Site',
      colDescLabel: meta?.colDescLabel || 'Désignation / Article',
      colCodeLabel: meta?.colCodeLabel || 'Code',
      colRefLabel: meta?.colRefLabel || 'Référence',
      colQtyLabel: meta?.colQtyLabel || 'Qté',
      colPriceLabel: meta?.colPriceLabel || 'Prix HTVA F. CFA',
      colTotalLabel: meta?.colTotalLabel || 'Total HTVA F. CFA',
      items: meta?.items || (sale.items ? sale.items.map(it => ({ ...it })) : [])
    });
    
    setIsPrintPrepModalOpen(true);
  };

  const handleExecutePrint = async () => {
    setIsPrintPrepModalOpen(false);
    
    try {
      const res = await fetch(`/api/special-sales/${selectedSale.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({
          action: 'update_metadata',
          metadata: printFormData
        })
      });
      if (res.ok) {
        setSales(prev => prev.map(s => {
          if (s.id === selectedSale.id) {
            return { ...s, metadata: printFormData };
          }
          return s;
        }));
        setSelectedSale(prev => prev ? { ...prev, metadata: printFormData } : null);
      }
    } catch (e) {
      console.error("Error saving print metadata:", e);
    }
    
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
          .receipt-print-only, .receipt-print-only * { visibility: visible; }
          .receipt-print-only { position: absolute; left: 0; top: 0; width: 100%; }
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

      {/* PRINT PREPARATION MODAL */}
      {isPrintPrepModalOpen && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-container" style={{ backgroundColor: 'var(--surface)', borderRadius: '12px', width: '95%', maxWidth: '950px', maxHeight: '90vh', overflowY: 'auto', border: '1px solid var(--border)', padding: '24px' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Préparation Impression Vente Spéciale</h3>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setIsPrintPrepModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Titre de la Facture</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={printFormData.title}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Titre de Section (Dans le tableau)</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={printFormData.sectionTitle}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, sectionTitle: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Référence / Objet (Zone Libre)</label>
              <textarea 
                className="form-control"
                style={{ height: '50px', resize: 'vertical' }}
                value={printFormData.reference}
                onChange={(e) => setPrintFormData(prev => ({ ...prev, reference: e.target.value }))}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Détails de l'Expéditeur (Bloc de gauche)</label>
                <textarea 
                  className="form-control"
                  style={{ height: '120px', resize: 'vertical' }}
                  value={printFormData.senderDetails}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, senderDetails: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Détails du Destinataire (Bloc de droite)</label>
                <textarea 
                  className="form-control"
                  style={{ height: '120px', resize: 'vertical' }}
                  value={printFormData.recipientDetails}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, recipientDetails: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Date</label>
                <input 
                  type="date" 
                  className="form-control"
                  value={printFormData.date}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Lieu (Ville)</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={printFormData.city}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, city: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Code Site</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: HOUN"
                  value={printFormData.siteCode}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, siteCode: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Notre Code Client</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="Ex: CLC 03977"
                  value={printFormData.clientCode}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, clientCode: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Signataire (Nom)</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={printFormData.supervisorName}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, supervisorName: e.target.value }))}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Titre</label>
                <input 
                  type="text" 
                  className="form-control"
                  value={printFormData.supervisorTitle}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, supervisorTitle: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '28px' }}>
                <input 
                  type="checkbox" 
                  id="hasTva"
                  checked={printFormData.hasTva}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, hasTva: e.target.checked }))}
                />
                <label htmlFor="hasTva" style={{ fontWeight: 600, cursor: 'pointer' }}>SOUMIS TVA</label>
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>TVA %</label>
                <input 
                  type="number" 
                  className="form-control"
                  disabled={!printFormData.hasTva}
                  value={printFormData.tvaRate}
                  onChange={(e) => setPrintFormData(prev => ({ ...prev, tvaRate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Numéro de Document (Manuel) *</label>
              <input 
                type="text" 
                className="form-control"
                value={printFormData.docNumber}
                onChange={(e) => setPrintFormData(prev => ({ ...prev, docNumber: e.target.value }))}
                required
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Notes / Conditions Particulières</label>
              <textarea 
                className="form-control"
                placeholder="Ex: Validité de l'offre 30 jours, livraison sous 48h..."
                style={{ height: '60px', resize: 'vertical' }}
                value={printFormData.notes}
                onChange={(e) => setPrintFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            {/* Column Label Settings */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '15px', marginBottom: '20px', backgroundColor: 'rgba(0,0,0,0.01)' }}>
              <h5 style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.85rem' }}>Libellés des colonnes (Facture)</h5>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColNo} onChange={(e) => setPrintFormData(p => ({ ...p, hideColNo: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colNoLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colNoLabel: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColSite} onChange={(e) => setPrintFormData(p => ({ ...p, hideColSite: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colSiteLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colSiteLabel: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColDesc} onChange={(e) => setPrintFormData(p => ({ ...p, hideColDesc: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colDescLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colDescLabel: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColCode} onChange={(e) => setPrintFormData(p => ({ ...p, hideColCode: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colCodeLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colCodeLabel: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColRef} onChange={(e) => setPrintFormData(p => ({ ...p, hideColRef: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colRefLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colRefLabel: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColQty} onChange={(e) => setPrintFormData(p => ({ ...p, hideColQty: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colQtyLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colQtyLabel: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColPrice} onChange={(e) => setPrintFormData(p => ({ ...p, hideColPrice: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colPriceLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colPriceLabel: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={!printFormData.hideColTotal} onChange={(e) => setPrintFormData(p => ({ ...p, hideColTotal: !e.target.checked }))} />
                  <input type="text" className="form-control" style={{ padding: '4px' }} value={printFormData.colTotalLabel} onChange={(e) => setPrintFormData(p => ({ ...p, colTotalLabel: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Table des Articles pour la Préparation */}
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '10px' }}>Articles à imprimer</h4>
              <div className="table-responsive" style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', backgroundColor: 'rgba(0,0,0,0.01)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '6px', textAlign: 'left', fontSize: '0.85rem', width: '120px' }}>Code</th>
                      <th style={{ padding: '6px', textAlign: 'left', fontSize: '0.85rem', width: '150px' }}>Référence</th>
                      <th style={{ padding: '6px', textAlign: 'left', fontSize: '0.85rem' }}>Désignation / Article</th>
                      <th style={{ padding: '6px', width: '80px', textAlign: 'center', fontSize: '0.85rem' }}>Qté</th>
                      <th style={{ padding: '6px', width: '120px', textAlign: 'right', fontSize: '0.85rem' }}>P.A (HT) / Prix Vente</th>
                      <th style={{ padding: '6px', width: '120px', textAlign: 'right', fontSize: '0.85rem' }}>Total HT</th>
                      <th style={{ padding: '6px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {printFormData.items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px' }}>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: '4px' }} 
                            placeholder="Code"
                            value={item.code || ''}
                            onChange={(e) => {
                              const newItems = [...printFormData.items];
                              newItems[idx].code = e.target.value;
                              setPrintFormData({ ...printFormData, items: newItems });
                            }}
                          />
                        </td>
                        <td style={{ padding: '6px' }}>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: '4px' }} 
                            placeholder="Réf"
                            value={item.ref || ''}
                            onChange={(e) => {
                              const newItems = [...printFormData.items];
                              newItems[idx].ref = e.target.value;
                              setPrintFormData({ ...printFormData, items: newItems });
                            }}
                          />
                        </td>
                        <td style={{ padding: '6px' }}>
                          <input 
                            type="text" 
                            className="form-control" 
                            style={{ padding: '4px' }} 
                            placeholder="Désignation"
                            value={item.description || ''}
                            onChange={(e) => {
                              const newItems = [...printFormData.items];
                              newItems[idx].description = e.target.value;
                              setPrintFormData({ ...printFormData, items: newItems });
                            }}
                          />
                        </td>
                        <td style={{ padding: '6px' }}>
                          <input 
                            type="number" 
                            className="form-control" 
                            style={{ padding: '4px', textAlign: 'center', backgroundColor: '#f3f4f6', cursor: 'not-allowed' }} 
                            value={item.quantity === 0 ? 0 : (item.quantity || '')}
                            disabled
                            readOnly
                          />
                        </td>
                        <td style={{ padding: '6px' }}>
                          <input 
                            type="number" 
                            className="form-control" 
                            style={{ padding: '4px', textAlign: 'right', backgroundColor: '#f3f4f6', cursor: 'not-allowed' }} 
                            value={item.sellingPrice || ''}
                            disabled
                            readOnly
                          />
                        </td>
                        <td style={{ padding: '6px', textAlign: 'right', fontWeight: 'bold', fontSize: '0.9rem' }}>
                          {formatPrice((parseInt(item.quantity) || 0) * (parseFloat(item.sellingPrice) || 0))}
                        </td>
                        <td style={{ padding: '6px', textAlign: 'center' }}>
                          {/* Supprimer la ligne disabled/hidden per requirements */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsPrintPrepModalOpen(false)}>
                Annuler
              </button>
              <button type="button" className="btn btn-primary" onClick={handleExecutePrint}>
                Lancer l'impression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT TEMPLATE (Only visible to window.print()) */}
      {selectedSale && (
        <div className="receipt-print-only" style={{
          padding: '0',
          color: '#000',
          fontFamily: '"Times New Roman", Times, serif',
          backgroundColor: '#fff',
          width: '21cm',
          minHeight: '28.5cm',
          margin: '0 auto',
          position: 'relative',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact'
        }}>
          <style dangerouslySetInnerHTML={{
            __html: `
            @page { size: A4 portrait; margin: 0 !important; }
            @media print {
              body { margin: 0 !important; padding: 0 !important; }
              .receipt-print-only { 
                width: 100% !important; 
                min-height: 100% !important; 
                padding: 0 !important; 
                margin: 0 auto !important; 
                position: relative !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
              }
              .receipt-print-only table { border-collapse: collapse !important; width: 100% !important; }
              .receipt-print-only th, .receipt-print-only td { border: 1.5pt solid black !important; -webkit-print-color-adjust: exact !important; }
              .receipt-print-only td.master-td { border: none !important; padding: 0 !important; }
              .receipt-print-only .no-border td { border: none !important; }
              .receipt-print-only .header-info td { border: 1.5pt solid black !important; }
              .red-footer { 
                position: fixed !important; 
                bottom: 0 !important; 
                left: 0 !important; 
                right: 0 !important; 
                width: 100% !important;
                background-color: #b91c1c !important;
                color: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                z-index: 9999 !important;
                border-top: 1pt solid #b91c1c !important;
              }
              .red-footer p { color: white !important; }
            }
          `}} />

          {/* Helper styles inside React render */}
          {(() => {
            const printBorder = '1.5pt solid #000 !important';
            const cellStyle = {
              border: printBorder,
              padding: '1.5px 4px',
              fontSize: '9px',
              verticalAlign: 'middle',
              boxSizing: 'border-box',
              color: '#000'
            };
            const tableHeaderStyle = {
              ...cellStyle,
              backgroundColor: '#d1d5db',
              fontWeight: 'bold',
              textAlign: 'center',
              fontSize: '9px',
              verticalAlign: 'top',
              padding: '3px 4px',
              WebkitPrintColorAdjust: 'exact'
            };

            const printTotalHT = printFormData.items.reduce((acc, curr) => acc + (curr.quantity * curr.sellingPrice), 0);
            const printTvaAmount = printFormData.hasTva ? (printTotalHT * (printFormData.tvaRate / 100)) : 0;
            const printTotalTTC = printTotalHT + printTvaAmount;

            const showCodeSub = !printFormData.hideColCode;
            const showSiteSub = !printFormData.hideColSite;
            const showDescSub = !printFormData.hideColDesc;
            const showRefSub = !printFormData.hideColRef;
            const numDesignationCols = [showCodeSub, showSiteSub, showDescSub, showRefSub].filter(Boolean).length;

            const showNoCol = !printFormData.hideColNo;
            const showQtyCol = !printFormData.hideColQty;
            const showPriceCol = !printFormData.hideColPrice;
            const showTotalCol = !printFormData.hideColTotal;

            const totalColsBeforeTotal = [
              showNoCol,
              showCodeSub,
              showSiteSub,
              showDescSub,
              showRefSub,
              showQtyCol,
              showPriceCol
            ].filter(Boolean).length;

            return (
              <table style={{ width: '100%', border: 'none', borderCollapse: 'collapse' }}>
                <tfoot style={{ display: 'table-footer-group' }}>
                  <tr><td className="master-td" style={{ border: 'none', height: '100px', padding: '0' }}></td></tr>
                </tfoot>
                <tbody style={{ display: 'table-row-group' }}>
                  <tr>
                    <td className="master-td" style={{ border: 'none', padding: '0' }}>
                      <div style={{ padding: '0px 40px 20px 40px' }}>
                        
                        {/* Top Logo & Line */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '32px' }}>
                          {settings?.logo && (
                            <img
                              src={settings?.logo}
                              alt="Logo"
                              style={{ maxHeight: '120px', marginRight: '2px', position: 'relative', top: '34px' }}
                            />
                          )}
                          <div style={{ flex: 1, height: '2.5pt', backgroundColor: '#b91c1c', marginBottom: '13px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
                        </div>

                        {/* Document Title Header */}
                        <div style={{ border: '1.5pt solid #000', padding: '10px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#f3f4f6', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
                          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                            <span style={{ textDecoration: 'underline' }}>{printFormData.title} :</span> &nbsp;&nbsp;
                            {printFormData.docNumber}
                          </h2>
                        </div>

                        {/* Header info (Sender / Recipient) */}
                        <table className="header-info" style={{ width: '100%', borderCollapse: 'collapse', border: '1.5pt solid black', marginBottom: '0' }}>
                          <tbody>
                            <tr>
                              <td style={{ width: '50%', verticalAlign: 'top', padding: '6px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.3' }}>
                                  <p style={{ margin: '0 0 6px 0' }}><strong>{settings?.companyName}</strong>{printFormData.clientCode ? ` / Code client : ${printFormData.clientCode}` : ''}</p>
                                  {(printFormData.senderDetails || '').split('\n').map((line, idx) => (
                                    idx > 0 && <p key={idx} style={{ margin: '0 0 2px 0' }}>{line}</p>
                                  ))}
                                </div>
                              </td>
                              <td style={{ width: '50%', verticalAlign: 'top', padding: '6px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.3' }}>
                                  {(printFormData.recipientDetails || '').split('\n').map((line, idx) => (
                                    <p key={idx} style={{ margin: idx === 0 ? '0 0 6px 0' : '0 0 2px 0' }}>{idx === 0 ? <strong>{line}</strong> : line}</p>
                                  ))}
                                </div>
                              </td>
                            </tr>
                            {printFormData.reference && (
                              <tr>
                                <td colSpan="2" style={{ textAlign: 'center', backgroundColor: '#e5e7eb', padding: '6px', fontWeight: 'bold', fontSize: '10px', whiteSpace: 'pre-wrap', border: '1.5pt solid black' }}>
                                  {printFormData.reference}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>

                        {/* Items Table */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                          <thead>
                            <tr>
                              {showNoCol && <th rowSpan="3" style={{ ...tableHeaderStyle, width: '30px' }}>{printFormData.colNoLabel}</th>}
                              {numDesignationCols > 0 && (
                                <th colSpan={numDesignationCols} style={{ ...tableHeaderStyle, fontSize: '9px', letterSpacing: '1px', padding: '4px' }}>DESIGNATION</th>
                              )}
                              {showQtyCol && <th style={{ ...tableHeaderStyle, width: '50px' }}>{printFormData.colQtyLabel}</th>}
                              {showPriceCol && <th style={{ ...tableHeaderStyle, width: '85px' }}>{printFormData.colPriceLabel}</th>}
                              {showTotalCol && <th style={{ ...tableHeaderStyle, width: '95px' }}>{printFormData.colTotalLabel}</th>}
                            </tr>
                            <tr>
                              {numDesignationCols > 0 && (
                                <th colSpan={numDesignationCols} style={{ ...cellStyle, textAlign: 'left', fontWeight: 'bold', fontSize: '9px', paddingLeft: '8px', backgroundColor: '#fff' }}>
                                  {printFormData.sectionTitle}
                                </th>
                              )}
                              {showQtyCol && <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>}
                              {showPriceCol && <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>}
                              {showTotalCol && <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>}
                            </tr>
                            <tr>
                              {showCodeSub && <th style={{ ...tableHeaderStyle, width: '80px' }}>{printFormData.colCodeLabel}</th>}
                              {showSiteSub && <th style={{ ...tableHeaderStyle, width: '60px' }}>{printFormData.colSiteLabel}</th>}
                              {showDescSub && <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>{printFormData.colDescLabel}</th>}
                              {showRefSub && <th style={{ ...tableHeaderStyle, width: '90px' }}>{printFormData.colRefLabel}</th>}
                              {showQtyCol && <th style={tableHeaderStyle}></th>}
                              {showPriceCol && <th style={tableHeaderStyle}></th>}
                              {showTotalCol && <th style={tableHeaderStyle}></th>}
                            </tr>
                          </thead>
                          <tbody>
                            {printFormData.items.map((item, i) => (
                              <tr key={i}>
                                {showNoCol && <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>}
                                {showCodeSub && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.code || '-'}</td>}
                                {showSiteSub && <td style={{ ...cellStyle, textAlign: 'center' }}>{printFormData.siteCode || ''}</td>}
                                {showDescSub && <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.description}</td>}
                                {showRefSub && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.ref || '-'}</td>}
                                {showQtyCol && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.quantity}</td>}
                                {showPriceCol && <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPrice(item.sellingPrice)}</td>}
                                {showTotalCol && <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(item.quantity * item.sellingPrice)}</td>}
                              </tr>
                            ))}

                            <tr>
                              <td colSpan={totalColsBeforeTotal} style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px', border: '1.5pt solid black' }}>MONTANT HTVA</td>
                              {showTotalCol && <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px', border: '1.5pt solid black' }}>{formatPrice(printTotalHT)}</td>}
                            </tr>
                            <tr>
                              <td colSpan={totalColsBeforeTotal} style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px', border: '1.5pt solid black' }}>MONTANT TVA {printFormData.hasTva ? printFormData.tvaRate : 0}%</td>
                              {showTotalCol && <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px', border: '1.5pt solid black' }}>{formatPrice(printTvaAmount)}</td>}
                            </tr>
                            <tr style={{ backgroundColor: '#d1d5db' }}>
                              <td colSpan={totalColsBeforeTotal} style={{ textAlign: 'right', fontWeight: 'bold', padding: '3px 8px', fontSize: '9px', border: '1.5pt solid black', WebkitPrintColorAdjust: 'exact' }}>TOTAL NET A PAYER</td>
                              {showTotalCol && <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '3px 8px', fontSize: '9px', border: '1.5pt solid black' }}>{formatPrice(printTotalTTC)}</td>}
                            </tr>
                          </tbody>
                        </table>

                        {/* Note box */}
                        {printFormData.notes && (
                          <div style={{ marginTop: '15px', padding: '10px', border: '1pt solid #eee', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                            <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Notes / Conditions Particulières :</p>
                            <p style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap', color: '#333' }}>{printFormData.notes}</p>
                          </div>
                        )}

                        {/* Stop sum text */}
                        <div style={{ marginTop: '25px' }}>
                          <div style={{ fontSize: '11px' }}>
                            <p style={{ margin: '0 0 5px 0' }}>Arrêtée la présente facture à la somme de :</p>
                            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', marginLeft: '40px' }}>
                              {numberToWords(Math.trunc(printTotalTTC))} ( {formatPrice(printTotalTTC).toLocaleString()} Francs CFA TTC )
                            </p>
                          </div>

                          {/* Signatures */}
                          {(() => {
                            const fallbackPartnerWithStamp = partners?.find(p => p.stamp_image);
                            const stampImg = settings?.stampImage || settings?.stamp_image || fallbackPartnerWithStamp?.stamp_image;
                            
                            const fallbackPartnerWithSig = partners?.find(p => p.signature_image);
                            const signatureImg = settings?.signatureImage || settings?.signature_image || fallbackPartnerWithSig?.signature_image;

                            return (
                              <div style={{ display: 'flex', marginLeft: 'auto', marginRight: '0', width: 'fit-content', alignItems: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                {/* Cachet Area */}
                                {stampImg && (
                                  <div style={{ width: '150px', height: '110px', marginBottom: '10px', marginRight: '-30px', zIndex: 1 }}>
                                    <img src={stampImg} alt="Cachet" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                  </div>
                                )}

                                {/* Signature Area */}
                                <div style={{ textAlign: 'right', minWidth: '250px' }}>
                                  <p style={{ fontStyle: 'italic', fontSize: '13px', marginBottom: '5px' }}>Fait à {printFormData.city} le {new Date(printFormData.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

                                  <div style={{ position: 'relative', marginTop: '10px', height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    {signatureImg && (
                                      <img
                                        src={signatureImg}
                                        alt="Signature"
                                        style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain', marginBottom: '-20px', zIndex: 1 }}
                                      />
                                    )}
                                    <div style={{ marginTop: signatureImg ? '0' : '50px', zIndex: 2 }}>
                                      <p style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '15px', margin: 0 }}>
                                        {printFormData.supervisorName}
                                      </p>
                                      <p style={{ margin: 0, fontSize: '12px' }}>
                                        {printFormData.supervisorTitle}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            );
          })()}

          {/* Red footer bar */}
          <div className="red-footer" style={{
            height: '80px',
            backgroundColor: '#b91c1c',
            color: '#fff',
            fontSize: '10px',
            textAlign: 'center',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            WebkitPrintColorAdjust: 'exact',
            printColorAdjust: 'exact',
            borderTop: '2px solid #000'
          }}>
            <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '70px', backgroundColor: '#000', clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)' }}></div>
            <div style={{ padding: '0 20px', width: '100%', position: 'relative', zIndex: 2 }}>
              <p style={{ margin: '0', fontWeight: 'bold', fontSize: '10px' }}>
                {settings?.footerLine1 || `${settings?.companyName} - RCCM ${settings?.rccm || 'BF BBD 2018 B 0372'} - IFU ${settings?.nif || '00102506 K'} - RNI`}
              </p>
              <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine2}</p>
              <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine3}</p>
              <p style={{ margin: '1px 0', fontWeight: 'bold', fontSize: '10px' }}>{settings?.footerLine4}</p>
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
