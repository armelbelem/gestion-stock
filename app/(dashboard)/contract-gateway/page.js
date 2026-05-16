'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import {
  Globe, Plus, Search, FileText, ChevronRight,
  Clock, CheckCircle2, XCircle, AlertTriangle,
  ArrowUpRight, Printer, Download, Eye, Trash2, Edit,
  ShoppingCart, Truck, Package, X, ArrowRight,
  BookOpen, LayoutList, Save, FileSpreadsheet, Paperclip, History, Info,
  Timer, PieChart as LucidePieChart
} from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { useAuth } from '../../providers';
import { hasPermission } from '../../lib/auth';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';

const blinkingStyle = `
  @keyframes blink-red {
    0% { background-color: var(--warning); box-shadow: 0 0 0px var(--danger); }
    50% { background-color: var(--danger); box-shadow: 0 0 10px var(--danger); color: white; }
    100% { background-color: var(--warning); box-shadow: 0 0 0px var(--danger); }
  }
  .badge-urgent {
    animation: blink-red 1.5s infinite;
    font-weight: 800 !important;
  }
  .row-urgent {
    background-color: #fff1f2 !important;
  }
  @media print {
    .no-print, .tabs-header, .page-header, .btn-primary, .btn-secondary { display: none !important; }
    .sidebar, .top-nav { display: none !important; }
    .dashboard-container { padding: 0 !important; margin: 0 !important; }
    .content-card { 
      break-inside: avoid; 
      border: 1px solid #ddd !important; 
      box-shadow: none !important; 
      margin-bottom: 20px !important; 
      padding: 1.2rem !important;
      background-color: white !important;
    }
    body { background: white !important; font-size: 10pt !important; }
    h1, h2, h3 { color: black !important; }
    .print-only { display: block !important; }
    .calendar-print-header { display: block !important; margin-bottom: 20px !important; text-align: center !important; }
    .calendar-container { border: 1px solid #000 !important; }
    .calendar-cell { min-height: 80px !important; border: 1px solid #eee !important; }
  }
  .calendar-print-header { display: none; }
  .print-only { display: none; }
`;

export default function ContractGatewayPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dossiers');
  const [orders, setOrders] = useState([]);

  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const [specialDocs, setSpecialDocs] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(null);
  const [reportItems, setReportItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, limit: 50 });

  // States pour Impression
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData] = useState(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isBLModalOpen, setIsBLModalOpen] = useState(false);
  const [isBLHistoryOpen, setIsBLHistoryOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPrintingBL, setIsPrintingBL] = useState(false);
  const [isBCPrintModalOpen, setIsBCPrintModalOpen] = useState(false);
  const [isBCHistoryOpen, setIsBCHistoryOpen] = useState(false);
  const [currentBCs, setCurrentBCs] = useState([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [currentDeliveries, setCurrentDeliveries] = useState([]);

  // States Données
  const [newOrder, setNewOrder] = useState({ clientId: '', notes: '', items: [], deliveryDate: '' });
  const [catalogItem, setCatalogItem] = useState({ code: '', refCfao: '', name: '', purchasePrice: 0, clientId: '' });

  const [itemSearch, setItemSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogClient, setSelectedCatalogClient] = useState('');
  const [selectedMine, setSelectedMine] = useState(''); // Global mine filter for dossiers
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);

  const speak = (text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  });

  // États pour les filtres du rapport détaillé
  const [reportStartDate, setReportStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportPartnerId, setReportPartnerId] = useState('all');
  const [reportLoading, setReportLoading] = useState(false);

  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });

  // Reset search when modals close
  useEffect(() => {
    if (!isModalOpen && !isCatalogModalOpen) {
      setItemSearch('');
      setSuggestions([]);
    }
  }, [isModalOpen, isCatalogModalOpen]);

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    if (isVoiceEnabled && orders.length > 0) {
      const lateCount = orders.filter(o => o.status !== 'termine' && o.delivery_date && new Date(o.delivery_date) <= new Date()).length;
      if (lateCount > 0) {
        // Petit délai pour éviter les conflits audio au démarrage
        const timer = setTimeout(() => {
          speak(`Attention, vous avez ${lateCount} ${lateCount > 1 ? 'dossiers' : 'dossier'} en retard de livraison.`);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isVoiceEnabled, orders]);

  useEffect(() => {
    if (activeTab === 'rapports') {
      loadStats();
      loadReportItems();
    }
  }, [activeTab, dateRange.start, dateRange.end, reportStartDate, reportEndDate, reportPartnerId]);

  const loadReportItems = async () => {
    setReportLoading(true);
    try {
      const url = `/api/contract-reports/items?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPartnerId !== 'all' ? `&partnerId=${reportPartnerId}` : ''}&storeId=all&_t=${Date.now()}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      const data = await res.json();
      setReportItems(data || []);
    } catch (err) {
      console.error("Error loading report items:", err);
    } finally {
      setReportLoading(false);
    }
  };

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const url = `/api/contract-stats?startDate=${reportStartDate}&endDate=${reportEndDate}${reportPartnerId !== 'all' ? `&partnerId=${reportPartnerId}` : ''}&storeId=all&_t=${Date.now()}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      const data = await res.json();
      console.log('Contract Stats Data Received:', data);
      setStats(data);
    } catch (err) {
      console.error("Error loading stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPartner) {
      loadData();
    }
  }, [dateRange.start, dateRange.end, selectedCatalogClient, selectedPartner, selectedMine, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange.start, dateRange.end, selectedPartner, selectedMine]);

  const loadPartners = async () => {
    try {
      const data = await storage.get('contract-partners');
      setPartners(data || []);
      if (data && data.length > 0) {
        const saved = localStorage.getItem('selectedPartnerId');
        if (saved === 'all') {
          setSelectedPartner({ id: 'all', name: 'Tous les partenaires' });
        } else {
          const partner = data.find(p => p.id === saved) || data[0];
          setSelectedPartner(partner);
        }
      }
    } catch (err) {
      console.error("Error loading partners:", err);
    }
  };

  const loadData = async () => {
    if (!selectedPartner) return;
    setLoading(true);
    try {
      const pId = selectedPartner.id;
      const ordersKey = pId === 'all'
        ? `contract-orders?startDate=${dateRange.start}&endDate=${dateRange.end}&storeId=all${selectedMine ? `&clientId=${selectedMine}` : ''}&page=${currentPage}&limit=50`
        : `contract-orders?startDate=${dateRange.start}&endDate=${dateRange.end}&partnerId=${pId}&storeId=all${selectedMine ? `&clientId=${selectedMine}` : ''}&page=${currentPage}&limit=50`;

      const catalogKey = pId === 'all'
        ? (selectedCatalogClient ? `contract-catalog?clientId=${selectedCatalogClient}&storeId=all` : `contract-catalog?storeId=all`)
        : (selectedCatalogClient ? `contract-catalog?clientId=${selectedCatalogClient}&partnerId=${pId}&storeId=all` : `contract-catalog?partnerId=${pId}&storeId=all`);

      const timestamp = Date.now();
      const [ordersData, specialData, catalogData, clientsData, settingsData, reportData] = await Promise.all([
        storage.get(ordersKey),
        storage.get(`contract-special-docs?partnerId=${pId}&startDate=${dateRange.start}&endDate=${dateRange.end}&storeId=all&t=${timestamp}`),
        storage.get(catalogKey),
        storage.get('clients?storeId=all'),
        storage.get('settings'),
        storage.get(`contract-reports/items?startDate=${dateRange.start}&endDate=${dateRange.end}&partnerId=${pId}&storeId=all`)
      ]);
      setOrders(ordersData?.data || []);
      setPagination(ordersData?.pagination || { total: 0, totalPages: 1, limit: 50 });
      setSpecialDocs(specialData || []);
      setCatalog(catalogData || []);
      setClients(clientsData || []);
      setSettings(settingsData || null);
      setReportItems(reportData || []);

    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportOrderToExcel = async (orderId) => {
    try {
      setLoading(true);
      const fullOrder = await storage.get(`contract-orders/${orderId}?storeId=all`);
      if (!fullOrder || fullOrder.error) throw new Error("Erreur chargement dossier");

      const data = fullOrder.items.map(item => ({
        [`Référence ${selectedPartner?.name || 'Partenaire'}`]: item.code || '-',
        'Désignation': item.description,
        'Quantité': item.quantity,
        'Prix Achat (FCFA)': item.purchasePrice,
        'Total Achat (FCFA)': item.purchasePrice * item.quantity
      }));

      // Ajouter la ligne de total général
      const totalGlobal = data.reduce((sum, row) => sum + row['Total Achat (FCFA)'], 0);
      data.push({
        [`Référence ${selectedPartner?.name || 'Partenaire'}`]: 'TOTAL GÉNÉRAL',
        'Désignation': '',
        'Quantité': '',
        'Prix Achat (FCFA)': '',
        'Total Achat (FCFA)': totalGlobal
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Bon de Commande");
      XLSX.writeFile(wb, `Demande_${selectedPartner?.name || 'Partenaire'}_${String(fullOrder.orderNumber).padStart(3, '0')}.xlsx`);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      showAlert('error', 'Erreur Export', err.message);
    }
  };

  const exportCatalogToExcel = () => {
    const data = catalog.map(item => ({
      'Code': item.code,
      [`Référence ${selectedPartner?.name || 'Partenaire'}`]: item.refCfao,
      'Désignation': item.name,
      'Prix Achat Contrat (FCFA)': item.purchasePrice
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const sheetName = `Catalogue ${selectedPartner?.name || 'Partenaire'}`.substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `Catalogue_${selectedPartner?.name || 'Partenaire'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportOrdersToExcel = () => {
    const data = orders.map(o => {
      const tvaRate = o.tva_rate || 0;
      const purchaseHT = o.contractAmount || 0;
      const purchaseTTC = purchaseHT * (1 + tvaRate / 100);

      const row = {
        'Référence Dossier': String(o.orderNumber).padStart(3, '0'),
        'Client': o.clientName,
        'Statut': o.status,
      };

      if (selectedPartner?.id === 'all') {
        row['Partenaire'] = o.partnerName || 'N/A';
      }

      row['Montant Achat HT'] = purchaseHT;
      row['TVA (%)'] = tvaRate;
      row['Montant Achat TTC'] = purchaseTTC;
      row['Date Création'] = new Date(o.createdAt).toLocaleDateString();

      return row;
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Achats Partenaires");
    XLSX.writeFile(wb, `Dossiers_${selectedPartner?.name || 'Global'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportReportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    // Header rows
    const headerRows = [
      [settings?.companyName || 'NS AUTO'],
      [`BILAN DE CONSOMMATION - ${selectedPartner?.name || 'ACHATS PARTENAIRES'}`],
      [`Période : Du ${reportStartDate} au ${reportEndDate}`],
      [] // Empty line
    ];

    // Data table headers
    const tableHeaders = [['Code', 'Article', 'Prix Unitaire', 'Quantité Vendue', 'Montant Total']];

    // Data rows
    const dataRows = reportItems.map(item => [
      item.refCfao || item.code || '-',
      item.description,
      item.unitPrice,
      item.totalQuantity,
      item.totalHT
    ]);

    // Summary rows
    const totalHT = reportItems.reduce((sum, it) => sum + Number(it.totalHT || 0), 0);
    const totalTVA = reportItems.reduce((sum, it) => sum + Number(it.tvaAmount || 0), 0);
    const totalTTC = reportItems.reduce((sum, it) => sum + Number(it.totalTTC || 0), 0);
    const tvaRate = reportItems[0]?.tvaRate || settings?.tvaRate || 18;

    const summaryRows = [
      [],
      ['', 'TOTAL BRUT (HT)', '', '', totalHT],
      ['', `MONTANT TVA (${tvaRate}%)`, '', '', totalTVA],
      ['', 'TOTAL NET (TTC)', '', '', totalTTC]
    ];

    // Combine all
    const allRows = [...headerRows, ...tableHeaders, ...dataRows, ...summaryRows];
    const ws = XLSX.utils.aoa_to_sheet(allRows);

    // Apply some basic styling if possible (XLSX basic doesn't support much, but we can set column widths)
    ws['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];

    const sheetName = `Bilan ${selectedPartner?.name || 'Achats'}`.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
    XLSX.writeFile(workbook, `Bilan_Achats_${selectedPartner?.name || 'Partenaire'}_${reportStartDate}_au_${reportEndDate}.xlsx`);
  };

  // --- IMPRESSION LOGIC ---
  const handlePrint = async (orderId) => {
    try {
      setLoading(true);
      const fullOrder = await storage.get(`contract-orders/${orderId}`);
      if (!fullOrder || fullOrder.error) throw new Error(fullOrder?.error || "Dossier introuvable");

      const client = clients.find(c => String(c.id) === String(fullOrder.clientId));
      const partner = partners.find(p => String(p.id) === String(fullOrder.partnerId)) || (selectedPartner?.id !== 'all' ? selectedPartner : null);

      setPrintData({
        ...fullOrder,
        clientName: client?.name || fullOrder.clientName || 'Client Non Défini',
        clientCode: client ? client.clientCode : 'Non Défini',
        supplierName: (partner?.name) || 'Fournisseur Non Défini',
        supplierAddress: (partner?.address) || '',
        supplierBP: (partner?.bp) || '',
        supplierPhone: (partner?.phone) || '',
        supplierMyClientCode: (partner?.my_client_code) || 'CL-001',
        supplierRCCM: (partner?.rccm) || '',
        supplierNIF: (partner?.nif) || '',
        bcTitleOverride: partner?.bc_prefix || settings?.bcTitlePrefix || `BON DE COMMANDE N°NSA-${partner?.name?.toUpperCase() || 'PARTENAIRE'}`,
        sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
        requestRef: `REQUEST ${client ? client.name.toUpperCase() : 'GENERAL'}`,
        customDate: new Date().toISOString().split('T')[0],
        customCity: settings?.city || 'Ouagadougou',
        customSupervisorName: partner?.supervisor_name || settings?.supervisorName || 'Guy Roland TONDE',
        customSupervisorTitle: partner?.supervisor_title || settings?.supervisorTitle || 'Superviseur Général',
        customTvaRate: settings?.tvaRate !== undefined ? settings.tvaRate : 18,
        isExempt: false,
        exemptionMention: '',
        items: fullOrder.items || [],
        customRecipientDetails: [
          partner?.name,
          partner?.address,
          partner?.bp ? `BP : ${partner.bp}` : null,
          partner?.phone ? `Tél : ${partner.phone}` : null,
          partner?.rccm ? `RCCM : ${partner.rccm}` : null,
          partner?.nif ? `IFU : ${partner.nif}` : null
        ].filter(Boolean).join('\n'),
        // Colonnes personnalisées
        bcColNo: selectedPartner?.bc_col_no || 'N°',
        bcColSite: selectedPartner?.bc_col_site || 'Site',
        bcColDesc: selectedPartner?.bc_col_desc || 'Article',
        bcColCode: selectedPartner?.bc_col_code || 'Code',
        bcColRef: selectedPartner?.bc_col_ref || 'Ref. CFAO',
        bcColQty: selectedPartner?.bc_col_qty || 'Qté',
        bcColPrice: selectedPartner?.bc_col_price || 'Prix HTVA F. CFA',
        bcColTotal: selectedPartner?.bc_col_total || 'Total HTVA F. CFA'
      });

      setLoading(false);
      setIsBCPrintModalOpen(true);
    } catch (err) {
      setLoading(false);
      showAlert('error', 'Erreur Impression', "Impossible de charger les données : " + err.message);
    }
  };

  const handleExecutePrintBC = async () => {
    setIsBCPrintModalOpen(false);

    // Save to history if it's a standard order (or special if needed)
    if (printData && !printData.isCatalog) {
      try {
        const token = sessionStorage.getItem('token');
        const dateObj = printData.customDate ? new Date(printData.customDate) : new Date();

        // Custom Numbering logic
        const format = settings?.bcNumberFormat || 'BC-{ID}-{DATE}';
        const dateStr = dateObj.toLocaleDateString('fr-FR').replace(/\//g, '-');
        const bcNumber = format
          .replace('{ID}', String(printData.orderNumber || 'SPEC').padStart(3, '0'))
          .replace('{DATE}', dateStr)
          .replace('{YEAR}', dateObj.getFullYear())
          .replace('{CLIENT}', (printData.clientName || 'GEN').substring(0, 3).toUpperCase());

        await fetch('/api/contract-bc-history', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            orderId: printData.id,
            partnerId: printData.partnerId || selectedPartner?.id,
            bcNumber: bcNumber,
            title: printData.bcTitleOverride,
            requestRef: printData.requestRef,
            items: printData.items
          })
        });
      } catch (err) {
        console.error("Erreur sauvegarde historique BC:", err);
      }
    }

    // Save if it's a special document
    if (printData?.isSpecial) {
      handleSaveSpecialDoc(printData);
    }

    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintData(null);
    }, 800);
  };

  const handlePrintSpecial = (doc, type) => {
    setPrintData({
      ...doc,
      status: type === 'BC' ? 'demande' : 'termine', // Pour déclencher les bons blocs du template
      isSpecial: true,
      specialType: type,
      orderNumber: doc.orderNumber || (doc.id ? String(doc.id).substring(0, 8) : Date.now().toString().slice(-6)),
      bcTitleOverride: type === 'BC' ? (doc.title || selectedPartner?.bc_prefix || 'BON DE COMMANDE SPÉCIAL') : '',
      sectionTitle: type === 'BC' ? 'FOURNITURE DE PIECES DE RECHANGE' : '',
      blTitleOverride: type === 'BL' ? (doc.title || selectedPartner?.bl_prefix || 'BORDEREAU DE LIVRAISON SPÉCIAL') : '',
      requestRef: doc.requestRef || `REQUEST ${(doc.clientName || 'GENERAL').toUpperCase()}`,
      customDate: new Date().toISOString().split('T')[0],
      customCity: settings?.city || 'Ouagadougou',
      customSupervisorName: type === 'BC'
        ? (selectedPartner?.id !== 'all' ? selectedPartner?.supervisor_name : null) || settings?.supervisorName || 'Guy Roland TONDE'
        : (selectedPartner?.id !== 'all' ? selectedPartner?.bl_supervisor_name : null) || settings?.blSupervisorName || 'Huges Christian SOW',
      customSupervisorTitle: type === 'BC'
        ? (selectedPartner?.id !== 'all' ? selectedPartner?.supervisor_title : null) || settings?.supervisorTitle || 'Superviseur Général'
        : (selectedPartner?.id !== 'all' ? selectedPartner?.bl_supervisor_title : null) || settings?.blSupervisorTitle || 'Responsable Logistique Adjoint',
      customTvaRate: settings?.tvaRate !== undefined ? settings.tvaRate : 18,
      items: doc.items || [],
      // Pour les docs libres, on veut exactement ce qui est saisi dans les zones de texte
      supplierName: doc.supplierName || (selectedPartner?.id !== 'all' ? selectedPartner?.name : null) || 'NS AUTO',
      supplierAddress: doc.supplierName ? '' : (selectedPartner?.id !== 'all' ? selectedPartner?.address : null) || '',
      supplierBP: doc.supplierName ? '' : (selectedPartner?.id !== 'all' ? selectedPartner?.bp : null) || '',
      supplierPhone: doc.supplierName ? '' : (selectedPartner?.id !== 'all' ? selectedPartner?.phone : null) || '',
      supplierMyClientCode: (selectedPartner?.id !== 'all' ? selectedPartner?.my_client_code : null) || 'CL-001',
      supplierRCCM: doc.supplierName ? '' : (selectedPartner?.id !== 'all' ? selectedPartner?.rccm : null) || '',
      supplierNIF: doc.supplierName ? '' : (selectedPartner?.id !== 'all' ? selectedPartner?.nif : null) || '',
      // La référence ne doit pas prendre toute l'adresse (on prend juste la 1ère ligne)
      requestRef: doc.requestRef || `REQUEST ${(doc.clientName?.split('\n')[0] || 'GENERAL').toUpperCase()}`
    });

    if (type === 'BC') {
      setIsBCPrintModalOpen(true);
    } else {
      setIsBLModalOpen(true);
    }
  };

  const handleSaveSpecialDoc = async (doc) => {
    try {
      // On évite les doublons si on ré-imprime un doc existant
      const existing = specialDocs.find(d => d.id === doc.id);
      if (existing) return;

      const savedDoc = await storage.create('contract-special-docs', {
        ...doc,
        id: undefined, // Let the server decide
        partnerId: selectedPartner.id
      });

      // Update local state with the real server doc (with UUID)
      if (savedDoc && savedDoc.id) {
        setSpecialDocs(prev => [savedDoc, ...prev]);
      }
      loadData();
    } catch (err) {
      console.error("Erreur sauvegarde doc spécial:", err);
    }
  };

  const deleteSpecialDoc = async (id) => {
    setAlertModal({
      open: true, type: 'confirm', title: 'Supprimer ?', message: 'Supprimer ce document spécial de l\'historique ?',
      onConfirm: async () => {
        closeAlert();
        try {
          if (!id) throw new Error("ID de document manquant");
          await storage.remove('contract-special-docs', id);
          // Mise à jour locale immédiate filtrée proprement
          setSpecialDocs(prev => prev.filter(d => String(d.id) !== String(id)));
          loadData();
          showAlert('success', 'Supprimé', 'Le document a été retiré.');
        } catch (err) {
          showAlert('error', 'Erreur', 'Impossible de supprimer le document.');
        }
      }
    });
  };

  const handleFileUpload = async (id, tableType) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.jpg,.jpeg,.png,.doc,.docx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        return showAlert('error', 'Fichier trop volumineux', 'La taille maximale autorisée est de 5Mo.');
      }

      const formData = new FormData();
      formData.append('file', file);

      try {
        setLoading(true);
        const token = sessionStorage.getItem('token');
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': token ? `Bearer ${token}` : '' },
          body: formData
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          const apiPath = tableType === 'special'
            ? `/api/contract-special-docs/${id}`
            : tableType === 'bc'
              ? `/api/contract-bc-history?id=${id}`
              : `/api/deliveries?id=${id}`;

          const patchRes = await fetch(apiPath, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({ attachment: uploadData.url })
          });

          if (!patchRes.ok) throw new Error("Échec de la liaison du fichier");

          await loadData();

          // Rafraîchir spécifiquement les listes des modals
          if (tableType === 'bc' && selectedOrder?.id) {
            const updatedBCs = await storage.get(`contract-bc-history?orderId=${selectedOrder.id}`);
            setCurrentBCs(updatedBCs);
          } else if (tableType === 'bl' && selectedOrder?.id) {
            const updatedBLs = await storage.get(`deliveries?orderId=${selectedOrder.id}`);
            setCurrentDeliveries(updatedBLs);
          } else if (tableType === 'special') {
            const updated = await storage.list('contract-special-docs');
            setSpecialDocs(updated);
          }

          showAlert('success', 'Fichier joint', 'Le document a été téléchargé et lié avec succès.');
        } else {
          throw new Error(uploadData.error || 'Erreur lors du téléchargement');
        }
      } catch (err) {
        console.error("Erreur upload:", err);
        showAlert('error', 'Erreur', 'Échec du téléchargement du fichier.');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  const loadDeliveries = async (orderId) => {
    try {
      setSelectedOrder({ id: orderId });
      const data = await storage.get(`deliveries?orderId=${orderId}`);
      setCurrentDeliveries(data);
      setIsBLHistoryOpen(true);
    } catch (err) {
      showAlert('error', 'Erreur', "Impossible de charger l'historique des livraisons.");
    }
  };

  const handleDeleteDelivery = (deliveryId, orderId) => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Supprimer ce BL ?',
      message: 'Voulez-vous vraiment supprimer ce Bordereau de Livraison ? Cette action est irréversible.',
      onConfirm: async () => {
        closeAlert();
        try {
          setLoading(true);
          const token = sessionStorage.getItem('token');
          const res = await fetch(`/api/deliveries?id=${deliveryId}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          });
          if (!res.ok) throw new Error("Erreur lors de la suppression");

          showAlert('success', 'Supprimé', 'Le BL a été supprimé.');
          loadDeliveries(orderId);
        } catch (err) {
          showAlert('error', 'Erreur', err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  const loadBCHistory = async (orderId) => {
    try {
      setSelectedOrder({ id: orderId });
      const token = sessionStorage.getItem('token');
      const res = await fetch(`/api/contract-bc-history?orderId=${orderId}&storeId=all`, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      const data = await res.json();
      setCurrentBCs(data);
      setIsBCHistoryOpen(true);
    } catch (err) {
      showAlert('error', 'Erreur', "Impossible de charger l'historique des bons de commande.");
    }
  };

  const deleteBCHistory = async (id, orderId) => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Supprimer ce BC ?',
      message: 'Voulez-vous vraiment supprimer cet historique de Bon de Commande ?',
      onConfirm: async () => {
        closeAlert();
        try {
          const token = sessionStorage.getItem('token');
          const res = await fetch(`/api/contract-bc-history?id=${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          });
          if (!res.ok) throw new Error("Erreur lors de la suppression");
          showAlert('success', 'Supprimé', 'Le BC a été supprimé de l\'historique.');
          loadBCHistory(orderId);
        } catch (err) {
          showAlert('error', 'Erreur', err.message);
        }
      }
    });
  };

  const handleOpenBLModal = async (orderId) => {
    try {
      setLoading(true);
      const fullOrder = await storage.get(`contract-orders/${orderId}?storeId=all`);
      if (!fullOrder || fullOrder.error) throw new Error("Dossier introuvable");

      const client = clients.find(c => String(c.id) === String(fullOrder.clientId));
      const fallbackName = client?.name || fullOrder.clientName || '';
      const defaultPrefix = selectedPartner?.bl_prefix || settings?.blTitlePrefix || (fallbackName ? `BORDEREAU NSA-${fallbackName.substring(0, 8).toUpperCase()}` : 'BORDEREAU DE LIVRAISON');

      setPrintData({
        ...fullOrder,
        client: client || null,
        clientName: fallbackName || 'Client Non Défini',
        clientCode: client ? client.clientCode : 'Non Défini',
        blTitleOverride: defaultPrefix,
        requestRef: `URGENT REQUEST ${fallbackName ? fallbackName.toUpperCase() : 'GENERAL'}`,
        customDate: new Date().toISOString().split('T')[0],
        customCity: settings?.city || 'Ouagadougou',
        customSupervisorName: selectedPartner?.bl_supervisor_name || settings?.blSupervisorName || 'Huges Christian SOW',
        customSupervisorTitle: selectedPartner?.bl_supervisor_title || settings?.blSupervisorTitle || 'Responsable Logistique Adjoint',
        items: (fullOrder.items || []).map(it => ({
          description: it.description,
          code: it.code,
          refCfao: it.refCfao || it.code,
          quantity: it.quantity
        })),
        customRecipientDetails: [
          client?.name,
          client?.address,
          client?.bp ? `BP : ${client.bp}` : null,
          client?.phone ? `Tél : ${client.phone}` : null,
          client?.rccm ? `RCCM : ${client.rccm}` : null,
          client?.nif ? `IFU : ${client.nif}` : null
        ].filter(Boolean).join('\n'),
        // Colonnes personnalisées BL
        blColNo: selectedPartner?.bl_col_no || 'N',
        blColSite: selectedPartner?.bl_col_site || 'Site',
        blColDesc: selectedPartner?.bl_col_desc || 'Article',
        blColCode: selectedPartner?.bl_col_code || 'Code',
        blColRef: selectedPartner?.bl_col_ref || 'Ref',
        blColQty: selectedPartner?.bl_col_qty || 'Qté',
        sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE'
      });
      setIsBLModalOpen(true);
    } catch (err) {
      showAlert('error', 'Erreur', "Impossible de charger les données : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAndPrintBL = async (deliveryData) => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');

      const dateObj = deliveryData.customDate ? new Date(deliveryData.customDate) : new Date();
      const format = settings?.blNumberFormat || 'BL-{ID}-{DATE}';
      const dateStr = dateObj.toLocaleDateString('fr-FR').replace(/\//g, '-');
      const blNumber = format
        .replace('{ID}', String(deliveryData.orderNumber).padStart(3, '0'))
        .replace('{DATE}', dateStr)
        .replace('{YEAR}', dateObj.getFullYear())
        .replace('{CLIENT}', (deliveryData.clientName || 'GEN').substring(0, 3).toUpperCase());

      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          orderId: deliveryData.id,
          blNumber: blNumber,
          items: deliveryData.items
        })
      });

      if (!res.ok) throw new Error("Erreur lors de la sauvegarde du BL");

      // Save to special history if it's a special doc
      if (deliveryData.isSpecial) {
        handleSaveSpecialDoc(deliveryData);
      }

      setPrintData(deliveryData);
      setIsPrintingBL(true);
      setIsBLModalOpen(false);
      setLoading(false);

      setTimeout(() => {
        window.print();
        setIsPrintingBL(false);
        setPrintData(null);
      }, 800);
    } catch (err) {
      setLoading(false);
      showAlert('error', 'Erreur', err.message);
    }
  };

  const handlePrintBL = (deliveryData) => {
    setPrintData(deliveryData);
    setIsPrintingBL(true);
    setIsBLModalOpen(false);

    setTimeout(() => {
      window.print();
      setIsPrintingBL(false);
      setPrintData(null);
    }, 800);
  };

  const handlePrintCatalog = () => {
    setPrintData({
      isCatalog: true,
      title: 'CATALOGUE PRODUITS CFAO',
      items: catalog.map(i => ({
        code: i.code,
        refCfao: i.refCfao,
        description: i.name,
        purchasePrice: i.purchasePrice
      }))
    });
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintData(null);
    }, 800);
  };

  // --- CATALOGUE MANAGEMENT ---
  const handleImportCatalog = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        let createdCount = 0;
        let updatedCount = 0;

        for (const row of data) {
          const keys = Object.keys(row);
          const getVal = (keywords) => {
            const normalize = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s\n\r]/g, '');
            const key = keys.find(k => {
              const cleanKey = normalize(k);
              return keywords.some(kw => cleanKey.includes(normalize(kw)));
            });
            return key ? String(row[key] || '').trim() : '';
          };

          const code = getVal(['code']);
          const refCfao = getVal(['refcfao', 'référence', 'ref']);
          const name = getVal(['désignation', 'designation', 'designiation', 'nom', 'article', 'libellé']);
          const rawPrice = getVal(['prixachatcontrat', 'prixachat', 'pa', 'prix', 'montant', 'achatcontrat']);
          const mineName = getVal(['mine', 'site', 'client']);

          const price = Math.round(parseFloat(rawPrice.replace(/\s/g, '').replace(',', '.')) || 0);

          if (!name) continue;

          // Trouver le client par son nom si présent
          let clientId = '';
          if (mineName) {
            const client = clients.find(c => c.name.toLowerCase().includes(mineName.toLowerCase()));
            if (client) clientId = client.id;
          }

          // Rechercher si l'article existe déjà (même Réf CFAO ou même Code pour CE client spécifique)
          const existingItem = catalog.find(item =>
            (
              (refCfao && String(item.refCfao).trim() === refCfao) ||
              (code && String(item.code).trim() === code)
            ) &&
            String(item.clientId || '') === String(clientId || '')
          );

          const itemData = {
            code: code,
            refCfao: refCfao,
            name: name,
            purchasePrice: price,
            clientId: clientId,
            partnerId: selectedPartner.id
          };

          if (existingItem) {
            await storage.update('contract-catalog', existingItem.id, itemData);
            updatedCount++;
          } else {
            await storage.create('contract-catalog', itemData);
            createdCount++;
          }
        }

        setLoading(false);
        setIsImportModalOpen(false);
        loadData();
        showAlert('success', 'Importation Terminée', `${createdCount} nouveaux articles ajoutés, ${updatedCount} articles mis à jour.`);
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setLoading(false);
      showAlert('error', 'Erreur Import', err.message);
    }
  };

  const handleSaveCatalogItem = async () => {
    if (!catalogItem.name) return showAlert('error', 'Erreur', 'Le nom du produit est requis.');
    try {
      if (catalogItem.id) {
        await storage.update('contract-catalog', catalogItem.id, catalogItem);
      } else {
        await storage.create('contract-catalog', { ...catalogItem, partnerId: selectedPartner.id });
      }
      setIsCatalogModalOpen(false);
      setCatalogItem({ code: '', refCfao: '', name: '', purchasePrice: 0, clientId: '' });
      loadData();
      showAlert('success', 'Succès', 'Article enregistré.');
    } catch (err) {
      showAlert('error', 'Erreur', err.message);
    }
  };

  const deleteCatalogItem = (id) => {
    setAlertModal({
      open: true, type: 'confirm', title: 'Supprimer ?', message: 'Confirmer la suppression ?',
      onConfirm: async () => { closeAlert(); await storage.remove('contract-catalog', id); loadData(); }
    });
  };

  // --- ORDER MANAGEMENT ---
  const handleItemSearch = (val) => {
    setItemSearch(val);
    if (val.length > 1) {
      const filtered = catalog.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(val.toLowerCase()) ||
          (a.code && a.code.toLowerCase().includes(val.toLowerCase())) ||
          (a.refCfao && a.refCfao.toLowerCase().includes(val.toLowerCase()));

        // Si un client est sélectionné pour le dossier, on filtre aussi par clientId
        // On garde aussi les articles "globaux" (clientId null)
        const matchesClient = !newOrder.clientId || !a.clientId || String(a.clientId) === String(newOrder.clientId);

        return matchesSearch && matchesClient;
      }).slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const addItemFromCatalog = (article) => {
    const item = {
      articleId: article ? article.id : null,
      code: article ? article.code : '',
      refCfao: article ? article.refCfao : '',
      description: article ? article.name : itemSearch,
      quantity: 1,
      purchasePrice: article ? article.purchasePrice || 0 : 0,
      sellPrice: 0
    };
    setNewOrder(prev => ({ ...prev, items: [...prev.items, item] }));
    setItemSearch('');
    setSuggestions([]);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        setNewOrder(prev => ({ ...prev, attachment: data.url }));
        showAlert('success', 'Fichier prêt', 'Le document a été téléchargé.');
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      showAlert('error', 'Upload échoué', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!newOrder.clientId) return showAlert('error', 'Erreur', 'Sélectionnez un client.');
    try {
      const orderToSave = {
        ...newOrder,
        items: newOrder.items.map(item => ({
          ...item,
          sellPrice: item.sellPrice || item.purchasePrice // Default to PA if PV is 0
        }))
      };

      if (isEditing && selectedOrder) {
        await storage.update('contract-orders', selectedOrder.id, orderToSave);
        showAlert('success', 'Dossier Modifié', 'Le dossier a été mis à jour.');
      } else {
        await storage.create('contract-orders', { ...orderToSave, partnerId: selectedPartner.id });
        showAlert('success', 'Dossier Créé', 'La demande a été enregistrée.');
      }

      setIsModalOpen(false);
      setIsEditing(false);
      setSelectedOrder(null);
      setNewOrder({ clientId: '', notes: '', items: [], deliveryDate: '' });
      loadData();
    } catch (err) {
      showAlert('error', 'Erreur', err.message);
    }
  };

  const handleEditOrder = async (orderId) => {
    try {
      setLoading(true);
      const fullOrder = await storage.get(`contract-orders/${orderId}`);
      setSelectedOrder(fullOrder);
      setNewOrder({
        clientId: fullOrder.clientId,
        notes: fullOrder.notes,
        items: fullOrder.items,
        deliveryDate: fullOrder.delivery_date ? fullOrder.delivery_date.split('T')[0] : ''
      });
      setIsEditing(true);
      setIsModalOpen(true);
    } catch (err) {
      showAlert('error', 'Erreur', 'Impossible de charger les détails.');
    } finally {
      setLoading(false);
    }
  };

  const deleteOrder = (id) => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Supprimer le dossier ?',
      message: 'Attention, cette action est irréversible et supprimera tout l\'historique de ce dossier.',
      onConfirm: async () => {
        closeAlert();
        try {
          await storage.remove('contract-orders', id);
          loadData();
          showAlert('success', 'Supprimé', 'Le dossier a été supprimé.');
        } catch (err) {
          showAlert('error', 'Erreur', err.message);
        }
      }
    });
  };

  const viewOrder = async (orderId) => {
    try {
      setLoading(true);
      const fullOrder = await storage.get(`contract-orders/${orderId}`);
      setSelectedOrder(fullOrder);
      setIsViewModalOpen(true);
    } catch (err) {
      showAlert('error', 'Erreur', 'Impossible de charger les détails.');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (id, newStatus) => {
    const label = newStatus === 'termine' ? 'Clôturer' : 'Valider';
    setAlertModal({
      open: true,
      type: 'confirm',
      title: `${label} le dossier ?`,
      message: `Voulez-vous passer ce dossier au statut : ${newStatus.replace('_', ' ')} ?`,
      onConfirm: async () => {
        closeAlert();
        setLoading(true);
        try {
          await storage.update('contract-orders', id, { status: newStatus });
          await loadData();
          showAlert('success', 'Mis à jour', 'Le statut a été modifié.');
        } catch (err) {
          showAlert('error', 'Erreur', err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // --- HELPERS POUR IMPRESSION ---
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

  if (isPrinting && printData) {
    if (printData.isCatalog) {
      // Garder l'ancien format pour le catalogue
      return (
        <div className="receipt-print-only" style={{ display: 'block', padding: 'px', backgroundColor: 'white' }}>
          {/* Header Rebrand - Perfect Alignment */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '20px' }}>
            {settings?.logo ? (
              <img
                src={settings.logo}
                alt="Logo"
                style={{ maxHeight: '100px', marginRight: '2px' }}
              />
            ) : (
              <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase', marginRight: '15px' }}>{settings?.companyName || 'NS AUTO'}</h1>
            )}
            <div style={{ flex: 1, height: '2.5pt', backgroundColor: '#b91c1c', marginBottom: '11px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
          </div>
          <h1 style={{ textAlign: 'center', fontSize: '22px', marginTop: '10px' }}>CATALOGUE ARTICLES</h1>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Code</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Réf CFAO</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Désignation</th>
                {hasPermission(user, 'stock', 'view_cost_price') && <th style={{ border: '1px solid #ddd', padding: '8px' }}>P.A Contrat</th>}
              </tr>
            </thead>
            <tbody>
              {printData.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{it.code}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{it.refCfao}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{it.description}</td>
                  {hasPermission(user, 'stock', 'view_cost_price') && <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{(it.purchasePrice || 0).toLocaleString()}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const isPurchaseDoc = ['demande', 'facture_recue', 'po_envoye', 'bc_genere'].includes(printData.status);

    // Calcul robuste du montant HT si non présent dans printData (ex: Documents Libres)
    let amountHT = isPurchaseDoc ? (printData.contractAmount || 0) : (printData.totalAmount || 0);

    if (amountHT === 0 && printData.items && printData.items.length > 0) {
      amountHT = printData.items.reduce((sum, item) => {
        const p = parseFloat(isPurchaseDoc ? (item.purchasePrice || 0) : (item.sellPrice || item.purchasePrice || 0));
        return sum + (p * (parseInt(item.quantity) || 0));
      }, 0);
    }

    const tvaValue = printData.customTvaRate !== undefined ? printData.customTvaRate : (settings?.tvaRate !== undefined ? settings.tvaRate : 18);
    const amountTVA = (amountHT * tvaValue) / 100;
    const amountTTC = amountHT + amountTVA;

    const formatPrice = (val) => {
      if (val === undefined || val === null) return '0';
      const num = Number(val) || 0;
      if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
        return Math.trunc(num).toLocaleString();
      }
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };


    // Robust styles for print borders
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

    // Master Table Styles for layout
    const masterTableStyle = {
      width: '100%',
      borderCollapse: 'collapse',
      border: 'none',
      minHeight: '27cm'
    };

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
        {/* CSS FORCÉ POUR L'IMPRESSION */}
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            .receipt-print-only { 
              width: 21cm !important; 
              min-height: 29.7cm !important; 
              padding: 0 !important; 
              margin: 0 !important; 
              position: relative !important;
            }
            .receipt-print-only table { border-collapse: collapse !important; width: 100% !important; }
            .receipt-print-only th, .receipt-print-only td { border: 1.5pt solid black !important; -webkit-print-color-adjust: exact !important; }
            .receipt-print-only .no-border td { border: none !important; }
            .receipt-print-only .header-info td { border: 1.5pt solid black !important; }
            .red-footer { 
              position: fixed !important; 
              bottom: 0 !important; 
              left: 0 !important; 
              right: 0 !important; 
              width: 21cm !important;
              margin: 0 auto !important;
              background-color: #b91c1c !important;
              color: white !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              z-index: 9999 !important;
              border-top: 1pt solid #b91c1c !important;
            }
            /* Fallback si background-graphics est off */
            .red-footer p { color: white !important; }
          }
        `}} />

        <div style={{ padding: '20px 40px' }}>
          {/* Header Rebrand - Perfect Alignment */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '12px' }}>
            {settings?.logo && (
              <img
                src={settings?.logo}
                alt="Logo"
                style={{ maxHeight: '100px', marginRight: '2px' }}
              />
            )}
            <div style={{ flex: 1, height: '2.5pt', backgroundColor: '#b91c1c', marginBottom: '11px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
          </div>

          <div style={{ border: '1.5pt solid #000', padding: '10px', textAlign: 'center', marginBottom: '15px', backgroundColor: '#f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              {printData.bcTitleOverride || settings?.bcTitlePrefix || 'BON DE COMMANDE'} : &nbsp;&nbsp;
              {printData.customDocNumber || (() => {
                const d = new Date(printData.customDate || Date.now());
                const jjmm = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
                const an = d.getFullYear();
                const num = String(printData.orderNumber || 'SPEC').padStart(3, '0');
                return `BC-${num}-${jjmm}-${an}`;
              })()}
            </h2>
          </div>

          {/* Info Blocks Grid */}
          <table className="header-info" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '6px' }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '9px' }}><strong>{settings?.companyName} SARL</strong> / Code client : {printData.supplierMyClientCode}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.address}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>RCCM : {settings?.rccm || 'BF BBD 2018 B 0372'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>IFU : {settings?.nif || '00102506 K'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.bp || 'BP 1245 Bobo-dioulasso'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.division || 'Division des Grandes Entreprises'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.taxSystem || 'Réel Normal d\'Imposition'}</p>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '6px' }}>
                  <div style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                    {printData.customRecipientDetails ? (
                      <div style={{ fontWeight: 'bold' }}>{printData.customRecipientDetails}</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>
                          {printData.isSpecial
                            ? (printData.clientName || 'CLIENT / FOURNISSEUR')
                            : (printData.supplierName)}
                        </div>
                        {!printData.isSpecial && (
                          <>
                            {printData.supplierAddress && <p style={{ margin: '0 0 3px 0' }}>{printData.supplierAddress}</p>}
                            {printData.supplierBP && <p style={{ margin: '0 0 3px 0' }}>{printData.supplierBP}</p>}
                            {printData.supplierPhone && <p style={{ margin: '0 0 3px 0' }}>Tél : {printData.supplierPhone}</p>}
                            {printData.supplierRCCM && <p style={{ margin: '0 0 3px 0' }}>RCCM : {printData.supplierRCCM}</p>}
                            {printData.supplierNIF && <p style={{ margin: '0 0 3px 0' }}>N° IFU : {printData.supplierNIF}</p>}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <td colSpan="2" style={{ textAlign: 'center', backgroundColor: '#e5e7eb', padding: '6px', fontWeight: 'bold', fontSize: '10px', whiteSpace: 'pre-wrap', border: '1.5pt solid #000' }}>
                  {printData.requestRef || `REQUEST ${printData.clientName?.toUpperCase() || 'GENERAL'}`}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Main Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th rowSpan="3" style={tableHeaderStyle}>{printData.bcColNo || 'N°'}</th>
                <th colSpan="4" style={{ ...tableHeaderStyle, fontSize: '9px', letterSpacing: '1px', padding: '4px' }}>DESIGNATION</th>
                <th style={tableHeaderStyle}>Qté</th>
                {hasPermission(user, 'stock', 'view_cost_price') && (
                  <>
                    <th style={tableHeaderStyle}>Prix HTVA F. CFA</th>
                    <th style={tableHeaderStyle}>Total HTVA F. CFA</th>
                  </>
                )}
              </tr>
              <tr>
                <th colSpan="4" style={{ ...cellStyle, textAlign: 'left', fontWeight: 'bold', fontSize: '9px', paddingLeft: '8px', backgroundColor: '#fff' }}>
                  {printData.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE'}
                </th>
                <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>
                {hasPermission(user, 'stock', 'view_cost_price') && (
                  <>
                    <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>
                    <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>
                  </>
                )}
              </tr>
              <tr>
                <th style={{ ...tableHeaderStyle, width: '80px' }}>{printData.bcColCode || 'Réf.'}</th>
                <th style={{ ...tableHeaderStyle, width: '60px' }}>{printData.bcColSite || 'Site'}</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>{printData.bcColDesc || 'Article'}</th>
                <th style={{ ...tableHeaderStyle, width: '90px' }}>{printData.bcColRef || 'Ref. CFAO'}</th>
                <th style={tableHeaderStyle}></th>
                {hasPermission(user, 'stock', 'view_cost_price') && (
                  <>
                    <th style={tableHeaderStyle}></th>
                    <th style={tableHeaderStyle}></th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.code || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{printData.customSite || (printData.clientName || 'SPEC').substring(0, 4).toUpperCase()}</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.description}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.refCfao || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.quantity}</td>
                  {hasPermission(user, 'stock', 'view_cost_price') && (
                    <>
                      <td style={{ ...cellStyle, textAlign: 'right' }}>{formatPrice(isPurchaseDoc ? item.purchasePrice : item.sellPrice)}</td>
                      <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatPrice((isPurchaseDoc ? item.purchasePrice : item.sellPrice) * item.quantity)}</td>
                    </>
                  )}
                </tr>
              ))}


              {hasPermission(user, 'stock', 'view_cost_price') && (
                <>
                  <tr>
                    <td colSpan={hasPermission(user, 'stock', 'view_cost_price') ? "7" : "5"} style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>MONTANT HTVA</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>{formatPrice(amountHT)}</td>
                  </tr>
                  <tr>
                    <td colSpan={hasPermission(user, 'stock', 'view_cost_price') ? "7" : "5"} style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>MONTANT TVA {tvaValue}%</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '2px 6px', fontSize: '8.5px' }}>{formatPrice(amountTVA)}</td>
                  </tr>
                  <tr style={{ backgroundColor: '#d1d5db' }}>
                    <td colSpan={hasPermission(user, 'stock', 'view_cost_price') ? "7" : "5"} style={{ textAlign: 'right', fontWeight: 'bold', padding: '3px 8px', fontSize: '9px' }}>TOTAL NET A PAYER</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '3px 8px', fontSize: '9px' }}>{formatPrice(amountTTC)}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {printData.isExempt && hasPermission(user, 'stock', 'view_cost_price') && (
            <div style={{ marginTop: '10px', padding: '8px', border: '1pt solid #b91c1c', backgroundColor: '#fff5f5', borderRadius: '4px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#b91c1c', textTransform: 'uppercase' }}>
                EXONÉRATION DE TVA : {printData.exemptionMention || 'Vente en suspension de taxe'}
              </p>
            </div>
          )}

          {printData.printNotes && (
            <div style={{ marginTop: '15px', padding: '10px', border: '1pt solid #eee', backgroundColor: '#fafafa', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Notes / Instructions Spécifiques :</p>
              <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', color: '#333' }}>{printData.printNotes}</p>
            </div>
          )}

          {/* Signature Block */}
          <div style={{ marginTop: '25px' }}>
          <div style={{ marginTop: '20px', fontSize: '11px' }}>
            <p style={{ margin: '0 0 5px 0' }}>Arrêtée la présente facture à la somme de :</p>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', marginLeft: '40px' }}>
              {numberToWords(Math.trunc(amountTTC))} ( {formatPrice(amountTTC).toLocaleString()} Francs CFA TTC )
            </p>
          </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              {/* Cachet Area */}
              <div style={{ textAlign: 'center', width: '220px' }}>
                {(selectedPartner?.stamp_image || settings?.stampImage) && (
                  <div style={{
                    width: '150px',
                    height: '110px',
                    margin: '0 auto',
                    overflow: 'hidden',
                    position: 'relative'
                  }}>
                    <img src={selectedPartner?.stamp_image || settings.stampImage} alt="Cachet" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </div>
                )}
              </div>

              {/* Signature Area */}
              <div style={{ textAlign: 'right', minWidth: '250px' }}>
                <p style={{ fontStyle: 'italic', fontSize: '13px', marginBottom: '5px' }}>Fait à {printData.customCity || 'Ouagadougou'} le {new Date(printData.customDate || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

                <div style={{ position: 'relative', marginTop: '10px', height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  {/* Signature Image */}
                  {(selectedPartner?.signature_image || settings?.signatureImage) && (
                    <img
                      src={selectedPartner?.signature_image || settings.signatureImage}
                      alt="Signature"
                      style={{
                        maxHeight: '80px',
                        maxWidth: '200px',
                        objectFit: 'contain',
                        marginBottom: '-20px',
                        zIndex: 1
                      }}
                    />
                  )}

                  <div style={{ marginTop: (selectedPartner?.signature_image || settings?.signatureImage) ? '0' : '50px', zIndex: 2 }}>
                    <p style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '15px', margin: 0 }}>
                      {printData.customSupervisorName || settings?.supervisorName || 'Guy Roland TONDE'}
                    </p>
                    <p style={{ margin: 0, fontSize: '12px' }}>
                      {printData.customSupervisorTitle || settings?.supervisorTitle || 'Superviseur Général'}
                    </p>
                  </div>
              </div>
            </div>
          </div>
        </div>

        {/* Professional Footer - Forcé avec CSS Print */}
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
          {/* Black decorative element on the left */}
          <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '70px', backgroundColor: '#000', clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)' }}></div>
 
          <div style={{ padding: '0 20px', width: '100%', position: 'relative', zIndex: 2 }}>
            <p style={{ margin: '0', fontWeight: 'bold', fontSize: '10px' }}>
              {settings?.footerLine1 || `${settings?.companyName} - RCCM ${settings?.rccm || 'BF BBD 2018 B 0372'} - IFU ${settings?.nif || '00102506 K'} - RNI - Direction des Moyennes Entreprises`}
            </p>
            <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine2 || '01 BP 1245 Bobo Dioulasso 01 - Secteur 05 - Parcelle C - Lot 131ter - Tél.: +226 25 37 62 62'}</p>
            <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine3 || `E-mail : ${settings?.email || 'commercial@nsautobf.com'} - Site web : ${settings?.website || 'www.nsauto.com'}`}</p>
            <p style={{ margin: '1px 0', fontWeight: 'bold', fontSize: '10px' }}>{settings?.footerLine4 || 'IB bank 001193300101 / ECOBANK N°281753286301 - 74'}</p>
          </div>
        </div>
      </div>
    </div>
    );
  }

  if (isPrintingBL && printData) {
    const printBorder = '1.5pt solid #000 !important';
    const cellStyle = { border: printBorder, padding: '1.5px 4px', fontSize: '9px', verticalAlign: 'middle', boxSizing: 'border-box', color: '#000' };
    const tableHeaderStyle = { ...cellStyle, backgroundColor: '#d1d5db', fontWeight: 'bold', textAlign: 'center', fontSize: '9px', WebkitPrintColorAdjust: 'exact' };

    return (
      <div className="receipt-print-only" style={{
        display: 'block', backgroundColor: 'white', width: '21cm', minHeight: '29.7cm', padding: '0', position: 'relative', fontFamily: '"Times New Roman", Times, serif'
      }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          @media print {
            .receipt-print-only { width: 21cm !important; min-height: 29.7cm !important; padding: 0 !important; margin: 0 !important; position: relative !important; }
            .receipt-print-only table { border-collapse: collapse !important; width: 100% !important; }
            .receipt-print-only th, .receipt-print-only td { border: 1.5pt solid black !important; -webkit-print-color-adjust: exact !important; }
            .red-footer { 
              position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; width: 21cm !important; 
              background-color: #b91c1c !important; color: white !important; -webkit-print-color-adjust: exact !important;
              z-index: 999 !important;
            }
          }
        `}} />

        <div style={{ padding: '20px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '12px' }}>
            {(selectedPartner?.logo || settings?.logo) && (
              <img
                src={selectedPartner?.logo || settings?.logo}
                alt="Logo"
                style={{ maxHeight: '100px', marginRight: '2px' }}
              />
            )}
            <div style={{ flex: 1, height: '2.5pt', backgroundColor: '#b91c1c', marginBottom: '11px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
          </div>

          <div style={{ border: '1.5pt solid #000', padding: '10px', textAlign: 'center', marginBottom: '15px', backgroundColor: '#f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              {printData.blTitleOverride || settings?.blTitlePrefix || 'BORDEREAU DE LIVRAISON'} : &nbsp;&nbsp;
              {printData.customDocNumber || (() => {
                const d = new Date(printData.customDate || Date.now());
                const jjmm = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
                const an = d.getFullYear();
                const num = String(printData.orderNumber || 'SPEC').padStart(3, '0');
                return `BL-${num}-${jjmm}-${an}`;
              })()}
            </h2>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '6px', border: printBorder }}>
                  <p style={{ margin: '0 0 6px 0', fontSize: '9px' }}><strong>{settings?.companyName} SARL</strong></p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.address}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>RCCM : {settings?.rccm || 'BF BBD 2018 B 0372'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>IFU : {settings?.nif || '00102506 K'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.bp || 'BP 1245 Bobo-dioulasso'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.division || 'Division des Grandes Entreprises'}</p>
                  <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{settings?.taxSystem || 'Réel Normal d\'Imposition'}</p>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '6px', border: printBorder }}>
                  <div style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                    {printData.customRecipientDetails ? (
                      <div style={{ fontWeight: 'bold' }}>{printData.customRecipientDetails}</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '8px' }}>
                          {printData.isSpecial
                            ? (printData.clientName || 'CLIENT / FOURNISSEUR')
                            : (printData.clientName || 'CLIENT')}
                        </div>
                        {!printData.isSpecial && (
                          <>
                            {printData.client?.address && <p style={{ margin: '0 0 3px 0' }}>{printData.client.address}</p>}
                            {printData.client?.bp && <p style={{ margin: '0 0 3px 0' }}>{printData.client.bp}</p>}
                            {printData.client?.phone && <p style={{ margin: '0 0 3px 0' }}>Tél : {printData.client.phone}</p>}
                            {printData.client?.rccm && <p style={{ margin: '0 0 3px 0' }}>RCCM : {printData.client.rccm}</p>}
                            {printData.client?.nif && <p style={{ margin: '0 0 3px 0' }}>IFU : {printData.client.nif}</p>}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
              <tr>
                <td colSpan="2" style={{ textAlign: 'center', backgroundColor: '#e5e7eb', padding: '6px', fontWeight: 'bold', fontSize: '10px', border: printBorder, whiteSpace: 'pre-wrap' }}>
                  {printData.requestRef || `URGENT REQUEST ${printData.clientName?.toUpperCase()}`}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Table avec structure type BC mais sans prix */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th rowSpan="3" style={{ ...tableHeaderStyle, width: '30px' }}>{printData.blColNo || 'N°'}</th>
                <th colSpan="4" style={{ ...tableHeaderStyle, fontSize: '9px', letterSpacing: '1px', padding: '4px' }}>DESIGNATION</th>
                <th style={{ ...tableHeaderStyle, width: '60px' }}>{printData.blColQty || 'Quantité'}</th>
              </tr>
              <tr>
                <th colSpan="4" style={{ ...cellStyle, textAlign: 'left', fontWeight: 'bold', fontSize: '9px', paddingLeft: '8px', backgroundColor: '#fff' }}>
                  {printData.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE'}
                </th>
                <th style={{ ...cellStyle, backgroundColor: '#fff' }}></th>
              </tr>
              <tr>
                <th style={{ ...tableHeaderStyle, width: '80px' }}>{printData.blColCode || 'Code'}</th>
                <th style={{ ...tableHeaderStyle, width: '60px' }}>{printData.blColSite || 'Site'}</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>{printData.blColDesc || 'Article'}</th>
                <th style={{ ...tableHeaderStyle, width: '90px' }}>{printData.blColRef || 'Ref'}</th>
                <th style={tableHeaderStyle}></th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.code || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{printData.customSite || (printData.clientName || 'SPEC').substring(0, 4).toUpperCase()}</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.description}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.refCfao || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {printData.printNotes && (
            <div style={{ marginTop: '10px', padding: '8px', border: '1pt solid #eee', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: '2px' }}>INSTRUCTIONS :</p>
              <p style={{ margin: 0, fontSize: '12px', whiteSpace: 'pre-wrap' }}>{printData.printNotes}</p>
            </div>
          )}

          <div style={{ marginTop: '20px', paddingTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ fontWeight: 'bold', fontSize: '12px', margin: 0 }}>RECEPTION</p>
              <p style={{ fontStyle: 'italic', fontSize: '11px', margin: 0 }}>Fait à {printData.customCity || 'Ouagadougou'} le {new Date(printData.customDate || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <div style={{ textAlign: 'center', width: '300px', padding: '5px', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
              </div>

              <div style={{ textAlign: 'center', width: '300px', padding: '5px', minHeight: '80px', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {(selectedPartner?.bl_stamp_image || settings?.blStampImage) && <img src={selectedPartner?.bl_stamp_image || settings.blStampImage} alt="Cachet BL" style={{ maxHeight: '80px', objectFit: 'contain', opacity: 0.8 }} />}
                  {(selectedPartner?.bl_signature_image || settings?.blSignatureImage) && (
                    <img
                      src={selectedPartner?.bl_signature_image || settings.blSignatureImage}
                      alt="Signature BL"
                      style={{ maxHeight: '60px', position: 'absolute', bottom: '0', right: '20px', zIndex: 2 }}
                    />
                  )}
                </div>
                <div style={{ marginTop: '10px', zIndex: 1 }}>
                  <p style={{ fontWeight: 'bold', fontSize: '12px', margin: 0 }}>{printData.customSupervisorName || settings?.blSupervisorName || 'Huges Christian SOW'}</p>
                  <p style={{ fontSize: '10px', margin: 0 }}>{printData.customSupervisorTitle || settings?.blSupervisorTitle || 'Responsable Logistique Adjoint'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="red-footer" style={{
          height: '80px', backgroundColor: '#b91c1c', color: '#fff', fontSize: '10px', textAlign: 'center', lineHeight: '1.4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', bottom: '0', left: '0', right: '0',
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', borderTop: '2px solid #000'
        }}>
          <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '70px', backgroundColor: '#000', clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)' }}></div>
          <div style={{ padding: '0 20px', width: '100%', position: 'relative', zIndex: 2 }}>
            <p style={{ margin: '0', fontWeight: 'bold', fontSize: '10px' }}>
              {settings?.footerLine1 || `${settings?.companyName} - RCCM ${settings?.rccm || 'BF BBD 2018 B 0372'} - IFU ${settings?.nif || '00102506 K'} - RNI - Direction des Moyennes Entreprises`}
            </p>
            <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine2 || '01 BP 1245 Bobo Dioulasso 01 - Secteur 05 - Parcelle C - Lot 131ter - Tél.: +226 25 37 62 62'}</p>
            <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine3 || `E-mail : ${settings?.email || 'commercial@nsautobf.com'} - Site web : ${settings?.website || 'www.nsauto.com'}`}</p>
            <p style={{ margin: '1px 0', fontWeight: 'bold', fontSize: '10px' }}>{settings?.footerLine4 || 'IB bank 001193300101 / ECOBANK N°281753286301 - 74'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div className="page">Chargement...</div>;

  return (
    <div className="page">
      <style>{blinkingStyle}</style>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
            <h1 style={{ margin: 0 }}>Passerelle Contrats</h1>
            {partners.length > 1 && (
              <select
                className="form-control"
                style={{ width: 'auto', fontWeight: 700, border: '2px solid var(--primary)', color: 'var(--primary)', padding: '4px 12px' }}
                value={selectedPartner?.id || ''}
                onChange={(e) => {
                  if (e.target.value === 'all') {
                    setSelectedPartner({ id: 'all', name: 'Tous les partenaires' });
                    localStorage.setItem('selectedPartnerId', 'all');
                  } else {
                    const p = partners.find(p => p.id === e.target.value);
                    setSelectedPartner(p);
                    localStorage.setItem('selectedPartnerId', p.id);
                  }
                }}
              >
                {partners.length > 1 && <option value="all">🌍 Tous les partenaires</option>}
                {partners.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          <p>Gestion indépendante du catalogue et des flux ({selectedPartner?.name || 'Chargement...'})</p>
        </div>
        <div className="header-actions">
          <button
            className={`btn ${activeTab === 'dossiers' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ boxShadow: activeTab === 'dossiers' ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none' }}
            onClick={() => setActiveTab('dossiers')}
          >
            <LayoutList size={18} /> Dossiers
          </button>
          <button
            className={`btn ${activeTab === 'special' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ boxShadow: activeTab === 'special' ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none' }}
            onClick={() => setActiveTab('special')}
          >
            <FileText size={18} /> Documents Libres
          </button>
          <button
            className={`btn ${activeTab === 'catalogue' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ boxShadow: activeTab === 'catalogue' ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none' }}
            onClick={() => setActiveTab('catalogue')}
          >
            <BookOpen size={18} /> Catalogue
          </button>
          <button
            className={`btn ${activeTab === 'rapports' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ boxShadow: activeTab === 'rapports' ? '0 4px 12px rgba(59, 130, 246, 0.4)' : 'none' }}
            onClick={() => setActiveTab('rapports')}
          >
            <ShoppingCart size={18} /> Rapports Achats
          </button>
          <button
            className={`btn ${activeTab === 'planning' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ boxShadow: activeTab === 'planning' ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none' }}
            onClick={() => setActiveTab('planning')}
          >
            <Clock size={18} /> Planning Livraisons
          </button>
        </div>
      </div>

      {/* --- GLOBAL FILTERS --- */}
      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
        <div className="filters" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={16} className="text-muted" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Période :</span>
          </div>
          <input
            type="date"
            className="form-control"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}
            value={dateRange.start}
            onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
          />
          <span className="text-muted">au</span>
          <input
            type="date"
            className="form-control"
            style={{ width: 'auto', padding: '4px 8px', fontSize: '0.85rem' }}
            value={dateRange.end}
            onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
          />
        </div>

        <div className="filters" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Truck size={16} className="text-muted" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Mine :</span>
          </div>
          <select
            className="form-control"
            style={{ width: '200px', height: '32px', padding: '0 8px', fontSize: '0.85rem' }}
            value={selectedMine}
            onChange={e => {
              const val = e.target.value;
              setSelectedMine(val);
              // Si on change la mine globale, on met à jour aussi la mine du catalogue pour rester synchrone
              setSelectedCatalogClient(val);
            }}
          >
            <option value="">Toutes les Mines</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <button
          className={`btn ${isVoiceEnabled ? 'btn-success' : 'btn-secondary'}`}
          style={{ 
            boxShadow: isVoiceEnabled ? '0 4px 12px rgba(34, 197, 94, 0.4)' : 'none',
            height: '32px',
            padding: '0 12px',
            fontSize: '0.8rem',
            marginLeft: 'auto'
          }}
          onClick={() => {
            const newState = !isVoiceEnabled;
            setIsVoiceEnabled(newState);
            if (newState) {
              if (window.speechSynthesis) window.speechSynthesis.cancel();
              speak("Assistant vocal activé.");
            }
          }}
        >
          {isVoiceEnabled ? <Globe size={14} /> : <Globe size={14} opacity={0.5} />} 
          Vocal {isVoiceEnabled ? 'ON' : 'OFF'}
        </button>
      </div>

      {activeTab === 'dossiers' ? (
        <>
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="stat-card" style={{ borderLeft: '5px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>💼 Achats en cours</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                {orders.filter(o => o.status !== 'termine').reduce((sum, o) => sum + (o.contractAmount * (1 + (o.tva_rate || 0) / 100)), 0).toLocaleString()}
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}> FCFA (TTC)</span>
              </div>
            </div>
            {hasPermission(user, 'stock', 'view_cost_price') && (
              <div className="stat-card" style={{ borderLeft: '5px solid var(--success)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>💰 Achats Clôturés</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)' }}>
                  {orders.filter(o => o.status === 'termine').reduce((sum, o) => sum + (o.contractAmount * (1 + (o.tva_rate || 0) / 100)), 0).toLocaleString()}
                  <span style={{ fontSize: '0.9rem', opacity: 0.8 }}> FCFA (TTC)</span>
                </div>
              </div>
            )}
            <div className="stat-card" style={{ borderLeft: '5px solid var(--warning)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>⏳ En Demande</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning)' }}>{orders.filter(o => o.status === 'demande').length} <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Dossiers</span></div>
            </div>
            <div className="stat-card" style={{ borderLeft: '5px solid var(--danger)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>🚨 Retard Livraison</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--danger)' }}>
                {orders.filter(o => o.status !== 'termine' && o.delivery_date && new Date(o.delivery_date) <= new Date()).length} 
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}> Dossiers</span>
              </div>
            </div>
          </div>

          <div className="content-card">
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <button className="btn btn-primary" onClick={() => {
                  if (selectedPartner?.id === 'all') {
                    showAlert('info', 'Sélection Requise', 'Veuillez d\'abord choisir un partenaire spécifique dans le menu en haut pour créer un nouveau dossier.');
                  } else if (!selectedMine) {
                    showAlert('warning', 'Sélection Mine Requise', 'Veuillez d\'abord sélectionner une Mine dans le filtre en haut de la page avant de créer un dossier.');
                  } else {
                    setItemSearch('');
                    setSuggestions([]);
                    setNewOrder({ clientId: selectedMine, supplierId: '', notes: '', items: [], deliveryDate: '' });
                    setIsModalOpen(true);
                  }
                }}><Plus size={18} /> Nouveau Dossier</button>
                <button className="btn btn-secondary" onClick={exportOrdersToExcel} title="Exporter tous les dossiers affichés"><FileSpreadsheet size={18} /> Excel</button>
              </div>

            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Réf. Dossier</th>{selectedPartner?.id === 'all' && <th>Partenaire</th>}<th>Client</th><th>Livraison</th><th>Statut</th><th>Montant Achat</th><th>Actions</th></tr></thead>
                <tbody>
                  {orders.map(order => {
                    const isOldRequest = order.status === 'demande' && (new Date() - new Date(order.createdAt)) > (48 * 60 * 60 * 1000);
                    const isLateDelivery = order.status !== 'termine' && order.delivery_date && new Date(order.delivery_date) <= new Date();
                    
                    return (
                      <tr key={order.id} className={isLateDelivery ? 'row-urgent' : isOldRequest ? 'row-urgent' : ''}>
                        <td style={{ fontWeight: 700 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            #{String(order.orderNumber).padStart(3, '0')}
                            {order.attachment && <Paperclip size={14} className="text-primary" title="Document joint" />}
                          </div>
                        </td>
                        {selectedPartner?.id === 'all' && <td style={{ fontWeight: 600 }}>{order.partnerName || 'N/A'}</td>}
                        <td>{order.clientName}</td>
                        <td>
                          {order.delivery_date ? (
                            <div style={{ 
                              fontSize: '0.8rem', 
                              fontWeight: 700, 
                              color: isLateDelivery ? 'var(--danger)' : 'var(--primary)', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              animation: isLateDelivery ? 'blink-red 1.5s infinite' : 'none'
                            }}>
                              {isLateDelivery ? <AlertTriangle size={14} /> : <Truck size={14} />}
                              {new Date(order.delivery_date).toLocaleDateString()}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge badge-${order.status === 'termine' ? 'success' : 'warning'} ${isOldRequest ? 'badge-urgent' : ''}`}>
                            {order.status} {isOldRequest && '⚠️'}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                            {((order.contractAmount || 0) * (1 + (order.tva_rate || 0) / 100)).toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FCFA</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleEditOrder(order.id)} title="Modifier le dossier" disabled={order.status === 'termine'}><Edit size={16} /></button>
                            <button className="btn btn-secondary btn-sm" onClick={() => viewOrder(order.id)} title="Voir les détails"><Eye size={16} /></button>
                            {order.status === 'demande' && <button className="btn btn-secondary btn-sm" onClick={() => updateOrderStatus(order.id, 'facture_recue')} title="Facture reçue"><ArrowRight size={16} /></button>}
                            {(order.status === 'facture_recue' || order.status === 'po_envoye') && <button className="btn btn-success btn-sm" onClick={() => updateOrderStatus(order.id, 'termine')} title="Clôturer le dossier"><CheckCircle2 size={16} /></button>}
                            <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(order.id)} title="Imprimer BC"><Printer size={16} /> BC</button>
                            <button className="btn btn-secondary btn-sm" title="Historique BC" onClick={() => loadBCHistory(order.id)}><History size={16} /></button>
                            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--success)' }} title="Générer BL" onClick={() => handleOpenBLModal(order.id)}>
                              <Truck size={16} /> BL
                            </button>
                            <button className="btn btn-secondary btn-sm" title="Historique BL" onClick={() => loadDeliveries(order.id)}><History size={16} /></button>
                            <button className="btn btn-danger-outline btn-sm" onClick={() => deleteOrder(order.id)} title="Supprimer le dossier"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination UI */}
            {pagination.totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--bg-light)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Affichage de <strong>{orders.length}</strong> sur <strong>{pagination.total}</strong> dossiers
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Précédent
                  </button>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[...Array(pagination.totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      // Ne montrer que les pages proches de l'actuelle pour éviter une liste trop longue
                      if (pageNum === 1 || pageNum === pagination.totalPages || (pageNum >= currentPage - 2 && pageNum <= currentPage + 2)) {
                        return (
                          <button
                            key={pageNum}
                            className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ minWidth: '32px', padding: '4px 8px' }}
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (pageNum === currentPage - 3 || pageNum === currentPage + 3) {
                        return <span key={pageNum} style={{ color: 'var(--text-muted)' }}>...</span>;
                      }
                      return null;
                    })}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                    disabled={currentPage === pagination.totalPages}
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'special' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '2rem' }}>
          <div className="content-card">
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><Plus size={20} color="var(--primary)" /> Nouveau Document Libre</h3>
            <div className="form-group">
              <label className="form-label">Détails du Client (Nom, Adresse, BP, IFU...)</label>
              <textarea
                className="form-control"
                rows="4"
                placeholder="Ex: CFAO MOBILITY\n2280 BOULEVARD TANSOBA\n01 BP 23 Ouaga 01\nN° IFU : 00000300E"
                id="spec-client"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Détails du Fournisseur (Émetteur)</label>
              <textarea
                className="form-control"
                rows="3"
                placeholder="Ex: NS AUTO SARL\nSecteur 25, Ouagadougou\nTél: +226 ..."
                id="spec-supplier"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Titre Personnalisé (Optionnel)</label>
              <input type="text" className="form-control" placeholder="Ex: BON DE COMMANDE URGENT" id="spec-title" />
            </div>
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => {
                const clientName = document.getElementById('spec-client').value;
                const supplierName = document.getElementById('spec-supplier').value;
                const title = document.getElementById('spec-title').value;
                if (!clientName) return showAlert('error', 'Champs requis', 'Veuillez saisir au moins le nom du client.');

                const newDoc = {
                  id: Date.now(),
                  clientName,
                  supplierName: supplierName || 'NS AUTO SARL',
                  title: title,
                  createdAt: new Date().toISOString(),
                  items: [{ refSite: '', description: '', refCfao: '', quantity: 1, purchasePrice: 0 }]
                };
                handlePrintSpecial(newDoc, 'BC');
              }}>
                <Printer size={18} /> Préparer & Imprimer BC
              </button>
              <button className="btn btn-success" style={{ width: '100%' }} onClick={() => {
                const clientName = document.getElementById('spec-client').value;
                const supplierName = document.getElementById('spec-supplier').value;
                const title = document.getElementById('spec-title').value;
                if (!clientName) return showAlert('error', 'Champs requis', 'Veuillez saisir au moins le nom du client.');

                const newDoc = {
                  id: Date.now(),
                  clientName,
                  supplierName: supplierName || 'NS AUTO SARL',
                  title: title,
                  createdAt: new Date().toISOString(),
                  items: [{ refSite: '', description: '', refCfao: '', quantity: 1, purchasePrice: 0 }]
                };
                handlePrintSpecial(newDoc, 'BL');
              }}>
                <Truck size={18} /> Préparer & Imprimer BL
              </button>
            </div>
          </div>

          <div className="content-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <History size={20} color="var(--text-muted)" /> Historique des Documents Libres
              </h3>
              <div style={{ fontSize: '0.75rem', backgroundColor: '#f0f9ff', color: '#0369a1', padding: '8px 16px', borderRadius: '12px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '600px' }}>
                <Info size={18} style={{ flexShrink: 0 }} /> 
                <span>
                  <strong>Note :</strong> Ces documents sont purement administratifs (pas d'impact sur les stocks ou bilans). 
                  Utilisez ce module uniquement pour l'impression personnalisée. Pour vos achats réels, utilisez le module <strong>'Dossiers'</strong>.
                </span>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Actions</th></tr></thead>
                <tbody>
                  {specialDocs.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucun document libre enregistré.</td></tr>
                  ) : (
                    specialDocs.map(doc => (
                      <tr key={doc.id}>
                        <td>{new Date(doc.createdAt).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600 }}>{doc.clientName}</td>
                        <td><span className="badge badge-info">{doc.title || 'Document Libre'}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handlePrintSpecial(doc, 'BC')} title="Ré-imprimer BC"><Printer size={15} /> BC</button>
                            <button className="btn btn-secondary btn-sm" style={{ color: 'var(--success)' }} onClick={() => handlePrintSpecial(doc, 'BL')} title="Ré-imprimer BL"><Truck size={15} /> BL</button>

                            <button className="btn btn-secondary btn-sm" onClick={() => handleFileUpload(doc.id, 'special')} title={doc.attachment ? "Changer le scan" : "Joindre un scan/fichier"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}>
                              <Paperclip size={15} style={{ color: doc.attachment ? 'var(--primary)' : '#64748b' }} />
                            </button>

                            {doc.attachment && (
                              <a href={doc.attachment} target="_blank" rel="noopener noreferrer" className="btn btn-info-outline btn-sm" title="Voir le scan joint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}>
                                <Eye size={15} />
                              </a>
                            )}

                            <button className="btn btn-danger-outline btn-sm" onClick={() => deleteSpecialDoc(doc.id)}><Trash2 size={15} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'catalogue' ? (
        selectedPartner.id === 'all' ? (
          <div className="content-card" style={{ textAlign: 'center', padding: '4rem 2rem', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', borderRadius: '16px' }}>
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{
                width: '80px', height: '80px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)',
                borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem', boxShadow: '0 8px 16px rgba(59, 130, 246, 0.15)'
              }}>
                <BookOpen size={40} />
              </div>
              <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '1rem' }}>Gestion des Catalogues</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '2.5rem', lineHeight: '1.6' }}>
                Les références et les prix sont spécifiques à chaque contrat. <br />
                Veuillez sélectionner un partenaire pour accéder à son catalogue dédié.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
                {partners.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPartner(p);
                      localStorage.setItem('selectedPartnerId', p.id);
                    }}
                    style={{
                      padding: '2rem 1.5rem',
                      backgroundColor: 'white',
                      border: '1px solid var(--border-color)',
                      borderRadius: '16px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      textAlign: 'center',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary)';
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.boxShadow = '0 12px 20px -5px rgba(59, 130, 246, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    <div style={{
                      width: '40px', height: '40px', backgroundColor: '#f1f5f9', borderRadius: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem'
                    }}>
                      <Globe size={20} className="text-primary" />
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1.15rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Ouvrir le catalogue {p.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="content-card">
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary" onClick={() => { setCatalogItem({ code: '', refCfao: '', name: '', purchasePrice: 0, clientId: selectedCatalogClient }); setIsCatalogModalOpen(true); }}><Plus size={18} /> Ajouter Article</button>
                <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}><Download size={18} style={{ transform: 'rotate(180deg)' }} /> Importer</button>
                <button className="btn btn-secondary" onClick={exportCatalogToExcel} title="Exporter en Excel"><FileSpreadsheet size={18} /> Excel</button>
                <button className="btn btn-secondary" onClick={handlePrintCatalog} title="Imprimer / PDF"><Printer size={18} /> PDF</button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <Globe size={16} className="text-muted" />
                <select
                  className="form-control"
                  style={{ width: '200px', height: '36px', padding: '0 10px', fontSize: '0.85rem' }}
                  value={selectedMine}
                  onChange={e => {
                    setSelectedMine(e.target.value);
                    setSelectedCatalogClient(e.target.value);
                  }}
                >
                  <option value="">Toutes les Mines (Global)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="search-box" style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Rechercher par nom ou code CFAO..."
                  style={{ paddingLeft: '40px' }}
                  value={catalogSearch}
                  onChange={e => setCatalogSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Code</th><th>Réf CFAO</th><th>Désignation</th><th>Mine</th>{hasPermission(user, 'stock', 'view_cost_price') && <th>P.A Contrat</th>}<th>Actions</th></tr></thead>
                <tbody>
                  {catalog
                    .filter(item =>
                      item.name?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                      item.code?.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                      item.refCfao?.toLowerCase().includes(catalogSearch.toLowerCase())
                    )
                    .map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 700 }}>{item.code || '-'}</td>
                        <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{item.refCfao || '-'}</td>
                        <td>{item.name}</td>
                        <td>
                          {item.clientId ? (
                            <span className="badge badge-info">{clients.find(c => String(c.id) === String(item.clientId))?.name || 'Inconnu'}</span>
                          ) : (
                            <span className="badge badge-secondary">Global</span>
                          )}
                        </td>
                        {hasPermission(user, 'stock', 'view_cost_price') && <td style={{ fontWeight: 600 }}>{(item.purchasePrice || 0).toLocaleString()} FCFA</td>}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setCatalogItem(item); setIsCatalogModalOpen(true); }}><Edit size={16} /></button>
                            <button className="btn btn-danger-outline btn-sm" onClick={() => deleteCatalogItem(item.id)}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'rapports' ? (
        statsLoading ? (
          <div className="content-card" style={{ textAlign: 'center', padding: '5rem' }}>
            <div className="loader" style={{ margin: '0 auto 1rem' }}></div>
            <p className="text-muted">Analyse des données en cours...</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }} className="printable-report">
            {/* --- EN-TETE IMPRESSION UNIQUEMENT --- */}
            <div className="print-only" style={{ marginBottom: '2rem', borderBottom: '2px solid var(--primary)', paddingBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h1 style={{ margin: 0, color: 'var(--primary)' }}>RAPPORT D'ACTIVITÉ : ACHATS PARTENAIRES</h1>
                  <p style={{ margin: '5px 0', fontSize: '1.1rem', fontWeight: 600 }}>Partenaire : {selectedPartner?.name || 'Tous'}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 'bold' }}>{settings?.companyName || 'NS AUTO BF'}</p>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}>Date du rapport : {new Date().toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(stats?.partnerTotals?.length || 3, 4)}, 1fr)`, gap: '1.5rem' }}>
              {stats?.partnerTotals?.map((p, idx) => (
                hasPermission(user, 'stock', 'view_cost_price') && (
                  <div key={idx} className="content-card" style={{ padding: '1.5rem', borderLeft: `6px solid ${idx % 2 === 0 ? 'var(--primary)' : 'var(--success)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Dépenses {p.partnerName}</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>
                          {formatPrice(p.totalAmount || 0)} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>FCFA</span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{p.orderCount} dossiers enregistrés</div>
                      </div>
                      <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '12px' }}>
                        {idx % 2 === 0 ? <ShoppingCart size={24} color="var(--primary)" /> : <Package size={24} color="var(--success)" />}
                      </div>
                    </div>
                  </div>
                )
              ))}

              {/* Global Volume */}
              <div className="content-card" style={{ padding: '1.5rem', borderLeft: '6px solid var(--warning)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Total Dossiers</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>
                      {stats?.partnerTotals?.reduce((acc, p) => acc + p.orderCount, 0) || 0} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Actes</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Cumul tous partenaires</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '12px' }}><FileText size={24} color="var(--warning)" /></div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem', marginBottom: '1rem' }}>
              <button
                className="btn btn-primary no-print"
                onClick={() => window.print()}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px' }}
              >
                <Printer size={18} /> Exporter Rapport PDF (Réunion)
              </button>
            </div>

            {hasPermission(user, 'stock', 'view_cost_price') && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                  {/* --- ÉVOLUTION MENSUELLE --- */}
                  <div className="content-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><Clock size={20} /> Évolution Mensuelle des Commandes (FCFA)</h3>
                    <div style={{ width: '100%', height: '300px' }}>
                      <ResponsiveContainer>
                        <AreaChart data={stats?.monthlyEvolution || []}>
                          <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            formatter={(val) => [`${formatPrice(val)} FCFA`, 'Total']}
                          />
                          <Area type="monotone" dataKey="totalAmount" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* --- TOP ARTICLES PAR PARTENAIRE --- */}
                  <div className="content-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><ArrowUpRight size={20} /> Top Articles</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {stats?.topArticles?.slice(0, 5).map((art, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'var(--bg-light)', borderRadius: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{art.description}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{art.partnerName} • {art.totalQuantity} unités</div>
                          </div>
                          <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--primary)', textAlign: 'right' }}>
                            {formatPrice(art.totalValue)} <span style={{ fontSize: '0.7rem' }}>FCFA</span>
                          </div>
                        </div>
                      ))}
                      {(!stats?.topArticles || stats.topArticles.length === 0) && (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Aucune donnée disponible</div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                  {/* --- TEMPS DE TRAITEMENT --- */}
                  <div className="content-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><Timer size={20} /> Temps Moyen de Traitement (Heures)</h3>
                    <div style={{ width: '100%', height: '300px' }}>
                      <ResponsiveContainer>
                        <BarChart data={stats?.avgProcessingTime || []}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="partnerName" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                            formatter={(val) => [`${parseFloat(val).toFixed(1)} h`, 'Temps Moyen']}
                          />
                          <Bar dataKey="avgHours" fill="var(--primary)" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
                      Durée moyenne entre la création de la demande et la clôture (Statut Terminé).
                    </p>
                  </div>

                  {/* --- RÉPARTITION PAR CLIENT --- */}
                  <div className="content-card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><LucidePieChart size={20} /> Répartition Volume par Client Final</h3>
                    <div style={{ width: '100%', height: '300px' }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={stats?.clientDistribution || []}
                            dataKey="totalAmount"
                            nameKey="clientName"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            isAnimationActive={false}
                          >
                            {(stats?.clientDistribution || []).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(val) => [`${formatPrice(val)} FCFA`, 'Volume']}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* --- RÉCAPITULATIF DÉTAILLÉ (Ancien Rapports) --- */}
            <div className="content-card">
              <div className="section-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Récapitulatif Détaillé des Articles</h3>
                  <p className="text-muted" style={{ fontSize: '0.85rem' }}>Liste des articles issus des dossiers clôturés.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => {
                  if (reportPartnerId === 'all') {
                    showAlert('info', 'Sélection Requise', 'Veuillez d\'abord choisir un partenaire spécifique dans la barre de filtres ci-dessous pour exporter le rapport détaillé.');
                  } else {
                    exportReportToExcel();
                  }
                }}>
                  <Download size={18} /> Exporter Excel
                </button>
              </div>

              {/* BARRE DE FILTRES DU RAPPORT */}
              <div className="filter-bar" style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: 'var(--bg-light)',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                alignItems: 'center',
                border: '1px solid var(--border-light)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Période du :</span>
                  <input
                    type="date"
                    className="form-control"
                    style={{ width: 'auto', height: '38px' }}
                    value={reportStartDate}
                    onChange={(e) => setReportStartDate(e.target.value)}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>au</span>
                  <input
                    type="date"
                    className="form-control"
                    style={{ width: 'auto', height: '38px' }}
                    value={reportEndDate}
                    onChange={(e) => setReportEndDate(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Partenaire :</span>
                  <select
                    className="form-control"
                    style={{ height: '38px' }}
                    value={reportPartnerId}
                    onChange={(e) => setReportPartnerId(e.target.value)}
                  >
                    <option value="all">Tous les partenaires</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {reportLoading && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                    Chargement...
                  </div>
                )}
              </div>

              <div className="table-wrapper">
                <table className="table-sm">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-light)' }}>
                      <th style={{ width: '120px' }}>Code</th>
                      <th>Article / Référence</th>
                      <th style={{ width: '120px', textAlign: 'right' }}>P.U (HT)</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Qté Vendue</th>
                      <th style={{ width: '150px', textAlign: 'right' }}>Montant Total (HT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportItems.length === 0 ? (
                      <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Aucun article trouvé.</td></tr>
                    ) : (
                      reportItems.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 700 }}>{item.refCfao || item.code || '-'}</td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{item.description}</div>
                            {reportPartnerId === 'all' && <div style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>{item.partnerName}</div>}
                          </td>
                          <td style={{ textAlign: 'right' }}>{formatPrice(item.unitPrice)}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.totalQuantity}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(item.totalHT)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {reportItems.length > 0 && (
                    <tfoot style={{ borderTop: '2px solid var(--primary)', backgroundColor: 'var(--bg-light)' }}>
                      <tr>
                        <td colSpan="3" style={{ textAlign: 'right', padding: '12px', fontWeight: 'bold', textTransform: 'uppercase' }}>TOTAL BRUT (HT)</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{reportItems.reduce((sum, it) => sum + Number(it.totalQuantity), 0)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(reportItems.reduce((sum, it) => sum + Number(it.totalHT || 0), 0))}</td>
                      </tr>
                      <tr>
                        <td colSpan="4" style={{ textAlign: 'right', padding: '8px', fontWeight: 600, color: 'var(--primary)' }}>
                          MONTANT TVA ({reportItems[0]?.tvaRate || settings?.tvaRate || 18}%)
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>
                          {formatPrice(reportItems.reduce((sum, it) => sum + Number(it.tvaAmount || 0), 0))}
                        </td>
                      </tr>
                      <tr style={{ backgroundColor: '#eff6ff' }}>
                        <td colSpan="4" style={{ textAlign: 'right', padding: '12px', fontWeight: '800', fontSize: '1rem' }}>TOTAL NET (TTC)</td>
                        <td style={{ textAlign: 'right', fontWeight: '900', fontSize: '1.1rem', color: 'var(--text-main)' }}>
                          {formatPrice(reportItems.reduce((sum, it) => sum + Number(it.totalTTC || 0), 0))} FCFA
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )
      ) : activeTab === 'planning' ? (
        <div className="content-card" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Clock size={28} color="var(--primary)" /> 
              Planning des Livraisons - {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()}
            </h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
               <button className="btn btn-secondary no-print" onClick={() => window.print()}>
                  <Printer size={18} /> Imprimer le Planning
               </button>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="no-print">
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--primary)' }}></div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Dossier Standard</span>
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="no-print">
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', backgroundColor: 'var(--danger)' }}></div>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Retard</span>
               </div>
            </div>
          </div>

          <div className="calendar-print-header">
            <h1 style={{ fontSize: '24pt', marginBottom: '5px' }}>NS-AUTOFLOW : PLANNING LOGISTIQUE</h1>
            <h2 style={{ fontSize: '18pt', color: '#666' }}>{new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }).toUpperCase()}</h2>
          </div>

          <div className="calendar-container" style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '1px', 
            backgroundColor: '#e2e8f0',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden'
          }}>
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
              <div key={day} style={{ backgroundColor: '#f8fafc', padding: '1rem', textAlign: 'center', fontWeight: 800, color: '#64748b', fontSize: '0.85rem' }}>{day}</div>
            ))}
            
            {(() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
              const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
              
              // Ajuster pour que Lundi soit le 1er jour (0=Dimanche dans JS, on veut 0=Lundi)
              let startOffset = firstDay.getDay() - 1;
              if (startOffset === -1) startOffset = 6;

              const days = [];
              // Jours du mois précédent
              for (let i = 0; i < startOffset; i++) {
                days.push(<div key={`prev-${i}`} style={{ backgroundColor: '#f1f5f9', minHeight: '120px' }}></div>);
              }

              // Jours du mois actuel
              for (let d = 1; d <= lastDay.getDate(); d++) {
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const dayOrders = orders.filter(o => o.delivery_date && o.delivery_date.split('T')[0] === dateStr);
                const isToday = now.getDate() === d;

                days.push(
                  <div key={d} style={{ 
                    backgroundColor: 'white', 
                    minHeight: '130px', 
                    padding: '0.75rem',
                    position: 'relative',
                    border: isToday ? '2px solid var(--primary)' : 'none',
                    zIndex: isToday ? 1 : 0
                  }}>
                    <div style={{ 
                      fontSize: '1rem', 
                      fontWeight: isToday ? 900 : 700, 
                      color: isToday ? 'var(--primary)' : '#94a3b8',
                      marginBottom: '0.75rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      {d}
                      {isToday && <span style={{ fontSize: '0.65rem', backgroundColor: 'var(--primary)', color: 'white', padding: '2px 6px', borderRadius: '10px', textTransform: 'uppercase' }}>Auj.</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {dayOrders.map(o => {
                        const isLate = o.status !== 'termine' && o.delivery_date && new Date(o.delivery_date) <= new Date();
                        
                        // Définition des couleurs selon le statut
                        let bgColor = '#eff6ff';
                        let textColor = '#1e40af';
                        let borderColor = 'var(--primary)';

                        if (isLate) {
                          bgColor = '#fee2e2';
                          textColor = '#b91c1c';
                          borderColor = 'var(--danger)';
                        } else if (o.status === 'termine') {
                          bgColor = '#f0fdf4';
                          textColor = '#15803d';
                          borderColor = '#22c55e';
                        } else if (o.status === 'facture_recue' || o.status === 'po_envoye') {
                          bgColor = '#fff7ed';
                          textColor = '#9a3412';
                          borderColor = '#f97316';
                        }

                        return (
                          <div 
                            key={o.id} 
                            onClick={() => viewOrder(o.id)}
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '4px 8px', 
                              backgroundColor: bgColor, 
                              color: textColor, 
                              borderRadius: '6px',
                              borderLeft: `3px solid ${borderColor}`,
                              cursor: 'pointer',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              animation: isLate ? 'blink-red 1.5s infinite' : 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            title={`[${o.status.replace('_', ' ')}] Dossier #${o.orderNumber} - ${o.clientName}`}
                          >
                            {isLate && <AlertTriangle size={10} />}
                            #{String(o.orderNumber).padStart(3, '0')} {o.clientName}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
              return days;
            })()}
          </div>
        </div>
      ) : null}

      {/* Modal Nouveau Dossier */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1000px', padding: '1rem' }}>
            <div className="modal-header" style={{ padding: '0.75rem 1rem' }}>
              <h3 style={{ fontSize: '1.1rem' }}>{isEditing ? `Modifier Dossier #${String(selectedOrder?.orderNumber).padStart(3, '0')}` : 'Nouveau Dossier Achats Partenaires'}</h3>
              <button className="modal-close" onClick={() => { setIsModalOpen(false); setIsEditing(false); setSelectedOrder(null); setNewOrder({ clientId: selectedMine, supplierId: '', notes: '', items: [], deliveryDate: '' }); }}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '0.5rem 1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.5fr', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.85rem' }}>Mine (Client Final)</label>
                  <select
                    className="form-control"
                    value={newOrder.clientId}
                    onChange={e => setNewOrder({ ...newOrder, clientId: e.target.value })}
                    disabled={!!selectedMine && !isEditing}
                    style={{ backgroundColor: (!!selectedMine && !isEditing) ? '#f8fafc' : 'white', height: '38px', fontSize: '0.9rem' }}
                  >
                    <option value="">Choisir la mine...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {!!selectedMine && !isEditing && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Verrouillé sur la mine du dashboard.</p>}
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.85rem' }}>Date de Livraison Prévue</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    style={{ height: '38px', fontSize: '0.9rem' }} 
                    value={newOrder.deliveryDate} 
                    onChange={e => setNewOrder({ ...newOrder, deliveryDate: e.target.value })} 
                  />
                </div>

                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.85rem' }}>Chercher dans le Catalogue CFAO</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input type="text" className="form-control" style={{ height: '38px', fontSize: '0.9rem' }} placeholder="Entrez une référence ou un nom..." value={itemSearch} onChange={e => handleItemSearch(e.target.value)} />
                    <button className="btn btn-secondary" style={{ height: '38px', whiteSpace: 'nowrap' }} onClick={() => {
                      setAlertModal({
                        open: true,
                        type: 'confirm',
                        confirmLabel: 'Oui, ajouter',
                        cancelLabel: 'Non',
                        title: 'Ajout Manuel',
                        message: 'Souhaitez-vous réellement ajouter un article manuellement (hors catalogue) ?',
                        onConfirm: () => {
                          addItemFromCatalog(null);
                          setAlertModal(prev => ({ ...prev, open: false }));
                        }
                      });
                    }}>Ajout Manuel</button>
                  </div>
                  {suggestions.length > 0 && (
                    <div className="search-suggestions" style={{ top: '65px' }}>
                      {suggestions.map(a => (
                        <div key={a.id} className="suggestion-item" onClick={() => addItemFromCatalog(a)} style={{ padding: '8px 12px' }}>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Réf: {a.code} {hasPermission(user, 'stock', 'view_cost_price') && `| P.A: ${formatPrice(a.purchasePrice || 0)} FCFA`}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="table-wrapper" style={{ marginTop: '0.5rem', maxHeight: '280px' }}>
                <table className="table-sm" style={{ width: '100%' }}>
                  <thead>
                    <tr style={{ fontSize: '0.85rem' }}>
                      <th style={{ width: '100px' }}>Code</th>
                      <th style={{ width: '100px' }}>Réf. CFAO</th>
                      <th>Désignation</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Qté</th>
                      {hasPermission(user, 'stock', 'view_cost_price') && (
                        <>
                          <th style={{ width: '100px' }}>P.A CFAO</th>
                          <th style={{ width: '90px', textAlign: 'right' }}>Total HT</th>
                          <th style={{ width: '100px', textAlign: 'right' }}>Total TTC</th>
                        </>
                      )}
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {newOrder.items.map((item, idx) => (
                      <tr key={idx}>
                        <td><input type="text" className="form-control" style={{ fontSize: '0.8rem', height: '30px', padding: '4px 8px' }} value={item.code} onChange={e => { const val = e.target.value; setNewOrder(prev => { const ni = [...prev.items]; ni[idx].code = val; return { ...prev, items: ni }; }); }} /></td>
                        <td><input type="text" className="form-control" style={{ fontSize: '0.8rem', height: '30px', padding: '4px 8px' }} value={item.refCfao} onChange={e => { const val = e.target.value; setNewOrder(prev => { const ni = [...prev.items]; ni[idx].refCfao = val; return { ...prev, items: ni }; }); }} /></td>
                        <td><input type="text" className="form-control" style={{ fontSize: '0.8rem', height: '30px', padding: '4px 8px' }} value={item.description} onChange={e => { const val = e.target.value; setNewOrder(prev => { const ni = [...prev.items]; ni[idx].description = val; return { ...prev, items: ni }; }); }} /></td>
                        <td><input type="number" className="form-control" style={{ textAlign: 'center', padding: '2px', height: '30px', fontSize: '0.85rem' }} value={item.quantity} onChange={e => { const val = e.target.value; setNewOrder(prev => { const ni = [...prev.items]; ni[idx].quantity = val; return { ...prev, items: ni }; }); }} /></td>
                        {hasPermission(user, 'stock', 'view_cost_price') && (
                          <>
                            <td><input type="number" className="form-control" style={{ height: '30px', padding: '4px 8px', fontSize: '0.85rem' }} value={item.purchasePrice} onChange={e => { const val = e.target.value; setNewOrder(prev => { const ni = [...prev.items]; ni[idx].purchasePrice = val; return { ...prev, items: ni }; }); }} /></td>
                            <td style={{ fontWeight: 600, textAlign: 'right', fontSize: '0.85rem' }}>{formatPrice(item.quantity * item.purchasePrice)}</td>
                            <td style={{ fontWeight: 700, textAlign: 'right', color: 'var(--primary)', fontSize: '0.85rem' }}>
                              {formatPrice(item.quantity * item.purchasePrice * (1 + (newOrder.tvaRate ?? settings?.tvaRate ?? 18) / 100))}
                            </td>
                          </>
                        )}
                        <td><button className="btn btn-danger-outline btn-sm" style={{ padding: '2px 6px' }} onClick={() => { const ni = [...newOrder.items]; ni.splice(idx, 1); setNewOrder({ ...newOrder, items: ni }); }}><X size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', marginTop: '1rem', alignItems: 'flex-start' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.85rem' }}>Notes / Justificatif</label>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                    <textarea className="form-control" rows="2" style={{ flex: 1, fontSize: '0.9rem', padding: '8px' }} value={newOrder.notes} onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} placeholder="Observations..."></textarea>
                    <div style={{ minWidth: '100px' }}>
                      <label className="btn btn-secondary btn-sm" style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', padding: '6px 10px', fontSize: '0.8rem' }}>
                        <Paperclip size={14} /> {newOrder.attachment ? 'Changer' : 'Joindre'}
                        <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
                      </label>
                      {newOrder.attachment && <div style={{ fontSize: '0.65rem', color: 'var(--success)', marginTop: '2px', textAlign: 'center' }}>✓ Joint</div>}
                    </div>
                  </div>
                </div>

                {hasPermission(user, 'stock', 'view_cost_price') && newOrder.items.length > 0 && (
                  <div style={{ backgroundColor: 'var(--bg-light)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sous-total HT :</span>
                      <span style={{ fontWeight: 600 }}>{formatPrice(newOrder.items.reduce((sum, item) => sum + (item.quantity * item.purchasePrice), 0))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem', color: 'var(--primary)' }}>
                      <span style={{ fontWeight: 500 }}>TVA ({newOrder.tvaRate ?? settings?.tvaRate ?? 18}%) :</span>
                      <span style={{ fontWeight: 600 }}>{formatPrice(newOrder.items.reduce((sum, item) => sum + (item.quantity * item.purchasePrice * (newOrder.tvaRate ?? settings?.tvaRate ?? 18) / 100), 0))}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px', marginTop: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>TOTAL TTC :</span>
                      <span style={{ fontWeight: 900, color: 'var(--primary)', fontSize: '1.1rem' }}>
                        {formatPrice(newOrder.items.reduce((sum, item) => sum + (item.quantity * item.purchasePrice * (1 + (newOrder.tvaRate ?? settings?.tvaRate ?? 18) / 100)), 0))} FCFA
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setIsModalOpen(false); setIsEditing(false); setSelectedOrder(null); setNewOrder({ clientId: '', notes: '', items: [], deliveryDate: '' }); }}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmitOrder} disabled={newOrder.items.length === 0}><Save size={18} /> {isEditing ? 'Enregistrer les modifications' : 'Créer le Dossier'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Voir Dossier */}
      {isViewModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h3>Détails Dossier #{String(selectedOrder.orderNumber).padStart(3, '0')}</h3>
              <button className="modal-close" onClick={() => setIsViewModalOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '1rem' }}>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1.5fr 1fr', 
                gap: '1rem', 
                marginBottom: '1rem', 
                padding: '0.75rem 1rem', 
                backgroundColor: 'var(--bg-light)', 
                borderRadius: '10px', 
                border: '1px solid var(--border-color)',
                alignItems: 'center'
              }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.9rem' }}><span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Client :</span> <strong style={{ color: 'var(--text-main)', marginLeft: '8px' }}>{selectedOrder.clientName}</strong></p>
                  {selectedOrder.delivery_date && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                      <Truck size={14} style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} />
                      Livraison prévue : {new Date(selectedOrder.delivery_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', display: 'flex', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>Statut :</span> <span className={`badge badge-${selectedOrder.status === 'termine' ? 'success' : 'warning'}`} style={{ marginLeft: '4px', fontSize: '0.75rem' }}>{selectedOrder.status}</span></p>
                  <p style={{ margin: 0, fontSize: '0.85rem' }}><span style={{ color: 'var(--text-muted)' }}>Créé le :</span> <strong style={{ marginLeft: '4px' }}>{new Date(selectedOrder.createdAt).toLocaleDateString()}</strong></p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr', gap: '1.5rem', maxHeight: '65vh' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="table-wrapper" style={{ maxHeight: '420px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                    <table className="table-sm" style={{ width: '100%' }}>
                      <thead style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: 'white' }}>
                        <tr style={{ fontSize: '0.8rem' }}>
                          <th>Code</th>
                          <th>Réf CFAO</th>
                          <th>Désignation</th>
                          <th style={{ textAlign: 'center' }}>Qté</th>
                          {hasPermission(user, 'stock', 'view_cost_price') && (
                            <>
                              <th style={{ textAlign: 'right' }}>P.A CFAO</th>
                              <th style={{ textAlign: 'center' }}>TVA</th>
                              <th style={{ textAlign: 'right' }}>Total (TTC)</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items?.map((item, idx) => (
                          <tr key={idx} style={{ fontSize: '0.85rem' }}>
                            <td style={{ fontWeight: 600 }}>{item.code || '-'}</td>
                            <td>{item.refCfao || '-'}</td>
                            <td style={{ fontSize: '0.8rem', lineHeight: '1.2' }}>{item.description}</td>
                            <td style={{ textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                            {hasPermission(user, 'stock', 'view_cost_price') && (
                              <>
                                <td style={{ textAlign: 'right' }}>{formatPrice(item.purchasePrice || 0)}</td>
                                <td style={{ textAlign: 'center' }}>
                                  <span style={{ fontSize: '0.7rem', padding: '1px 4px', borderRadius: '4px', backgroundColor: 'var(--bg-color)', color: 'var(--primary)', fontWeight: 600 }}>
                                    {selectedOrder.tva_rate || 0}%
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700 }}>
                                  {formatPrice(item.quantity * item.purchasePrice * (1 + (selectedOrder.tva_rate || 0) / 100))}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {hasPermission(user, 'stock', 'view_cost_price') && (
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '10px', textAlign: 'right', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>HT: {formatPrice(selectedOrder.contractAmount)} | TVA: {formatPrice((selectedOrder.contractAmount || 0) * (selectedOrder.tva_rate || 0) / 100)}</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px' }}>
                          TOTAL TTC : {formatPrice((selectedOrder.contractAmount || 0) * (1 + (selectedOrder.tva_rate || 0) / 100))} FCFA
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1.25rem', overflowY: 'auto', maxHeight: '550px' }}>
                  <h4 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}><Clock size={16} /> Historique</h4>
                  <div className="timeline" style={{ position: 'relative' }}>
                    {selectedOrder.history?.map((h, i) => {
                      const prev = selectedOrder.history[i - 1];
                      let durationStr = "";
                      if (prev) {
                        const diff = new Date(h.createdAt) - new Date(prev.createdAt);
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const days = Math.floor(hours / 24);
                        durationStr = days > 0 ? `${days}j ${hours % 24}h` : `${hours}h ${Math.floor((diff / (1000 * 60)) % 60)}m`;
                      }

                      return (
                        <div key={h.id} style={{ position: 'relative', paddingLeft: '1.25rem', paddingBottom: '1rem' }}>
                          <div style={{ position: 'absolute', left: '-5px', top: '5px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: h.newStatus === 'termine' ? 'var(--success)' : 'var(--primary)' }}></div>
                          {i < selectedOrder.history.length - 1 && <div style={{ position: 'absolute', left: '-1px', top: '15px', bottom: '0', width: '2px', backgroundColor: '#e2e8f0' }}></div>}

                          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>{h.newStatus.toUpperCase()}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(h.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {h.userName && <div style={{ fontSize: '0.65rem', color: '#64748b' }}>par {h.userName}</div>}
                          {durationStr && <div style={{ fontSize: '0.65rem', color: 'var(--success)', fontWeight: 600, marginTop: '2px' }}>⏱ {durationStr}</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsViewModalOpen(false)}>Fermer</button>
              {selectedOrder.attachment && (
                <a href={selectedOrder.attachment} target="_blank" rel="noopener noreferrer" className="btn btn-secondary">
                  <Paperclip size={18} /> Voir le Justificatif
                </a>
              )}
              <button className="btn btn-primary" onClick={() => handlePrint(selectedOrder.id)}><Printer size={18} /> Imprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Article Catalogue */}
      {isCatalogModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h3>{catalogItem.id ? 'Modifier Article' : 'Nouvel Article'}</h3><button className="modal-close" onClick={() => setIsCatalogModalOpen(false)}>×</button></div>
            <div className="modal-body">
              <div className="form-group"><label className="form-label">Désignation Produit</label><input type="text" className="form-control" value={catalogItem.name || ''} onChange={e => setCatalogItem({ ...catalogItem, name: e.target.value })} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">Code</label><input type="text" className="form-control" value={catalogItem.code || ''} onChange={e => setCatalogItem({ ...catalogItem, code: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">Référence CFAO</label><input type="text" className="form-control" value={catalogItem.refCfao || ''} onChange={e => setCatalogItem({ ...catalogItem, refCfao: e.target.value })} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">Mine</label>
                <select
                  className="form-control"
                  value={catalogItem.clientId || ''}
                  onChange={e => setCatalogItem({ ...catalogItem, clientId: e.target.value })}
                  disabled={!!selectedMine}
                  style={{ backgroundColor: selectedMine ? '#f8fafc' : 'white' }}
                >
                  <option value="">Toutes les Mines (Global)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {!!selectedMine && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Verrouillé sur la mine sélectionnée.</p>}
              </div>
              {hasPermission(user, 'stock', 'view_cost_price') && (
                <div className="form-group"><label className="form-label">P.A Contrat (FCFA)</label><input type="number" className="form-control" value={catalogItem.purchasePrice || 0} onChange={e => setCatalogItem({ ...catalogItem, purchasePrice: e.target.value })} /></div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setIsCatalogModalOpen(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSaveCatalogItem}><Save size={18} /> Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
      {/* --- MODAL PRÉPARATION BL --- */}
      {isBLModalOpen && printData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>Préparation du Bon de Livraison (BL)</h3>
              <button className="modal-close" onClick={() => { setIsBLModalOpen(false); setPrintData(null); }}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto', padding: '1rem 1.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Modifiez le titre, les quantités ou ajoutez des articles temporaires. Le BL sera archivé avec ces modifications.
              </p>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Titre du Document (Haut)</label>
                  <input
                    type="text"
                    className="form-control"
                    value={printData.blTitleOverride || ''}
                    onChange={e => setPrintData({ ...printData, blTitleOverride: e.target.value })}
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

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Référence / Objet (Zone Libre)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={printData.requestRef || ''}
                    onChange={e => setPrintData({ ...printData, requestRef: e.target.value })}
                    style={{ fontWeight: '600', padding: '6px 12px', resize: 'vertical' }}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Détails du Destinataire (Bloc de droite)</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', borderColor: 'var(--primary)', resize: 'vertical' }}
                    value={printData.customRecipientDetails || ''}
                    onChange={e => setPrintData({ ...printData, customRecipientDetails: e.target.value })}
                    placeholder="Nom, Adresse, RCCM, NIF..."
                  ></textarea>
                </div>
              </div>

              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '0.8rem', marginBottom: '0.75rem' }}>
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
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Signataire (Nom)</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px' }} value={printData.customSupervisorName || ''} onChange={e => setPrintData({ ...printData, customSupervisorName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Titre</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px' }} value={printData.customSupervisorTitle || ''} onChange={e => setPrintData({ ...printData, customSupervisorTitle: e.target.value })} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Numéro de Document (Manuel)</label>
                <input
                  type="text"
                  className="form-control"
                  style={{ padding: '6px 12px', fontWeight: 'bold' }}
                  value={printData.customDocNumber || ''}
                  onChange={e => setPrintData({ ...printData, customDocNumber: e.target.value })}
                  placeholder={`Par défaut: BL-${String(printData.orderNumber || 'SPEC').padStart(3, '0')}-...`}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Notes / Instructions de Livraison</label>
                <textarea
                  className="form-control"
                  rows="2"
                  style={{ padding: '8px 12px', fontSize: '0.9rem', resize: 'vertical' }}
                  value={printData.printNotes || ''}
                  onChange={e => setPrintData({ ...printData, printNotes: e.target.value })}
                  placeholder="Ex: Livrer au magasin C, contact : M. Traoré..."
                ></textarea>
              </div>

              {/* Personnalisation Libellés BL */}
              <div style={{ padding: '1rem', backgroundColor: '#fdf2f2', borderRadius: '8px', border: '1px solid #fecaca', marginBottom: '1rem' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#b91c1c' }}>Libellés des colonnes (BL)</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  <input type="text" className="form-control form-control-sm" value={printData.blColNo || ''} onChange={e => setPrintData({ ...printData, blColNo: e.target.value })} placeholder="Col 1 (N°)" />
                  <input type="text" className="form-control form-control-sm" value={printData.blColSite || ''} onChange={e => setPrintData({ ...printData, blColSite: e.target.value })} placeholder="Col 2 (Site)" />
                  <input type="text" className="form-control form-control-sm" value={printData.blColDesc || ''} onChange={e => setPrintData({ ...printData, blColDesc: e.target.value })} placeholder="Col 3 (Désignation)" />
                  <input type="text" className="form-control form-control-sm" value={printData.blColCode || ''} onChange={e => setPrintData({ ...printData, blColCode: e.target.value })} placeholder="Col 4 (Code)" />
                  <input type="text" className="form-control form-control-sm" value={printData.blColRef || ''} onChange={e => setPrintData({ ...printData, blColRef: e.target.value })} placeholder="Col 5 (Référence)" />
                  <input type="text" className="form-control form-control-sm" value={printData.blColQty || ''} onChange={e => setPrintData({ ...printData, blColQty: e.target.value })} placeholder="Col 6 (Qté)" />
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '15%' }}>Code</th>
                      <th style={{ width: '35%' }}>Désignation</th>
                      <th style={{ width: '25%' }}>Référence</th>
                      <th style={{ width: '15%' }}>Quantité</th>
                      <th style={{ width: '10%' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td><input type="text" className="form-control" value={item.code || ''} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].code = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} /></td>
                        <td><input type="text" className="form-control" value={item.description} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].description = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} /></td>
                        <td><input type="text" className="form-control" value={item.refCfao} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].refCfao = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} /></td>
                        <td><input type="number" className="form-control" value={item.quantity} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].quantity = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} /></td>
                        <td>
                          <button className="btn btn-danger-outline" onClick={() => {
                            const newItems = printData.items.filter((_, i) => i !== idx);
                            setPrintData({ ...printData, items: newItems });
                          }}><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-secondary" style={{ marginTop: '1rem' }} onClick={() => {
                const newItems = [...printData.items, { code: '', description: '', refCfao: '', quantity: 1 }];
                setPrintData({ ...printData, items: newItems });
              }}>
                <Plus size={16} /> Ajouter un article
              </button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setIsBLModalOpen(false); setPrintData(null); }}>Annuler</button>
              <button className="btn btn-primary" onClick={() => handleSaveAndPrintBL(printData)}>
                <Truck size={18} /> Sauvegarder & Imprimer le BL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL HISTORIQUE BL --- */}
      {isBLHistoryOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Historique des Livraisons</h3>
              <button className="modal-close" onClick={() => setIsBLHistoryOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {currentDeliveries.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem' }}>Aucune livraison enregistrée pour ce dossier.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>N° BL</th><th>Date</th><th>Articles</th><th>Actions</th></tr></thead>
                    <tbody>
                      {currentDeliveries.map(del => (
                        <tr key={del.id}>
                          <td style={{ fontWeight: 600 }}>{del.bl_number}</td>
                          <td>{new Date(del.created_at).toLocaleDateString('fr-FR')}</td>
                          <td>{(typeof del.items === 'string' ? JSON.parse(del.items || '[]') : (del.items || [])).length} articles</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => {
                                const items = typeof del.items === 'string' ? JSON.parse(del.items || '[]') : (del.items || []);
                                const client = clients.find(c => String(c.id) === String(printData?.clientId || currentDeliveries[0]?.clientId || del.clientId));
                                setPrintData({
                                  ...printData,
                                  items,
                                  orderNumber: del.bl_number.split('-')[1],
                                  clientName: client?.name || 'Client',
                                  blNumber: del.bl_number,
                                  customDate: del.created_at ? new Date(del.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                                });
                                setIsPrintingBL(true);
                                setTimeout(() => { window.print(); setIsPrintingBL(false); setPrintData(null); }, 800);
                              }}><Printer size={16} /></button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleFileUpload(del.id, 'bl')} title={del.attachment ? "Changer le scan" : "Joindre un scan/fichier"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}>
                                <Paperclip size={16} style={{ color: del.attachment ? 'var(--primary)' : '#64748b' }} />
                              </button>
                              {del.attachment && (
                                <a href={del.attachment} target="_blank" rel="noopener noreferrer" className="btn btn-info-outline btn-sm" title="Voir le scan joint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}>
                                  <Eye size={16} />
                                </a>
                              )}
                              <button className="btn btn-danger-outline btn-sm" onClick={() => handleDeleteDelivery(del.id, del.order_id)}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL HISTORIQUE BC --- */}
      {isBCHistoryOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Historique des Bons de Commande</h3>
              <button className="modal-close" onClick={() => setIsBCHistoryOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {currentBCs.length === 0 ? (
                <p style={{ textAlign: 'center', padding: '2rem' }}>Aucun bon de commande archivé pour ce dossier.</p>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>N° BC</th><th>Date</th><th>Articles</th><th>Actions</th></tr></thead>
                    <tbody>
                      {currentBCs.map(bc => (
                        <tr key={bc.id}>
                          <td style={{ fontWeight: 600 }}>{bc.bc_number}</td>
                          <td>{new Date(bc.created_at).toLocaleDateString('fr-FR')}</td>
                          <td>{(typeof bc.items === 'string' ? JSON.parse(bc.items || '[]') : (bc.items || [])).length} articles</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button className="btn btn-secondary btn-sm" onClick={async () => {
                                const items = typeof bc.items === 'string' ? JSON.parse(bc.items || '[]') : (bc.items || []);
                                // Recharger le dossier complet pour avoir les infos client/fournisseur
                                const fullOrder = await storage.get(`contract-orders/${bc.order_id}`);
                                const client = clients.find(c => String(c.id) === String(fullOrder.clientId));
                                const supplier = partners.find(s => String(s.id) === String(fullOrder.supplierId));

                                setPrintData({
                                  ...fullOrder,
                                  items,
                                  orderNumber: bc.bc_number.split('-')[1],
                                  bcTitleOverride: bc.title,
                                  sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
                                  requestRef: bc.request_ref,
                                  clientName: client?.name,
                                  supplierName: supplier?.name,
                                  supplierAddress: supplier?.address,
                                  supplierBP: supplier?.bp,
                                  supplierPhone: supplier?.phone,
                                  supplierMyClientCode: supplier?.myClientCode,
                                  supplierRCCM: supplier?.rccm,
                                  supplierNIF: supplier?.nif,
                                  customDate: bc.created_at ? new Date(bc.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
                                });
                                setIsPrinting(true);
                                setTimeout(() => { window.print(); setIsPrinting(false); setPrintData(null); }, 800);
                              }}><Printer size={16} /></button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleFileUpload(bc.id, 'bc')} title={bc.attachment ? "Changer le scan" : "Joindre un scan/fichier"} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}>
                                <Paperclip size={16} style={{ color: bc.attachment ? 'var(--primary)' : '#64748b' }} />
                              </button>
                              {bc.attachment && (
                                <a href={bc.attachment} target="_blank" rel="noopener noreferrer" className="btn btn-info-outline btn-sm" title="Voir le scan joint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '32px' }}>
                                  <Eye size={16} />
                                </a>
                              )}
                              <button className="btn btn-danger-outline btn-sm" onClick={() => deleteBCHistory(bc.id, bc.order_id)}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL PRÉPARATION BC --- */}
      {isBCPrintModalOpen && printData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
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

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Référence / Objet (Zone Libre)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={printData.requestRef || ''}
                    onChange={e => setPrintData({ ...printData, requestRef: e.target.value })}
                    style={{ fontWeight: '600', padding: '6px 12px', resize: 'vertical' }}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 'bold' }}>Détails du Destinataire (Bloc de droite)</label>
                  <textarea
                    className="form-control"
                    rows="4"
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
                  <input type="number" className="form-control" style={{ padding: '6px 12px' }} value={printData.customTvaRate} onChange={e => setPrintData({ ...printData, customTvaRate: parseFloat(e.target.value) || 0 })} disabled={printData.isExempt} />
                </div>
              </div>

              {printData.isExempt && (
                <div className="form-group" style={{ marginBottom: '1rem', animation: 'fadeIn 0.3s ease' }}>
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem', color: '#b91c1c', fontWeight: 'bold' }}>Référence de l'Exonération (Mention légale)</label>
                  <input
                    type="text"
                    className="form-control"
                    style={{ padding: '6px 12px', borderColor: '#fecaca', backgroundColor: '#fff5f5' }}
                    value={printData.exemptionMention}
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
                  onChange={e => setPrintData({ ...printData, customDocNumber: e.target.value })}
                  placeholder={`Par défaut: BC-${String(printData.orderNumber || 'SPEC').padStart(3, '0')}-...`}
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

              {/* Personnalisation Libellés BC */}
              <div style={{ padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '1rem' }}>
                <h5 style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#1e40af' }}>Libellés des colonnes (BC)</h5>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  <input type="text" className="form-control form-control-sm" value={printData.bcColNo || ''} onChange={e => setPrintData({ ...printData, bcColNo: e.target.value })} placeholder="Col 1 (N°)" />
                  <input type="text" className="form-control form-control-sm" value={printData.bcColSite || ''} onChange={e => setPrintData({ ...printData, bcColSite: e.target.value })} placeholder="Col 2 (Site)" />
                  <input type="text" className="form-control form-control-sm" value={printData.bcColDesc || ''} onChange={e => setPrintData({ ...printData, bcColDesc: e.target.value })} placeholder="Col 3 (Désignation)" />
                  <input type="text" className="form-control form-control-sm" value={printData.bcColCode || ''} onChange={e => setPrintData({ ...printData, bcColCode: e.target.value })} placeholder="Col 4 (Code)" />
                  <input type="text" className="form-control form-control-sm" value={printData.bcColRef || ''} onChange={e => setPrintData({ ...printData, bcColRef: e.target.value })} placeholder="Col 5 (Référence)" />
                  <input type="text" className="form-control form-control-sm" value={printData.bcColQty || ''} onChange={e => setPrintData({ ...printData, bcColQty: e.target.value })} placeholder="Col 6 (Qté)" />
                  <input type="text" className="form-control form-control-sm" value={printData.bcColPrice || ''} onChange={e => setPrintData({ ...printData, bcColPrice: e.target.value })} placeholder="Col 7 (P. HTVA)" />
                  <input type="text" className="form-control form-control-sm" value={printData.bcColTotal || ''} onChange={e => setPrintData({ ...printData, bcColTotal: e.target.value })} placeholder="Col 8 (Total HTVA)" />
                </div>
              </div>

              <div className="table-wrapper" style={{ marginTop: '1.5rem' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Code</th>
                      <th style={{ width: '100px' }}>Réf. CFAO</th>
                      <th>Désignation / Article</th>
                      <th style={{ width: '100px' }}>Qté</th>
                      <th style={{ width: '130px' }}>P.A (HT)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.items.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ width: '100px' }}><input type="text" className="form-control form-control-sm" value={item.code || ''} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].code = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} placeholder="Code" /></td>
                        <td style={{ width: '100px' }}><input type="text" className="form-control form-control-sm" value={item.refCfao || ''} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].refCfao = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} placeholder="Réf" /></td>
                        <td><input type="text" className="form-control form-control-sm" value={item.description || ''} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].description = e.target.value;
                          setPrintData({ ...printData, items: newItems });
                        }} placeholder="Nom de l'article" /></td>
                        <td style={{ width: '100px' }}><input type="number" className="form-control" style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }} value={item.quantity || 1} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].quantity = Number(e.target.value);
                          setPrintData({ ...printData, items: newItems });
                        }} min="1" /></td>
                        <td style={{ width: '120px' }}><input type="number" className="form-control form-control-sm" style={{ textAlign: 'right' }} value={item.purchasePrice} onChange={e => {
                          const newItems = [...printData.items];
                          newItems[idx].purchasePrice = Number(e.target.value);
                          setPrintData({ ...printData, items: newItems });
                        }} min="0" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button className="btn btn-secondary btn-sm" style={{ marginTop: '1rem' }} onClick={() => {
                const newItems = [...printData.items, { code: '', description: '', refCfao: '', quantity: 1, purchasePrice: 0 }];
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

      {/* --- MODAL IMPORT CATALOGUE --- */}
      {isImportModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Importer Catalogue (Excel)</h3>
              <button className="modal-close" onClick={() => setIsImportModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div style={{ padding: '1.25rem', backgroundColor: '#f0f9ff', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.85rem', border: '1px solid #bae6fd' }}>
                <p style={{ fontWeight: '800', marginBottom: '0.75rem', color: '#0369a1', fontSize: '0.95rem' }}>Guide d'Importation Intelligent</p>
                
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontWeight: '700', marginBottom: '0.4rem', fontSize: '0.85rem' }}>1. Colonnes reconnues :</p>
                  <ul style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: '1.5' }}>
                    <li><strong>Désignation</strong> (Obligatoire)</li>
                    <li><strong>Code</strong> / <strong>Réf CFAO</strong></li>
                    <li><strong>Prix Achat Contrat</strong></li>
                    <li><strong>Mine</strong> (Facultatif : nom du client)</li>
                  </ul>
                </div>

                <div>
                  <p style={{ fontWeight: '700', marginBottom: '0.4rem', fontSize: '0.85rem' }}>2. Flexibilité du format :</p>
                  <ul style={{ paddingLeft: '1.25rem', margin: 0, lineHeight: '1.5', color: '#0c4a6e' }}>
                    <li><strong>Prix</strong> : Les espaces, virgules et points sont acceptés (ex: 41 607,50). Le système arrondit automatiquement à l'unité.</li>
                    <li><strong>En-têtes</strong> : Pas de panique sur les majuscules ou les accents, ils sont détectés automatiquement.</li>
                    <li><strong>Doublons</strong> : Si une référence existe déjà pour une mine, elle sera mise à jour.</li>
                  </ul>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Sélectionner le fichier Excel</label>
                <input
                  type="file"
                  className="form-control"
                  accept=".xlsx, .xls"
                  onChange={handleImportCatalog}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setIsImportModalOpen(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
