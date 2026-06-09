'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Plus, CheckCircle, XCircle, Clock, Trash2, Search, X, PackageOpen, ListPlus, Printer, Truck, AlertCircle, Download, FileText, Edit } from 'lucide-react';
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

  const formatDocumentNumber = (seqData, formatString, clientName = '') => {
    if (!formatString) return seqData.documentNumber;
    const seqPadded = String(seqData.sequence).padStart(3, '0');
    const dateFormatted = seqData.date;
    const year = dateFormatted.split('-')[1];
    const client = clientName ? clientName.substring(0, 3).toUpperCase() : 'GEN';

    return formatString
      .replace(/{ID}/g, seqPadded)
      .replace(/{DATE}/g, dateFormatted)
      .replace(/{YEAR}/g, year)
      .replace(/{CLIENT}/g, client);
  };

  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingSummary, setIsPrintingSummary] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [selectedOrderForDelivery, setSelectedOrderForDelivery] = useState(null);
  const [deliveryItems, setDeliveryItems] = useState([]);
  const [orderDeliveries, setOrderDeliveries] = useState([]);
  const [isPrintingBL, setIsPrintingBL] = useState(false);
  const [printBLData, setPrintBLData] = useState(null);
  const [isBCPrintModalOpen, setIsBCPrintModalOpen] = useState(false);
  const [viewOrderDetails, setViewOrderDetails] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [formData, setFormData] = useState({ 
    clientId: null, supplierId: '', deliveryDate: '', items: [{ code: '', ref: '', description: '', quantity: 1, purchasePrice: '' }]
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
    let grandTotalQtyOrdered = 0;
    let grandTotalQtyDelivered = 0;
    let grandTotalQtyRemaining = 0;
    let grandTotalHTOrdered = 0;
    let grandTotalHTDelivered = 0;
    let grandTotalHTRemaining = 0;
    let grandTotalTTCDelivered = 0;

    filteredOrders.forEach(order => {
      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          let bcNumber = '';
          if (order.metadata) {
            try {
              const meta = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata;
              bcNumber = meta.customDocNumber || '';
            } catch (e) {}
          }
          if (!bcNumber) {
            bcNumber = `BCE-${order.id.substring(0, 8).toUpperCase()}`;
          }

          const qOrdered = parseInt(item.quantity) || 0;
          const qDelivered = parseInt(item.quantity_delivered) || 0;
          const qRemaining = Math.max(0, qOrdered - qDelivered);
          const price = parseFloat(item.purchasePrice) || 0;

          const totalHTOrdered = qOrdered * price;
          const totalHTDelivered = qDelivered * price;
          const totalHTRemaining = qRemaining * price;
          const totalTTCDelivered = totalHTDelivered * 1.18;

          grandTotalQtyOrdered += qOrdered;
          grandTotalQtyDelivered += qDelivered;
          grandTotalQtyRemaining += qRemaining;
          grandTotalHTOrdered += totalHTOrdered;
          grandTotalHTDelivered += totalHTDelivered;
          grandTotalHTRemaining += totalHTRemaining;
          grandTotalTTCDelivered += totalTTCDelivered;

          exportData.push({
            bcNumber: bcNumber,
            date: new Date(order.date).toLocaleDateString(),
            client: order.clientName || 'N/A',
            fournisseur: order.supplierName,
            article: item.description,
            qtyOrdered: qOrdered,
            qtyDelivered: qDelivered,
            qtyRemaining: qRemaining,
            prixAchat: price,
            totalHTOrdered,
            totalHTDelivered,
            totalHTRemaining,
            totalTTCDelivered,
            statut: order.status === 'termine' ? 'Livré & Clôturé' : (order.status === 'annule' ? 'Annulé' : 'En attente')
          });
        });
      }
    });

    const headers = [
      { key: 'bcNumber', label: 'N° BC' },
      { key: 'date', label: 'Date' },
      { key: 'client', label: 'Client' },
      { key: 'fournisseur', label: 'Fournisseur' },
      { key: 'article', label: 'Article' },
      { key: 'qtyOrdered', label: 'Qté Commandée' },
      { key: 'qtyDelivered', label: 'Qté Livrée' },
      { key: 'qtyRemaining', label: 'Qté Restante' },
      { key: 'prixAchat', label: 'Prix Achat' },
      { key: 'totalHTOrdered', label: 'Achat Commandé (Total HT)' },
      { key: 'totalHTDelivered', label: 'Achat Réalisé / Livré (Total HT)' },
      { key: 'totalHTRemaining', label: 'Achat Reste à Livrer (Total HT)' },
      { key: 'totalTTCDelivered', label: 'Achat Réalisé / Livré (Total TTC)' },
      { key: 'statut', label: 'Statut' }
    ];

    const summaryRow = [
      'TOTAL',
      '',
      '',
      '',
      '',
      grandTotalQtyOrdered,
      grandTotalQtyDelivered,
      grandTotalQtyRemaining,
      '',
      grandTotalHTOrdered,
      grandTotalHTDelivered,
      grandTotalHTRemaining,
      grandTotalTTCDelivered,
      ''
    ];

    exportToExcel(
      exportData, 
      headers, 
      `commandes_speciales_${new Date().toISOString().split('T')[0]}`,
      {
        title: "Rapport Commandes Spéciales",
        summary: summaryRow
      }
    );
  };

  const handleOpenModal = () => {
    setEditingOrder(null);
    setFormData({
      clientId: null,
      supplierId: '',
      deliveryDate: '',
      bcTitleOverride: 'BON DE COMMANDE',
      sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
      requestRef: '',
      customRecipientDetails: '',
      customSite: '',
      supplierMyClientCode: '',
      customSupervisorName: settings?.supervisorName || 'Guy Roland TONDE',
      customSupervisorTitle: settings?.supervisorTitle || 'SUPERVISEUR',
      customTvaRate: settings?.tvaRate !== undefined ? settings.tvaRate : 18,
      isExempt: false,
      exemptionMention: '',
      printNotes: '',
      customDocNumber: '',
      items: [{ code: '', ref: '', description: '', quantity: '', purchasePrice: '' }]
    });
    setIsModalOpen(true);
  };

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId);
    const clientName = client ? client.name : '';
    const siteCode = clientName.substring(0, 4).toUpperCase();
    setFormData(prev => ({
      ...prev,
      clientId,
      customSite: siteCode,
      requestRef: clientName ? `COMMANDE SPECIALE ${clientName.toUpperCase()}` : ''
    }));
  };

  const handleSupplierChange = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    const recipientDetails = supplier ? [
      supplier.name,
      supplier.address,
      supplier.bp ? `BP : ${supplier.bp}` : null,
      supplier.phone ? `Tél : ${supplier.phone}` : null,
      supplier.rccm ? `RCCM : ${supplier.rccm}` : null,
      supplier.nif ? `IFU : ${supplier.nif}` : null
    ].filter(Boolean).join('\n') : '';

    setFormData(prev => ({
      ...prev,
      supplierId,
      supplierMyClientCode: supplier?.myClientCode || '',
      customRecipientDetails: recipientDetails,
      customDocNumber: ''
    }));
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { code: '', ref: '', description: '', quantity: '', purchasePrice: '' }]
    });
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length <= 1) return;
    const item = formData.items[index];
    if (item.quantity_delivered > 0) {
      showAlert('error', 'Action impossible', `L'article "${item.description}" a déjà fait l'objet de livraisons et ne peut pas être retiré.`);
      return;
    }
    const newItems = [...formData.items];
    newItems.splice(index, 1);
    setFormData({ ...formData, items: newItems });
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    if (field === 'quantity') {
      const val = value === '' ? '' : (parseInt(value) || 0);
      const delivered = newItems[index].quantity_delivered || 0;
      if (val !== '' && val < delivered) {
        showAlert('warning', 'Quantité invalide', `La quantité ne peut pas être inférieure à la quantité déjà livrée (${delivered}).`);
        newItems[index][field] = delivered;
      } else {
        newItems[index][field] = val;
      }
    } else if (field === 'purchasePrice') {
      newItems[index][field] = value === '' ? '' : (parseFloat(value) || 0);
    } else {
      newItems[index][field] = value;
    }
    setFormData({ ...formData, items: newItems });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!hasActiveYear) return showAlert('error', 'Action bloquée', "Aucun exercice fiscal n'est ouvert. Veuillez ouvrir un exercice dans les réglages avant de créer une commande spéciale.");
    
    const { 
      clientId, 
      supplierId, 
      items,
      bcTitleOverride,
      sectionTitle,
      requestRef,
      customRecipientDetails,
      customSite,
      supplierMyClientCode,
      customSupervisorName,
      customSupervisorTitle,
      customTvaRate,
      isExempt,
      exemptionMention,
      printNotes,
      customDocNumber,
      deliveryDate
    } = formData;

    const hasInvalidItem = items.some(it => !it.quantity || (parseInt(it.quantity) || 0) <= 0 || !it.purchasePrice || (parseFloat(it.purchasePrice) || 0) <= 0);
    if (hasInvalidItem) {
      showAlert('warning', 'Champs requis', "Veuillez saisir une quantité et un prix d'achat supérieurs à 0 pour tous les produits.");
      return;
    }

    const metadata = {
      bcTitleOverride,
      sectionTitle,
      requestRef,
      customRecipientDetails,
      customSite,
      supplierMyClientCode,
      customSupervisorName,
      customSupervisorTitle,
      customTvaRate,
      isExempt,
      exemptionMention,
      printNotes,
      customDocNumber
    };

    showConfirm(
      editingOrder ? "Confirmer la modification" : "Confirmez-vous l'enregistrement de cette commande ?",
      "Confirmez-vous avoir bien saisi toutes les informations de cette commande ?",
      async () => {
        closeAlert();
        try {
          if (editingOrder) {
            const res = await fetch(`/api/external-orders/${editingOrder.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('token')}`
              },
              body: JSON.stringify({
                action: 'edit',
                clientId,
                supplierId,
                items,
                metadata,
                deliveryDate: deliveryDate || null
              })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error);
            showAlert('success', 'Succès', "Commande spéciale modifiée avec succès !");
          } else {
            await storage.create('external-orders', { 
              clientId, 
              supplierId, 
              items, 
              storeId: null,
              metadata,
              deliveryDate: deliveryDate || null
            });
            showAlert('success', 'Succès', "Commande spéciale créée avec succès dans le Magasin Global !");
          }
          await loadData();
          setIsModalOpen(false);
          setEditingOrder(null);
        } catch (error) {
          showAlert('error', 'Erreur', error.message || "Erreur lors de l'enregistrement");
        }
      }
    );
  };

  const handleEditOrder = (order) => {
    const meta = order.metadata ? (typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata) : {};
    setEditingOrder(order);
    setFormData({
      clientId: order.clientId,
      supplierId: order.supplierId,
      deliveryDate: order.delivery_date ? order.delivery_date.split('T')[0] : '',
      bcTitleOverride: meta.bcTitleOverride || 'BON DE COMMANDE',
      sectionTitle: meta.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE',
      requestRef: meta.requestRef || '',
      customRecipientDetails: meta.customRecipientDetails || '',
      customSite: meta.customSite || '',
      supplierMyClientCode: meta.supplierMyClientCode || '',
      customSupervisorName: meta.customSupervisorName || settings?.supervisorName || 'Guy Roland TONDE',
      customSupervisorTitle: meta.customSupervisorTitle || settings?.supervisorTitle || 'SUPERVISEUR',
      customTvaRate: meta.customTvaRate !== undefined ? meta.customTvaRate : (settings?.tvaRate !== undefined ? settings.tvaRate : 18),
      isExempt: meta.isExempt || false,
      exemptionMention: meta.exemptionMention || '',
      printNotes: meta.printNotes || '',
      customDocNumber: meta.customDocNumber || '',
      items: order.items.map(item => ({
        id: item.id,
        code: item.code || '',
        ref: item.ref || '',
        description: item.description,
        quantity: item.quantity,
        purchasePrice: item.purchasePrice,
        quantity_delivered: item.quantity_delivered || 0
      }))
    });
    setIsModalOpen(true);
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

  const handlePrint = async (order) => {
    const supplier = suppliers.find(s => s.id === order.supplierId);
    const clientName = order.clientName || 'SPEC';
    const siteCode = clientName.substring(0, 4).toUpperCase();

    // Check if a sequence number is already saved in metadata and matches the correct format
    let generatedNumber = '';
    const currentMeta = order.metadata ? (typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata) : {};
    const isRealSequence = currentMeta.customDocNumber && 
                           /^[A-Za-z]+-[0-9]{3,}-[0-9]{4}-[0-9]{4}$/.test(currentMeta.customDocNumber);
    
    if (isRealSequence) {
      generatedNumber = currentMeta.customDocNumber;
    } else {
      try {
        const seqRes = await fetch(`/api/sequence?type=BC&preview=true&orderId=${order.id}`);
        const seqData = await seqRes.json();
        generatedNumber = formatDocumentNumber(seqData, settings?.bcNumberFormat, clientName);
      } catch (e) {
        generatedNumber = `BC-${order.id.substring(0, 8).toUpperCase()}`;
      }
    }

    const initialPrintData = {
      ...order,
      isBC: true,
      isTemporaryNumber: !isRealSequence,
      bcTitleOverride: currentMeta.bcTitleOverride || 'BON DE COMMANDE',
      sectionTitle: currentMeta.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE',
      requestRef: currentMeta.requestRef || `COMMANDE SPECIALE ${clientName.toUpperCase()}`,
      customDate: currentMeta.customDate || new Date(order.date || Date.now()).toISOString().split('T')[0],
      customCity: currentMeta.customCity || settings?.city || 'Ouagadougou',
      customSite: currentMeta.customSite || siteCode,
      supplierMyClientCode: currentMeta.supplierMyClientCode || supplier?.myClientCode || '',
      customSupervisorName: currentMeta.customSupervisorName || settings?.supervisorName || 'Guy Roland TONDE',
      customSupervisorTitle: currentMeta.customSupervisorTitle || settings?.supervisorTitle || 'SUPERVISEUR',
      customTvaRate: currentMeta.customTvaRate !== undefined ? currentMeta.customTvaRate : (settings?.tvaRate !== undefined ? settings.tvaRate : 18),
      isExempt: currentMeta.isExempt || false,
      exemptionMention: currentMeta.exemptionMention || '',
      printNotes: currentMeta.printNotes || '',
      customDocNumber: generatedNumber,
      customSenderDetails: currentMeta.customSenderDetails || [
        settings?.companyName || 'NS AUTO SARL',
        settings?.address || 'Secteur 05, Parcelle C, Lot 1317 ter',
        settings?.rccm ? `RCCM : ${settings.rccm}` : 'RCCM : BF BBD 2018 B 0372',
        settings?.nif ? `IFU : ${settings.nif}` : 'IFU : 00102506 K',
        settings?.bp || 'BP 1245 Bobo-dioulasso',
        settings?.division || 'Division des Grandes Entreprises',
        settings?.taxSystem || 'Réel Normal d\'Imposition'
      ].filter(Boolean).join('\n'),
      customRecipientDetails: currentMeta.customRecipientDetails || [
        supplier?.name,
        supplier?.address,
        supplier?.bp ? `BP : ${supplier.bp}` : null,
        supplier?.phone ? `Tél : ${supplier.phone}` : null,
        supplier?.rccm ? `RCCM : ${supplier.rccm}` : null,
        supplier?.nif ? `IFU : ${supplier.nif}` : null
      ].filter(Boolean).join('\n'),
      bcColNo: 'N°',
      bcColSite: 'Site',
      bcColDesc: 'Article',
      bcColCode: 'Code',
      bcColRef: 'Référence',
      bcColQty: 'Qté',
      bcColPrice: 'Prix HTVA F. CFA',
      bcColTotal: 'Total HTVA F. CFA',
      hideBcColNo: false,
      hideBcColSite: false,
      hideBcColDesc: false,
      hideBcColCode: false,
      hideBcColRef: false,
      hideBcColQty: false,
      hideBcColPrice: false,
      hideBcColTotal: false
    };

    setPrintData(initialPrintData);
    setIsBCPrintModalOpen(true);
  };

  const handleExecutePrintBC = () => {
    showConfirm(
      "Confirmer l'impression",
      "Confirmez-vous avoir bien saisi toutes les informations avant de lancer l'impression du Bon de Commande ?",
      async () => {
        closeAlert();
        let finalDocNumber = '';
        try {
          let {
            bcTitleOverride,
            sectionTitle,
            requestRef,
            customDate,
            customCity,
            customSite,
            supplierMyClientCode,
            customSupervisorName,
            customSupervisorTitle,
            customTvaRate,
            isExempt,
            exemptionMention,
            printNotes,
            customDocNumber,
            customSenderDetails,
            customRecipientDetails,
            isTemporaryNumber
          } = printData;

          finalDocNumber = customDocNumber;

          if (isTemporaryNumber) {
            try {
              const seqRes = await fetch(`/api/sequence?type=BC&orderId=${printData.id}`);
              const seqData = await seqRes.json();
              const clientName = printData.clientName || 'SPEC';
              finalDocNumber = formatDocumentNumber(seqData, settings?.bcNumberFormat, clientName);
            } catch (e) {
              console.error("Error generating actual sequence:", e);
            }
          }

          const newMeta = {
            bcTitleOverride,
            sectionTitle,
            requestRef,
            customDate,
            customCity,
            customSite,
            supplierMyClientCode,
            customSupervisorName,
            customSupervisorTitle,
            customTvaRate,
            isExempt,
            exemptionMention,
            printNotes,
            customDocNumber: finalDocNumber,
            customSenderDetails,
            customRecipientDetails
          };

          setPrintData(prev => ({
            ...prev,
            customDocNumber: finalDocNumber,
            isTemporaryNumber: false
          }));

          await fetch(`/api/external-orders/${printData.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionStorage.getItem('token')}`
            },
            body: JSON.stringify({ action: 'update_metadata', metadata: newMeta })
          });

          // Update orders state
          setOrders(prevOrders => prevOrders.map(o => o.id === printData.id ? { ...o, metadata: newMeta } : o));
        } catch (err) {
          console.error("Error saving final print metadata:", err);
        }

        setIsBCPrintModalOpen(false);
        setIsPrinting(true);
        const originalTitle = document.title;
        if (finalDocNumber) {
          document.title = finalDocNumber;
        }
        setTimeout(() => {
          window.print();
          document.title = originalTitle;
          setIsPrinting(false);
          setPrintData(null);
        }, 500);
      }
    );
  };

  const handleOpenDeliveryModal = async (order) => {
    setSelectedOrderForDelivery(order);
    const itemsForDelivery = order.items.map(it => ({
      ...it,
      quantity_to_deliver: ''
    }));
    setDeliveryItems(itemsForDelivery);
    setIsDeliveryModalOpen(true);
    setOrderDeliveries([]);
    
    try {
      const res = await fetch(`/api/external-orders/deliveries?orderId=${order.id}`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrderDeliveries(data);
      }
    } catch (err) {
      console.error("Error loading deliveries:", err);
    }
  };

  const handleItemDeliveryChange = (index, value) => {
    const newItems = [...deliveryItems];
    if (value === '') {
      newItems[index].quantity_to_deliver = '';
    } else {
      const val = parseInt(value) || 0;
      const maxVal = newItems[index].quantity - (newItems[index].quantity_delivered || 0);
      newItems[index].quantity_to_deliver = Math.min(maxVal, Math.max(0, val));
    }
    setDeliveryItems(newItems);
  };

  const handleDeliverySubmit = async (e) => {
    e.preventDefault();
    if (!hasActiveYear) return showAlert('error', 'Action bloquée', "Aucun exercice fiscal n'est ouvert.");
    
    const hasItemsToDeliver = deliveryItems.some(it => (it.quantity_to_deliver || 0) > 0);
    if (!hasItemsToDeliver) {
      return showAlert('error', 'Erreur', "Veuillez saisir au moins une quantité supérieure à 0 à livrer.");
    }

    try {
      const res = await fetch('/api/external-orders/deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({
          orderId: selectedOrderForDelivery.id,
          items: deliveryItems
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      showAlert('success', 'Succès', 'Livraison enregistrée avec succès !');
      setIsDeliveryModalOpen(false);
      loadData();
    } catch (err) {
      showAlert('error', 'Erreur', err.message);
    }
  };

  const handlePrintBL = (delivery) => {
    const blPrintData = {
      ...delivery,
      clientName: selectedOrderForDelivery?.clientName || '',
      supplierName: selectedOrderForDelivery?.supplierName || ''
    };
    setPrintBLData(blPrintData);
    setIsPrintingBL(true);
    const originalTitle = document.title;
    if (delivery.bl_number) {
      document.title = delivery.bl_number;
    }
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
      setIsPrintingBL(false);
      setPrintBLData(null);
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
      case 'termine': return <span className="badge badge-success"><CheckCircle size={12} style={{marginRight:4}}/> Livré & Clôturé</span>;
      case 'annule': return <span className="badge badge-danger"><XCircle size={12} style={{marginRight:4}}/> Annulé</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  const filteredOrders = orders.filter(o => {
    const term = searchTerm.toLowerCase();
    
    // Check supplier and client names
    const supplierMatch = (o.supplierName || '').toLowerCase().includes(term);
    const clientMatch = (o.clientName || '').toLowerCase().includes(term);
    
    // Check items description, code, and ref
    const itemsMatch = o.items && o.items.some(i => 
      (i.description || '').toLowerCase().includes(term) ||
      (i.code || '').toLowerCase().includes(term) ||
      (i.ref || i.refCfao || '').toLowerCase().includes(term)
    );
    
    // Check BC number in metadata
    let bcMatch = false;
    if (o.metadata) {
      try {
        const meta = typeof o.metadata === 'string' ? JSON.parse(o.metadata) : o.metadata;
        if (meta.customDocNumber && meta.customDocNumber.toLowerCase().includes(term)) {
          bcMatch = true;
        }
      } catch (e) {}
    }
    
    return supplierMatch || clientMatch || itemsMatch || bcMatch;
  });

  if (isPrinting && printData) {
    if (printData.isBC) {
      const amountHT = printData.items ? printData.items.reduce((sum, item) => {
        const p = parseFloat(item.purchasePrice || 0);
        return sum + (p * (parseInt(item.quantity) || 0));
      }, 0) : 0;

      const tvaValue = printData.customTvaRate !== undefined ? printData.customTvaRate : (settings?.tvaRate !== undefined ? settings.tvaRate : 18);
      const amountTVA = (amountHT * tvaValue) / 100;
      const amountTTC = amountHT + amountTVA;

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

      const numDesignationCols = [printData.hideBcColCode !== true, printData.hideBcColSite !== true, printData.hideBcColDesc !== true, printData.hideBcColRef !== true].filter(Boolean).length;
      const numTotalColsLeft = [printData.hideBcColNo !== true, printData.hideBcColCode !== true, printData.hideBcColSite !== true, printData.hideBcColDesc !== true, printData.hideBcColRef !== true, printData.hideBcColQty !== true, printData.hideBcColPrice !== true].filter(Boolean).length;

      return (
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

          <table style={{ width: '100%', border: 'none', borderCollapse: 'collapse' }}>
            <tfoot style={{ display: 'table-footer-group' }}>
              <tr><td className="master-td" style={{ border: 'none', height: '100px', padding: '0' }}></td></tr>
            </tfoot>
            <tbody style={{ display: 'table-row-group' }}>
              <tr>
                <td className="master-td" style={{ border: 'none', padding: '0' }}>
                  <div style={{ padding: '0px 40px 20px 40px' }}>
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

            <div style={{ border: '1.5pt solid #000', padding: '10px', textAlign: 'center', marginBottom: '40px', backgroundColor: '#f3f4f6', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                <span style={{ textDecoration: 'underline' }}>{printData.bcTitleOverride || 'BON DE COMMANDE'} :</span> &nbsp;&nbsp;
                {printData.customDocNumber}
              </h2>
            </div>

            <table className="header-info" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
              <tbody>
                <tr>
                  <td style={{ width: '50%', verticalAlign: 'top', padding: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.3' }}>
                      <p style={{ margin: '0 0 6px 0' }}><strong>{settings?.companyName}</strong>{printData.supplierMyClientCode ? ` / Code client : ${printData.supplierMyClientCode}` : ''}</p>
                      <p style={{ margin: '0 0 2px 0' }}>{settings?.address}</p>
                      <p style={{ margin: '0 0 2px 0' }}>RCCM : {settings?.rccm || 'BF BBD 2018 B 0372'}</p>
                      <p style={{ margin: '0 0 2px 0' }}>IFU : {settings?.nif || '00102506 K'}</p>
                      <p style={{ margin: '0 0 2px 0' }}>{settings?.bp || 'BP 1245 Bobo-dioulasso'}</p>
                      <p style={{ margin: '0 0 2px 0' }}>{settings?.division || 'Division des Grandes Entreprises'}</p>
                      <p style={{ margin: '0 0 2px 0' }}>{settings?.taxSystem || 'Réel Normal d\'Imposition'}</p>
                    </div>
                  </td>
                  <td style={{ width: '50%', verticalAlign: 'top', padding: '6px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', lineHeight: '1.3' }}>
                      {(printData.customRecipientDetails || '').split('\n').map((line, idx) => (
                        <p key={idx} style={{ margin: idx === 0 ? '0 0 6px 0' : '0 0 2px 0' }}>{line}</p>
                      ))}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td colSpan="2" style={{ textAlign: 'center', backgroundColor: '#e5e7eb', padding: '6px', fontWeight: 'bold', fontSize: '10px', whiteSpace: 'pre-wrap', border: '1.5pt solid #000' }}>
                    {printData.requestRef}
                  </td>
                </tr>
              </tbody>
            </table>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr>
                  {printData.hideBcColNo !== true && <th rowSpan="3" style={{...tableHeaderStyle, width: '30px'}}>{printData.bcColNo || 'N°'}</th>}
                  {numDesignationCols > 0 && (
                    <th colSpan={numDesignationCols} style={{ ...tableHeaderStyle, fontSize: '9px', letterSpacing: '1px', padding: '4px' }}>DESIGNATION</th>
                  )}
                  {printData.hideBcColQty !== true && <th style={{...tableHeaderStyle, width: '50px'}}>{printData.bcColQty || 'Qté'}</th>}
                  {printData.hideBcColPrice !== true && <th style={{...tableHeaderStyle, width: '85px'}}>{printData.bcColPrice || 'P. HTVA'}</th>}
                  {printData.hideBcColTotal !== true && <th style={{...tableHeaderStyle, width: '95px'}}>{printData.bcColTotal || 'Total HTVA'}</th>}
                </tr>
                <tr>
                  {numDesignationCols > 0 && (
                    <th colSpan={numDesignationCols} style={{ ...cellStyle, textAlign: 'left', fontWeight: 'bold', fontSize: '9px', paddingLeft: '8px', backgroundColor: '#fff' }}>
                      {printData.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE'}
                    </th>
                  )}
                  {printData.hideBcColQty !== true && <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>}
                  {printData.hideBcColPrice !== true && <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>}
                  {printData.hideBcColTotal !== true && <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>}
                </tr>
                <tr>
                  {printData.hideBcColCode !== true && <th style={{ ...tableHeaderStyle, width: '80px' }}>{printData.bcColCode || 'Code'}</th>}
                  {printData.hideBcColSite !== true && <th style={{ ...tableHeaderStyle, width: '60px' }}>{printData.bcColSite || 'Site'}</th>}
                  {printData.hideBcColDesc !== true && <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>{printData.bcColDesc || 'Article'}</th>}
                  {printData.hideBcColRef !== true && <th style={{ ...tableHeaderStyle, width: '90px' }}>{printData.bcColRef || 'Référence'}</th>}
                  {printData.hideBcColQty !== true && <th style={tableHeaderStyle}></th>}
                  {printData.hideBcColPrice !== true && <th style={tableHeaderStyle}></th>}
                  {printData.hideBcColTotal !== true && <th style={tableHeaderStyle}></th>}
                </tr>
              </thead>
              <tbody>
                {printData.items && printData.items.map((item, i) => (
                  <tr key={i}>
                    {printData.hideBcColNo !== true && <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>}
                    {printData.hideBcColCode !== true && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.code || '-'}</td>}
                    {printData.hideBcColSite !== true && <td style={{ ...cellStyle, textAlign: 'center' }}>{printData.customSite || ''}</td>}
                    {printData.hideBcColDesc !== true && <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.description}</td>}
                    {printData.hideBcColRef !== true && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.ref || item.refCfao || '-'}</td>}
                    {printData.hideBcColQty !== true && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.quantity}</td>}
                    {printData.hideBcColPrice !== true && <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPrice(item.purchasePrice)}</td>}
                    {printData.hideBcColTotal !== true && <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatPrice((item.purchasePrice || 0) * item.quantity)}</td>}
                  </tr>
                ))}

                <tr>
                  <td colSpan={numTotalColsLeft} style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>MONTANT HTVA</td>
                  {printData.hideBcColTotal !== true && <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>{formatPrice(amountHT)}</td>}
                </tr>
                <tr>
                  <td colSpan={numTotalColsLeft} style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>MONTANT TVA {tvaValue}%</td>
                  {printData.hideBcColTotal !== true && <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>{formatPrice(amountTVA)}</td>}
                </tr>
                <tr style={{ backgroundColor: '#d1d5db' }}>
                  <td colSpan={numTotalColsLeft} style={{ textAlign: 'right', fontWeight: 'bold', padding: '3px 8px', fontSize: '9px' }}>TOTAL NET A PAYER</td>
                  {printData.hideBcColTotal !== true && <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '3px 8px', fontSize: '9px' }}>{formatPrice(amountTTC)}</td>}
                </tr>
              </tbody>
            </table>

            {printData.isExempt && (
              <div style={{ marginTop: '10px', padding: '8px', border: '1pt solid #b91c1c', backgroundColor: '#fff5f5', borderRadius: '4px', textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#b91c1c', textTransform: 'uppercase' }}>
                  EXONÉRATION DE TVA : {printData.exemptionMention || 'Attestation d\'exonération'}
                </p>
              </div>
            )}

            {printData.printNotes && (
              <div style={{ marginTop: '15px', padding: '10px', border: '1pt solid #eee', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Notes / Instructions Spécifiques :</p>
                <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', color: '#333' }}>{printData.printNotes}</p>
              </div>
            )}

            <div style={{ marginTop: '25px' }}>
              <div style={{ fontSize: '11px' }}>
                <p style={{ margin: '0 0 5px 0' }}>Arrêtée la présente facture à la somme de :</p>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', marginLeft: '40px' }}>
                  {numberToWords(Math.trunc(amountTTC))} ( {formatPrice(amountTTC).toLocaleString()} Francs CFA TTC )
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
                <div style={{ textAlign: 'center', width: '220px' }}>
                  {settings?.stampImage && (
                    <div style={{ width: '150px', height: '110px', margin: '0 auto', overflow: 'hidden', position: 'relative' }}>
                      <img src={settings.stampImage} alt="Cachet" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right', minWidth: '250px' }}>
                  <p style={{ fontStyle: 'italic', fontSize: '13px', marginBottom: '5px' }}>Fait à {printData.customCity} le {new Date(printData.customDate).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

                  <div style={{ position: 'relative', marginTop: '10px', height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    {settings?.signatureImage && (
                      <img
                        src={settings.signatureImage}
                        alt="Signature"
                        style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain', marginBottom: '-20px', zIndex: 1 }}
                      />
                    )}
                    <div style={{ marginTop: settings?.signatureImage ? '0' : '50px', zIndex: 2 }}>
                      <p style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '15px', margin: 0 }}>
                        {printData.customSupervisorName}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px' }}>
                        {printData.customSupervisorTitle}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>


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
      );
    }

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

  if (isPrintingBL && printBLData) {
    const itemsList = typeof printBLData.items === 'string' ? JSON.parse(printBLData.items) : printBLData.items;
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
            <h2 style={{ margin: '0', fontSize: '18px' }}>BORDEREAU DE LIVRAISON #{printBLData.bl_number}</h2>
            <p style={{ margin: '5px 0' }}>Date : {new Date(printBLData.created_at || new Date()).toLocaleDateString('fr-FR')}</p>
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <p><strong>Commande Réf :</strong> #{printBLData.external_order_id?.substring(0, 8).toUpperCase()}</p>
          <p><strong>Client :</strong> {printBLData.clientName}</p>
          <p><strong>Fournisseur :</strong> {printBLData.supplierName}</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Description du produit</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Qté Livrée</th>
            </tr>
          </thead>
          <tbody>
            {itemsList && itemsList.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{item.description}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
          <div><strong>Signature Réceptionnaire :</strong></div>
          <div><strong>Signature Expéditeur :</strong></div>
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
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes blink-red {
            0%, 100% { background-color: rgba(239, 68, 68, 0.15); color: #ef4444; }
            50% { background-color: rgba(239, 68, 68, 0.35); color: #b91c1c; }
          }
        `
      }} />
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1>Commandes Spéciales</h1>
            <span className="badge badge-primary" style={{ fontSize: '0.7rem', verticalAlign: 'middle' }}>VUE GLOBALE</span>
          </div>
          <p>Gérez les commandes de matériels et fournitures hors-catalogue auprès de vos fournisseurs externes</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-secondary" onClick={handlePrintSummary} disabled={filteredOrders.length === 0}>
            <Printer size={16} /> Bilan PDF
          </button>
          <button className="btn btn-secondary" onClick={handleExport} disabled={filteredOrders.length === 0}>
            <Download size={16} /> Exporter
          </button>
          {currentUser?.role !== 'observateur' && (
            <button 
              className="btn btn-primary" 
              onClick={handleOpenModal}
            >
              <Plus size={16} /> Nouvelle Commande Spéciale
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value">
            {formatPrice(filteredOrders.filter(o => o.status === 'termine').reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity * i.purchasePrice), 0) : 0), 0))} FCFA
          </div>
          <div className="stat-label">Total Achats HT (Réalisés)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>
            {formatPrice(filteredOrders.filter(o => o.status === 'termine').reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity * i.purchasePrice * 1.18), 0) : 0), 0))} FCFA
          </div>
          <div className="stat-label">Total Achats TTC (Réalisés)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>
            {filteredOrders.filter(o => o.status === 'en_attente' || o.status === 'partiel').length}
          </div>
          <div className="stat-label">Commandes en cours / attente</div>
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
                <th>Fournisseur</th>
                <th>Produits & Détails</th>
                <th>Total Achat (HT)</th>
                <th>Total Achat (TTC)</th>
                <th>Livraison</th>
                <th>Statut</th>
                <th style={{ width: '150px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Aucune commande trouvée.</td></tr>
              ) : (
                filteredOrders.map(order => {
                  const totalAchat = order.items ? order.items.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0) : 0;
                  const totalTTC = totalAchat * 1.18;
                  const isLateDelivery = order.status !== 'termine' && order.status !== 'annule' && order.delivery_date && new Date(order.delivery_date) <= new Date();
                  
                  return (
                    <tr key={order.id}>
                      <td>
                        <div style={{fontWeight:600}}>{new Date(order.date).toLocaleDateString()}</div>
                        {(() => {
                          let bcNumber = '';
                          if (order.metadata) {
                            try {
                              const meta = typeof order.metadata === 'string' ? JSON.parse(order.metadata) : order.metadata;
                              bcNumber = meta.customDocNumber;
                            } catch (e) {}
                          }
                          return bcNumber ? (
                            <span className="badge badge-primary" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'inline-block' }}>
                              {bcNumber}
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'inline-block', opacity: 0.7 }}>
                              Non imprimé
                            </span>
                          );
                        })()}
                      </td>
                      <td>
                        <div style={{fontWeight:600}}>{order.supplierName || '-'}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-start' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                            {order.items ? order.items.length : 0} article(s)
                          </span>
                          <button 
                            className="btn btn-sm btn-outline-primary" 
                            style={{ padding: '4px 8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                            onClick={() => setViewOrderDetails(order)}
                          >
                            <PackageOpen size={14} /> Voir détails
                          </button>
                        </div>
                      </td>
                      <td>
                        <div style={{fontWeight:600}}>{formatPrice(totalAchat)} FCFA</div>
                      </td>
                      <td>
                        <div style={{fontWeight:600, color:'var(--primary)'}}>{formatPrice(totalTTC)} FCFA</div>
                      </td>
                      <td>
                        {order.delivery_date ? (
                          <div style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: 700, 
                            color: isLateDelivery ? '#ef4444' : 'var(--primary)', 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            animation: isLateDelivery ? 'blink-red 1.5s infinite' : 'none'
                          }}>
                            {isLateDelivery ? <AlertCircle size={14} /> : <Truck size={14} />}
                            {new Date(order.delivery_date).toLocaleDateString()}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                        )}
                      </td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td>
                        {order.status === 'en_attente' || order.status === 'partiel' ? (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {currentUser?.role !== 'observateur' && (
                              <>
                                <button className="btn btn-primary" title="Réceptionner / Livrer" onClick={() => handleOpenDeliveryModal(order)}>
                                  <Truck size={16} />
                                </button>
                                <button className="btn btn-secondary" title="Modifier la commande" onClick={() => handleEditOrder(order)}>
                                  <Edit size={16} />
                                </button>
                              </>
                            )}
                            <button className="btn btn-secondary" title="Imprimer le bon de commande" onClick={() => handlePrint(order)}><Printer size={16} /></button>
                            {currentUser?.role !== 'observateur' && <button className="btn btn-warning" title="Annuler" onClick={() => handleAction(order.id, 'annuler')}><XCircle size={16} /></button>}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {order.status === 'termine' && (
                              <button className="btn btn-secondary" title="Consulter les livraisons" onClick={() => handleOpenDeliveryModal(order)}>
                                <Truck size={16} />
                              </button>
                            )}
                            <button className="btn btn-secondary" title="Imprimer le reçu" onClick={() => handlePrint(order)}><Printer size={16} /></button>
                            {currentUser?.role !== 'observateur' && <button className="btn btn-danger-outline" title="Supprimer l'historique" onClick={() => handleAction(order.id, 'delete')}><Trash2 size={16} /></button>}
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
          <div className="modal-content" style={{maxWidth: '950px', width: '95%'}}>
            <div className="modal-header">
              <h3>{editingOrder ? "Modifier la Commande Spéciale" : "Nouvelle Commande Spéciale"}</h3>
              <button className="modal-close" onClick={() => { setIsModalOpen(false); setEditingOrder(null); }}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Fournisseur</label>
                    <select className="form-control" required value={formData.supplierId} onChange={e => handleSupplierChange(e.target.value)}>
                      <option value="">Sélectionner un fournisseur...</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Date de livraison prévue</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={formData.deliveryDate || ''} 
                      onChange={e => setFormData({ ...formData, deliveryDate: e.target.value })} 
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h4 style={{ margin: 0 }}>Détail des produits</h4>
                  <button type="button" className="btn btn-secondary" onClick={handleAddItem} style={{ padding: '0.25rem 0.75rem', fontSize: '0.9rem' }}>
                    <ListPlus size={16} /> Ajouter un produit
                  </button>
                </div>

                <div className="table-wrapper" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
                  <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '10px', fontSize: '0.85rem', width: '90px' }}>Code</th>
                        <th style={{ padding: '10px', fontSize: '0.85rem', width: '110px' }}>Référence</th>
                        <th style={{ padding: '10px', fontSize: '0.85rem', minWidth: '220px' }}>Désignation</th>
                        <th style={{ padding: '10px', fontSize: '0.85rem', width: '80px', textAlign: 'center' }}>Qté</th>
                        <th style={{ padding: '10px', fontSize: '0.85rem', width: '120px', textAlign: 'right' }}>P.A</th>
                        <th style={{ padding: '10px', fontSize: '0.85rem', width: '120px', textAlign: 'right' }}>Total HT</th>
                        <th style={{ padding: '10px', fontSize: '0.85rem', width: '120px', textAlign: 'right' }}>Total TTC</th>
                        <th style={{ padding: '10px', width: '50px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => {
                        const qty = item.quantity || 0;
                        const price = item.purchasePrice || 0;
                        const totalHT = qty * price;
                        const totalTTC = totalHT * 1.18; // 18% TVA

                        return (
                          <tr key={index}>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '6px', fontSize: '0.9rem', width: '100%' }}
                                value={item.code || ''}
                                onChange={e => handleItemChange(index, 'code', e.target.value)}
                                placeholder="Code"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '6px', fontSize: '0.9rem', width: '100%' }}
                                value={item.ref || ''}
                                onChange={e => handleItemChange(index, 'ref', e.target.value)}
                                placeholder="Référence"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                className="form-control"
                                style={{ padding: '6px', fontSize: '0.9rem', width: '100%' }}
                                required
                                value={item.description || ''}
                                onChange={e => handleItemChange(index, 'description', e.target.value)}
                                placeholder="Désignation"
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '6px', textAlign: 'center', fontSize: '0.9rem', width: '100%' }}
                                required
                                min="1"
                                value={item.quantity}
                                onKeyDown={e => { if (e.key.length === 1 && !/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
                                onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                className="form-control"
                                style={{ padding: '6px', textAlign: 'right', fontSize: '0.9rem', width: '100%' }}
                                required
                                min="0"
                                value={item.purchasePrice}
                                onKeyDown={e => { if (e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
                                onChange={e => handleItemChange(index, 'purchasePrice', e.target.value)}
                                placeholder="0"
                              />
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.9rem', verticalAlign: 'middle', padding: '10px' }}>
                              {formatPrice(totalHT)}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--primary)', fontSize: '0.9rem', verticalAlign: 'middle', padding: '10px' }}>
                              {formatPrice(totalTTC)}
                            </td>
                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                              {formData.items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(index)}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#ef4444',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    borderRadius: '50%',
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#fee2e2'}
                                  onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <XCircle size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem', marginTop: '1.5rem', alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Notes / Justificatif</label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="Observations..."
                        value={formData.printNotes || ''}
                        onChange={e => setFormData({ ...formData, printNotes: e.target.value })}
                        style={{ resize: 'none', flex: 1 }}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', padding: '0 1rem' }}
                        onClick={() => showAlert('info', 'Pièce jointe', 'Cette fonctionnalité de téléchargement sera disponible ultérieurement.')}
                      >
                        <FileText size={16} /> Joindre
                      </button>
                    </div>
                  </div>

                  {(() => {
                    const subtotalHT = formData.items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.purchasePrice || 0)), 0);
                    const tvaAmount = subtotalHT * 0.18;
                    const totalTTC = subtotalHT + tvaAmount;

                    return (
                      <div style={{ background: 'var(--bg-light)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem 1.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          <span>Sous-total HT :</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{formatPrice(subtotalHT)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--primary)', fontSize: '0.9rem' }}>
                          <span>TVA (18.00%) :</span>
                          <span style={{ fontWeight: 600 }}>{formatPrice(tvaAmount)}</span>
                        </div>
                        <div style={{ borderTop: '1px solid var(--border-color)', margin: '0.5rem 0', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>TOTAL TTC :</span>
                          <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '1.25rem' }}>{formatPrice(totalTTC)} FCFA</span>
                        </div>
                      </div>
                    );
                  })()}
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

      {isDeliveryModalOpen && selectedOrderForDelivery && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '900px', width: '95%'}}>
            <div className="modal-header">
              <h3>Réceptionner & Enregistrer Livraison</h3>
              <button className="modal-close" onClick={() => setIsDeliveryModalOpen(false)}><X size={20} /></button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem', padding: '1.5rem' }}>
              <div>
                <form onSubmit={handleDeliverySubmit}>
                  <h4 style={{ marginBottom: '1rem' }}>Préparer la livraison courante</h4>
                  <div className="table-wrapper" style={{ maxHeight: '40vh', overflowY: 'auto', marginBottom: '1.5rem' }}>
                    <table style={{ minWidth: '100%' }}>
                      <thead>
                        <tr>
                          <th>Produit</th>
                          <th style={{ textAlign: 'center' }}>Cmdé</th>
                          <th style={{ textAlign: 'center' }}>Livré</th>
                          <th style={{ textAlign: 'center' }}>Restant</th>
                          <th style={{ width: '100px', textAlign: 'center' }}>À livrer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deliveryItems.map((item, idx) => {
                          const remaining = item.quantity - (item.quantity_delivered || 0);
                          return (
                            <tr key={item.id}>
                              <td style={{ fontSize: '0.85rem' }}>{item.description}</td>
                              <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                              <td style={{ textAlign: 'center', color: 'var(--success)' }}>{item.quantity_delivered || 0}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{remaining}</td>
                              <td>
                                <input
                                  type="number"
                                  disabled={remaining <= 0}
                                  className="form-control"
                                  style={{ textAlign: 'center', padding: '4px' }}
                                  min="0"
                                  max={remaining}
                                  value={item.quantity_to_deliver}
                                  onKeyDown={e => { if (e.key.length === 1 && !/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
                                  onChange={e => handleItemDeliveryChange(idx, e.target.value)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="modal-footer" style={{ padding: '0', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setIsDeliveryModalOpen(false)}>
                      {selectedOrderForDelivery.status === 'termine' ? 'Fermer' : 'Annuler'}
                    </button>
                    {selectedOrderForDelivery.status !== 'termine' && (
                      <button type="submit" className="btn btn-primary">Valider la livraison</button>
                    )}
                  </div>
                </form>
              </div>

              <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Historique des Livraisons</h4>
                {orderDeliveries.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-light)', borderRadius: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    <Truck size={24} style={{ marginBottom: '0.5rem', opacity: 0.5 }} /><br/>
                    Aucune livraison n'a encore été effectuée.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '50vh', overflowY: 'auto' }}>
                    {orderDeliveries.map(delivery => {
                      const itemsList = typeof delivery.items === 'string' ? JSON.parse(delivery.items) : delivery.items;
                      return (
                        <div key={delivery.id} style={{ background: 'var(--bg-light)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{delivery.bl_number}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Le {new Date(delivery.created_at).toLocaleDateString()} par {delivery.created_by || 'Système'}
                            </div>
                            <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                              {itemsList?.map((it, idx) => (
                                <span key={idx} style={{ marginRight: '6px', background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
                                  {it.quantity}x {it.description?.substring(0, 15)}...
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isBCPrintModalOpen && printData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px', width: '95%' }}>
            <div className="modal-header">
              <h3>Préparation Impression BC</h3>
              <button className="modal-close" onClick={() => { setIsBCPrintModalOpen(false); setPrintData(null); }}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '1rem 1.5rem' }}>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Titre du Bon de Commande</label>
                  <input
                    type="text"
                    className="form-control"
                    value={printData.bcTitleOverride || ''}
                    onChange={e => setPrintData({ ...printData, bcTitleOverride: e.target.value })}
                    style={{ fontWeight: 'bold', color: 'var(--primary)', padding: '6px 12px' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Titre de Section (Dans le tableau)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={printData.sectionTitle || ''}
                    onChange={e => setPrintData({ ...printData, sectionTitle: e.target.value })}
                    style={{ fontWeight: 'bold', padding: '6px 12px', borderColor: 'var(--primary)' }}
                    placeholder="Ex: FOURNITURE DE PIECES DE RECHANGE"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Référence / Objet (Zone Libre)</label>
                <textarea
                  className="form-control"
                  rows="2"
                  value={printData.requestRef || ''}
                  onChange={e => setPrintData({ ...printData, requestRef: e.target.value })}
                  style={{ fontWeight: '600', padding: '6px 12px', resize: 'vertical' }}
                ></textarea>
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Détails de l'Expéditeur (Bloc de gauche)</label>
                  <textarea
                    className="form-control"
                    rows="5"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: 'var(--primary)', resize: 'vertical' }}
                    value={printData.customSenderDetails || ''}
                    onChange={e => setPrintData({ ...printData, customSenderDetails: e.target.value })}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Détails du Destinataire (Bloc de droite)</label>
                  <textarea
                    className="form-control"
                    rows="5"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: 'var(--primary)', resize: 'vertical' }}
                    value={printData.customRecipientDetails || ''}
                    onChange={e => setPrintData({ ...printData, customRecipientDetails: e.target.value })}
                    placeholder="Nom, Adresse, RCCM, NIF..."
                  ></textarea>
                </div>
              </div>

              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px 150px', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Date</label>
                  <input type="date" className="form-control" style={{ padding: '6px 12px' }} value={printData.customDate || ''} onChange={e => setPrintData({ ...printData, customDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Lieu (Ville)</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px' }} value={printData.customCity || ''} onChange={e => setPrintData({ ...printData, customCity: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Code Site</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px', borderColor: 'var(--primary)' }} value={printData.customSite || ''} onChange={e => setPrintData({ ...printData, customSite: e.target.value.toUpperCase() })} placeholder="Ex: HOUN" />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Notre Code Client</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px', borderColor: 'var(--primary)' }} value={printData.supplierMyClientCode || ''} onChange={e => setPrintData({ ...printData, supplierMyClientCode: e.target.value })} />
                </div>
              </div>

              <div className="grid-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 80px', gap: '0.8rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Signataire (Nom)</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px' }} value={printData.customSupervisorName || ''} onChange={e => setPrintData({ ...printData, customSupervisorName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Titre</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px' }} value={printData.customSupervisorTitle || ''} onChange={e => setPrintData({ ...printData, customSupervisorTitle: e.target.value })} />
                </div>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Statut Fiscal</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', backgroundColor: printData.isExempt ? '#fef2f2' : '#f0fdf4', padding: '8px', borderRadius: '6px', border: `1px solid ${printData.isExempt ? '#fecaca' : '#bbf7d0'}`, transition: 'all 0.2s' }}>
                    <input
                      type="checkbox"
                      checked={printData.isExempt}
                      onChange={e => setPrintData({ ...printData, isExempt: e.target.checked, customTvaRate: e.target.checked ? 0 : (settings?.tvaRate || 18) })}
                    />
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: printData.isExempt ? '#b91c1c' : '#16a34a' }}>
                      {printData.isExempt ? 'EXONÉRÉ' : 'SOUMIS TVA'}
                    </span>
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>TVA %</label>
                  <input type="number" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} min="0" className="form-control" style={{ padding: '6px 12px' }} value={printData.customTvaRate} onChange={e => setPrintData({ ...printData, customTvaRate: parseFloat(e.target.value) || 0 })} disabled={printData.isExempt} />
                </div>
              </div>

              {printData.isExempt && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: '#b91c1c', fontWeight: 'bold' }}>Référence de l'Exonération (Mention légale)</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ padding: '6px 12px', borderColor: '#fecaca', backgroundColor: '#fff5f5' }}
                    value={printData.exemptionMention || ''}
                    onChange={e => setPrintData({ ...printData, exemptionMention: e.target.value })}
                    placeholder="Ex: Suivant Attestation d'Exonération N°123/2024/DGI"
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Numéro de Document (Manuel)</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ padding: '6px 12px', fontWeight: 'bold' }}
                  value={printData.customDocNumber || ''}
                  onChange={e => setPrintData({ ...printData, customDocNumber: e.target.value, isTemporaryNumber: false })}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Notes / Conditions Particulières</label>
                <textarea
                  className="form-control"
                  rows="2"
                  style={{ padding: '8px 12px', fontSize: '0.9rem', resize: 'vertical' }}
                  value={printData.printNotes || ''}
                  onChange={e => setPrintData({ ...printData, printNotes: e.target.value })}
                  placeholder="Ex: Validité de l'offre 30 jours, livraison sous 48h..."
                ></textarea>
              </div>

              <div style={{ padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '1rem' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#1e40af' }}>Libellés des colonnes (BC)</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {[
                    { col: 'bcColNo', hide: 'hideBcColNo', label: 'Col 1 (N°)' },
                    { col: 'bcColSite', hide: 'hideBcColSite', label: 'Col 2 (Site)' },
                    { col: 'bcColDesc', hide: 'hideBcColDesc', label: 'Col 3 (Désignation)' },
                    { col: 'bcColCode', hide: 'hideBcColCode', label: 'Col 4 (Code)' },
                    { col: 'bcColRef', hide: 'hideBcColRef', label: 'Col 5 (Référence)' },
                    { col: 'bcColQty', hide: 'hideBcColQty', label: 'Col 6 (Qté)' },
                    { col: 'bcColPrice', hide: 'hideBcColPrice', label: 'Col 7 (P. HTVA)' },
                    { col: 'bcColTotal', hide: 'hideBcColTotal', label: 'Col 8 (Total HTVA)' }
                  ].map(c => (
                    <div key={c.col} style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fff', padding: '2px', border: '1px solid #bfdbfe', borderRadius: '4px' }}>
                      <input type="checkbox" title="Afficher/Masquer" style={{ marginLeft: '4px', cursor: 'pointer' }} checked={printData[c.hide] !== true} onChange={e => setPrintData({ ...printData, [c.hide]: !e.target.checked })} />
                      <input type="text" className="form-control form-control-sm" style={{ border: 'none', boxShadow: 'none', padding: '2px 4px', width: '100%' }} value={printData[c.col] || ''} onChange={e => setPrintData({ ...printData, [c.col]: e.target.value })} placeholder={c.label} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Code</th>
                      <th style={{ width: '160px' }}>Référence</th>
                      <th>Désignation / Article</th>
                      <th style={{ width: '100px' }}>Qté</th>
                      <th style={{ width: '130px' }}>P.A (HT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.items && printData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ width: '100px' }}><input type="text" className="form-control form-control-sm" value={item.code || ''} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].code = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} placeholder="Code" /></td>
                        <td style={{ width: '160px' }}><input type="text" className="form-control form-control-sm" value={item.ref || item.refCfao || ''} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].ref = e.target.value;
                          newItems[idx].refCfao = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} placeholder="Référence" /></td>
                        <td><input type="text" className="form-control form-control-sm" value={item.description || ''} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].description = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} placeholder="Nom de l'article" /></td>
                        <td style={{ width: '100px' }}><input type="number" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} min="1" className="form-control" style={{ textAlign: 'center', fontWeight: 'bold' }} value={item.quantity} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].quantity = parseInt(e.target.value) || 1;
                          setPrintData({ ...printData, items: newItems });
                        }} /></td>
                        <td style={{ width: '120px' }}><input type="number" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} min="0" className="form-control form-control-sm" style={{ textAlign: 'right' }} value={item.purchasePrice} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].purchasePrice = parseFloat(e.target.value) || 0;
                          setPrintData({ ...printData, items: newItems });
                        }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={() => {
                const newItems = [...printData.items, { id: Math.random().toString(), code: '', description: '', refCfao: '', quantity: 1, purchasePrice: 0, sellPrice: 0 }];
                setPrintData({ ...printData, items: newItems });
              }}>
                <Plus size={14} /> Ajouter une ligne
              </button>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '1.5rem' }}>
                Les calculs de TVA et totaux seront effectués automatiquement sur le document final.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setIsBCPrintModalOpen(false); setPrintData(null); }}>Annuler</button>
              <button className="btn btn-primary" onClick={handleExecutePrintBC}>
                <Printer size={18} /> Lancer l'impression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal View Details */}
      {viewOrderDetails && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3>Détails des articles commandés</h3>
              <button className="modal-close" onClick={() => setViewOrderDetails(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body custom-scrollbar" style={{ maxHeight: '60vh', overflowY: 'auto', padding: '1.5rem' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Article</th>
                    <th>Code / Réf</th>
                    <th style={{ textAlign: 'center' }}>Quantité</th>
                    <th style={{ textAlign: 'right' }}>Prix U. HT</th>
                    <th style={{ textAlign: 'right' }}>Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {viewOrderDetails.items?.length > 0 ? (
                    viewOrderDetails.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{item.description}</td>
                        <td>
                          <div style={{ fontSize: '0.85rem' }}>Code: {item.code || '-'}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Réf: {item.ref || item.refCfao || '-'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div>Cmd: <strong>{item.quantity}</strong></div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--success)' }}>Livré: {item.quantity_delivered || 0}</div>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatPrice(item.purchasePrice)} FCFA</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice((item.quantity * item.purchasePrice) || 0)} FCFA</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Aucun article trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setViewOrderDetails(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
