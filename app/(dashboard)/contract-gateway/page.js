'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  Globe, Plus, Search, FileText, ChevronRight, 
  Clock, CheckCircle2, XCircle, AlertTriangle, 
  ArrowUpRight, Printer, Download, Eye, Trash2, Edit,
  ShoppingCart, Truck, Package, X, ArrowRight,
  BookOpen, LayoutList, Save, FileSpreadsheet, Paperclip, History,
  Timer, PieChart as LucidePieChart
} from 'lucide-react';
import AlertModal from '../../components/AlertModal';
import { useAuth } from '../../providers';
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
  }
  .print-only { display: none; }
`;

export default function ContractGatewayPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('dossiers');
  const [orders, setOrders] = useState([]);
  const [specialDocs, setSpecialDocs] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clients, setClients] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [reportItems, setReportItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [partners, setPartners] = useState([]);
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  
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
  const [newOrder, setNewOrder] = useState({ clientId: '', supplierId: '', notes: '', items: [] });
  const [catalogItem, setCatalogItem] = useState({ code: '', refCfao: '', name: '', purchasePrice: 0, clientId: '' });
  
  const [itemSearch, setItemSearch] = useState('');
  const [suggestions, setSuggestions] = useState([]);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedCatalogClient, setSelectedCatalogClient] = useState('');
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });

  useEffect(() => {
    loadPartners();
  }, []);

  useEffect(() => {
    if (activeTab === 'rapports') {
      loadStats();
    }
  }, [activeTab, dateRange.start, dateRange.end]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch(`/api/contract-stats?startDate=${dateRange.start}&endDate=${dateRange.end}`, {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      const data = await res.json();
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
  }, [dateRange.start, dateRange.end, selectedCatalogClient, selectedPartner]);

  const loadPartners = async () => {
    try {
      const data = await storage.get('contract-partners');
      setPartners(data || []);
      if (data && data.length > 0) {
        const saved = localStorage.getItem('selectedPartnerId');
        const partner = data.find(p => p.id === saved) || data[0];
        setSelectedPartner(partner);
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
      const ordersKey = `contract-orders?startDate=${dateRange.start}&endDate=${dateRange.end}&partnerId=${pId}`;
      const catalogKey = selectedCatalogClient 
        ? `contract-catalog?clientId=${selectedCatalogClient}&partnerId=${pId}` 
        : `contract-catalog?partnerId=${pId}`;

      const timestamp = Date.now();
      const [ordersData, specialData, catalogData, clientsData, suppliersData, settingsData, reportData] = await Promise.all([
        storage.get(ordersKey),
        storage.get(`contract-special-docs?partnerId=${pId}&startDate=${dateRange.start}&endDate=${dateRange.end}&t=${timestamp}`),
        storage.get(catalogKey),
        storage.get('clients'),
        storage.get('fournisseurs'),
        storage.get('settings'),
        storage.get(`contract-reports/items?startDate=${dateRange.start}&endDate=${dateRange.end}&partnerId=${pId}`)
      ]);
      setOrders(ordersData);
      if (specialData) setSpecialDocs(specialData);
      setCatalog(catalogData);
      setClients(clientsData);
      setSuppliers(suppliersData);
      setSettings(settingsData);
      if (reportData) setReportItems(reportData);

      const partnerName = selectedPartner.name.toUpperCase();
      const currentSupplier = suppliersData.find(s => s.name.toUpperCase().includes(partnerName));
      if (currentSupplier) setNewOrder(prev => ({ ...prev, supplierId: currentSupplier.id }));
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportOrderToExcel = async (orderId) => {
    try {
      setLoading(true);
      const fullOrder = await storage.get(`contract-orders/${orderId}`);
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
    XLSX.utils.book_append_sheet(wb, ws, `Catalogue ${selectedPartner?.name || 'Partenaire'}`);
    XLSX.writeFile(wb, `Catalogue_${selectedPartner?.name || 'Partenaire'}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportOrdersToExcel = () => {
    const data = orders.map(o => ({
      'Référence Dossier': String(o.orderNumber).padStart(3, '0'),
      'Client': o.clientName,
      'Statut': o.status,
      'Montant Achat': o.contractAmount,
      'Montant Vente': o.totalAmount,
      'Marge': o.margin,
      'Date Création': new Date(o.createdAt).toLocaleDateString()
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Achats Partenaires");
    XLSX.writeFile(wb, `Dossiers_Virtuels_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const exportReportToExcel = () => {
    const data = reportItems.map(item => ({
      'Date': new Date(item.orderDate).toLocaleDateString(),
      'N° Dossier': String(item.orderNumber).padStart(3, '0'),
      'Client': item.clientName,
      [`Réf ${selectedPartner?.name || 'Partenaire'}`]: item.code || '-',
      [`Réf ${selectedPartner?.name || 'Partenaire'} (Longue)`]: item.refCfao || '-',
      'Désignation': item.description,
      'Quantité': item.quantity,
      'P.A (FCFA)': item.purchasePrice,
      'Total Achat (FCFA)': item.purchasePrice * item.quantity
    }));
    const totalGlobal = data.reduce((sum, row) => sum + row['Total Achat (FCFA)'], 0);
    data.push({
      'Date': 'TOTAL GÉNÉRAL',
      'N° Dossier': '',
      'Client': '',
      'Réf CFAO': '',
      'Réf CFAO (Longue)': '',
      'Désignation': '',
      'Quantité': '',
      'P.A (FCFA)': '',
      'Total Achat (FCFA)': totalGlobal
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Achats ${selectedPartner?.name || 'Partenaire'} Clôturés`);
    XLSX.writeFile(wb, `Achats_${selectedPartner?.name || 'Partenaire'}_Clotures_${dateRange.start}_au_${dateRange.end}.xlsx`);
  };

  // --- IMPRESSION LOGIC ---
  const handlePrint = async (orderId) => {
    try {
      setLoading(true);
      const fullOrder = await storage.get(`contract-orders/${orderId}`);
      if (!fullOrder || fullOrder.error) throw new Error(fullOrder?.error || "Dossier introuvable");
      
      const client = clients.find(c => String(c.id) === String(fullOrder.clientId));
      const supplier = suppliers.find(s => String(s.id) === String(fullOrder.supplierId));
      
      setPrintData({
        ...fullOrder,
        clientName: client?.name || fullOrder.clientName || 'Client Non Défini',
        clientCode: client ? client.clientCode : 'Non Défini',
        supplierName: (selectedPartner?.name) || (supplier?.name) || 'Fournisseur Non Défini',
        supplierAddress: (selectedPartner?.address) || (supplier?.address) || '',
        supplierBP: (selectedPartner?.bp) || (supplier?.bp) || '',
        supplierPhone: (selectedPartner?.phone) || (supplier?.phone) || '',
        supplierMyClientCode: (selectedPartner?.my_client_code) || (supplier?.myClientCode) || 'CL-001',
        supplierRCCM: (selectedPartner?.rccm) || (supplier?.rccm) || '',
        supplierNIF: (selectedPartner?.nif) || (supplier?.nif) || '',
        bcTitleOverride: selectedPartner?.bc_prefix || settings?.bcTitlePrefix || `BON DE COMMANDE N°NSA-${selectedPartner?.name?.toUpperCase() || 'PARTENAIRE'}`,
        requestRef: `REQUEST ${client ? client.name.toUpperCase() : 'GENERAL'}`,
        customDate: new Date().toISOString().split('T')[0],
        customCity: settings?.city || 'Ouagadougou',
        customSupervisorName: selectedPartner?.supervisor_name || settings?.supervisorName || 'Guy Roland TONDE',
        customSupervisorTitle: selectedPartner?.supervisor_title || settings?.supervisorTitle || 'Superviseur Général',
        customTvaRate: settings?.tvaRate !== undefined ? settings.tvaRate : 18,
        items: fullOrder.items || [],
        customRecipientDetails: [
          selectedPartner?.name || supplier?.name,
          selectedPartner?.address || supplier?.address,
          (selectedPartner?.bp || supplier?.bp) ? `BP : ${selectedPartner?.bp || supplier?.bp}` : null,
          (selectedPartner?.phone || supplier?.phone) ? `Tél : ${selectedPartner?.phone || supplier?.phone}` : null,
          (selectedPartner?.rccm || supplier?.rccm) ? `RCCM : ${selectedPartner?.rccm || supplier?.rccm}` : null,
          (selectedPartner?.nif || supplier?.nif) ? `IFU : ${selectedPartner?.nif || supplier?.nif}` : null
        ].filter(Boolean).join('\n')
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
        const dateStr = dateObj.toLocaleDateString('fr-FR').replace(/\//g, '');
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
      blTitleOverride: type === 'BL' ? (doc.title || selectedPartner?.bl_prefix || 'BORDEREAU DE LIVRAISON SPÉCIAL') : '',
      requestRef: doc.requestRef || `REQUEST ${(doc.clientName || 'GENERAL').toUpperCase()}`,
      customDate: new Date().toISOString().split('T')[0],
      customCity: settings?.city || 'Ouagadougou',
      customSupervisorName: type === 'BC' 
        ? (selectedPartner?.supervisor_name || settings?.supervisorName || 'Guy Roland TONDE') 
        : (selectedPartner?.bl_supervisor_name || settings?.blSupervisorName || 'Huges Christian SOW'),
      customSupervisorTitle: type === 'BC' 
        ? (selectedPartner?.supervisor_title || settings?.supervisorTitle || 'Superviseur Général') 
        : (selectedPartner?.bl_supervisor_title || settings?.blSupervisorTitle || 'Responsable Logistique Adjoint'),
      customTvaRate: settings?.tvaRate !== undefined ? settings.tvaRate : 18,
      items: doc.items || [],
      // Pour les docs libres, on veut exactement ce qui est saisi dans les zones de texte
      supplierName: doc.supplierName || (selectedPartner?.name) || 'NS AUTO',
      supplierAddress: doc.supplierName ? '' : (selectedPartner?.address || ''),
      supplierBP: doc.supplierName ? '' : (selectedPartner?.bp || ''),
      supplierPhone: doc.supplierName ? '' : (selectedPartner?.phone || ''),
      supplierMyClientCode: (selectedPartner?.my_client_code) || 'CL-001',
      supplierRCCM: doc.supplierName ? '' : (selectedPartner?.rccm || ''),
      supplierNIF: doc.supplierName ? '' : (selectedPartner?.nif || ''),
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
      const res = await fetch(`/api/contract-bc-history?orderId=${orderId}`, {
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
      const fullOrder = await storage.get(`contract-orders/${orderId}`);
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
        ].filter(Boolean).join('\n')
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
      const dateStr = dateObj.toLocaleDateString('fr-FR').replace(/\//g, '');
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
          // Normalisation des colonnes avec gestion des fautes de frappe et variantes
          const code = String(row['Code'] || row['code'] || '').trim();
          const refCfao = String(row['Réf CFAO'] || row['ref cfao'] || row['Ref CFAO'] || row['Référence'] || '').trim();
          
          // Gestion flexible du nom (Désignation)
          const name = String(
            row['Désignation'] || row['designation'] || 
            row['designiation'] || // Gestion de la faute de frappe de l'utilisateur
            row['Nom'] || row['Article'] || row['Libellé'] || ''
          ).trim();
          
          // Gestion flexible du prix
          const price = parseFloat(
            row['Prix Achat Contrat'] || row['prix'] || 
            row['PA'] || row['Prix'] || row['Montant'] || 0
          );
          
          const mineName = row['Mine'] || row['mine'] || row['Client'] || row['Site'];
          
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
    setNewOrder({ ...newOrder, items: [...newOrder.items, item] });
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
      setNewOrder({ clientId: '', notes: '', items: [] });
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
        supplierId: fullOrder.supplierId,
        notes: fullOrder.notes,
        items: fullOrder.items
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
        if (t === 7 || t === 9) return tens[t-1] + '-' + convert(u + 10);
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
      return num.toString(); // Simplifié pour > 1M
    };
    
    const res = convert(n);
    return res.charAt(0).toUpperCase() + res.slice(1);
  };

  if (isPrinting && printData) {
    if (printData.isCatalog) {
      // Garder l'ancien format pour le catalogue
      return (
        <div className="receipt-print-only" style={{ display: 'block', padding: '40px', backgroundColor: 'white' }}>
          <h1 style={{ textAlign: 'center' }}>CATALOGUE CFAO</h1>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2' }}>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Code</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Réf CFAO</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>Désignation</th>
                <th style={{ border: '1px solid #ddd', padding: '8px' }}>P.A Contrat</th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((it, i) => (
                <tr key={i}>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{it.code}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{it.refCfao}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px' }}>{it.description}</td>
                  <td style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'right' }}>{(it.purchasePrice || 0).toLocaleString()}</td>
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
    
    // Robust styles for print borders
    const printBorder = '1.5pt solid #000 !important';
    const cellStyle = { 
      border: printBorder, 
      padding: '8px 6px', 
      fontSize: '10px', 
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
        <style dangerouslySetInnerHTML={{ __html: `
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
          {/* Header Logo & Info */}
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            {(selectedPartner?.logo || settings?.logo) && <img src={selectedPartner?.logo || settings?.logo} alt="Logo" style={{ maxHeight: '80px' }} />}
            <h1 style={{ margin: '5px 0 0 0', color: '#b91c1c', fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase' }}>{selectedPartner?.header_text || settings?.companyName || 'NS AUTO'}</h1>
            <div style={{ width: '100%', height: '3px', backgroundColor: '#b91c1c', margin: '5px 0' }}></div>
          </div>

          <div style={{ border: '2pt solid #000', padding: '12px', textAlign: 'center', marginBottom: '20px', backgroundColor: '#f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              {printData.bcTitleOverride || settings?.bcTitlePrefix || 'BON DE COMMANDE'} : &nbsp;&nbsp; 
              {printData.customDocNumber || `BC-${String(printData.orderNumber || 'SPEC').padStart(3, '0')}-${new Date(printData.customDate || Date.now()).toLocaleDateString('fr-FR').replace(/\//g, '')}`}
            </h2>
          </div>

          {/* Info Blocks Grid */}
          <table className="header-info" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '10px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11px' }}><strong>{settings?.companyName} SARL</strong> / Code client : {printData.supplierMyClientCode}</p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.address}</p>
                  <p style={{ margin: '0 0 3px 0' }}>RCCM : {settings?.rccm || 'BF BBD 2018 B 0372'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>IFU : {settings?.nif || '00102506 K'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.bp || 'BP 1245 Bobo-dioulasso'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.division || 'Division des Grandes Entreprises'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.taxSystem || 'Réel Normal d\'Imposition'}</p>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '10px' }}>
                  <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                    {printData.customRecipientDetails ? (
                      <div style={{ fontWeight: 'bold' }}>{printData.customRecipientDetails}</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
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
                <td colSpan="2" style={{ textAlign: 'center', backgroundColor: '#e5e7eb', padding: '6px', fontWeight: 'bold', fontSize: '13px' }}>
                  {printData.requestRef || `REQUEST ${printData.clientName?.toUpperCase() || 'GENERAL'}`}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Main Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, width: '40px' }}>N°</th>
                <th style={{ ...tableHeaderStyle, width: '60px' }}>Site</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Désignation / Article</th>
                <th style={{ ...tableHeaderStyle, width: '80px' }}>Code</th>
                <th style={{ ...tableHeaderStyle, width: '90px' }}>Ref. CFAO</th>
                <th style={{ ...tableHeaderStyle, width: '40px' }}>Qté</th>
                <th style={{ ...tableHeaderStyle, width: '90px', textAlign: 'right' }}>Prix HTVA (F. CFA)</th>
                <th style={{ ...tableHeaderStyle, width: '90px', textAlign: 'right' }}>Total HTVA (F. CFA)</th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{printData.customSite || (printData.clientName || 'SPEC').substring(0,4).toUpperCase()}</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.description}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.code || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.refCfao || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ ...cellStyle, textAlign: 'right' }}>{(isPurchaseDoc ? item.purchasePrice : item.sellPrice).toLocaleString()}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold' }}>{((isPurchaseDoc ? item.purchasePrice : item.sellPrice) * item.quantity).toLocaleString()}</td>
                </tr>
              ))}
              
              <tr>
                <td colSpan="7" style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>MONTANT HTVA</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>{amountHT.toLocaleString()}</td>
              </tr>
              <tr>
                <td colSpan="7" style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>MONTANT TVA {tvaValue}%</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '8px' }}>{amountTVA.toLocaleString()}</td>
              </tr>
              <tr style={{ backgroundColor: '#d1d5db' }}>
                <td colSpan="7" style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px', fontSize: '14px' }}>TOTAL NET A PAYER</td>
                <td style={{ textAlign: 'right', fontWeight: 'bold', padding: '12px', fontSize: '14px' }}>{amountTTC.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {printData.printNotes && (
            <div style={{ marginTop: '15px', padding: '10px', border: '1pt solid #eee', backgroundColor: '#fafafa', borderRadius: '4px' }}>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>Notes / Instructions Spécifiques :</p>
              <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', color: '#333' }}>{printData.printNotes}</p>
            </div>
          )}

          {/* Signature Block */}
          <div style={{ marginTop: '25px' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '12px' }}>Arrêtée la présente facture à la somme de :</p>
            <p style={{ fontWeight: 'bold', fontSize: '15px', margin: '0 0 30px 0' }}>
              {numberToWords(Math.round(amountTTC))} ( {Math.round(amountTTC).toLocaleString()} Francs CFA TTC )
            </p>

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
                    <p style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '18px', margin: 0 }}>
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
          borderTop: '2px solid #000' // Ligne de sécurité
        }}>
          {/* Black decorative element on the left */}
          <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '70px', backgroundColor: '#000', clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)' }}></div>
          
          <div style={{ padding: '0 80px', position: 'relative', zIndex: 2 }}>
            <p style={{ margin: '0', fontWeight: 'bold', fontSize: '11px' }}>
              {settings?.taxSystem || `${settings?.companyName} - RCCM ${settings?.rccm || 'BF BBD 2018 B 0372'} - IFU ${settings?.nif || '00102506 K'} - RNI - Direction des Moyennes Entreprises`}
            </p>
            <p style={{ margin: '2px 0' }}>{settings?.secondaryAddress || '01 BP 1245 Bobo Dioulasso 01 - Secteur 05 - Parcelle C - Lot 131ter - Tél.: +226 25 37 62 62'}</p>
            <p style={{ margin: '2px 0' }}>{settings?.footerMessage || `E-mail : ${settings?.email || 'commercial@nsautobf.com'} - Site web : ${settings?.website || 'www.nsauto.com'}`}</p>
            <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{settings?.bankInfo || 'IB bank 001193300101 / ECOBANK N°281753286301 - 74'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (isPrintingBL && printData) {
    const printBorder = '1.5pt solid #000 !important';
    const cellStyle = { border: printBorder, padding: '8px 6px', fontSize: '11px', verticalAlign: 'middle', boxSizing: 'border-box', color: '#000' };
    const tableHeaderStyle = { ...cellStyle, backgroundColor: '#d1d5db', fontWeight: 'bold', textAlign: 'center', fontSize: '10px', WebkitPrintColorAdjust: 'exact' };

    return (
      <div className="receipt-print-only" style={{ 
        display: 'block', backgroundColor: 'white', width: '21cm', minHeight: '29.7cm', padding: '0', position: 'relative', fontFamily: '"Times New Roman", Times, serif'
      }}>
        <style dangerouslySetInnerHTML={{ __html: `
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
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            {(selectedPartner?.logo || settings?.logo) && <img src={selectedPartner?.logo || settings?.logo} alt="Logo" style={{ maxHeight: '80px' }} />}
            <h1 style={{ margin: '5px 0 0 0', color: '#b91c1c', fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase' }}>{selectedPartner?.header_text || settings?.companyName || 'NS AUTO'}</h1>
            <div style={{ width: '100%', height: '3px', backgroundColor: '#b91c1c', margin: '5px 0' }}></div>
          </div>

          <div style={{ border: '2pt solid #000', padding: '12px', textAlign: 'center', marginBottom: '20px', backgroundColor: '#f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', letterSpacing: '1px' }}>
              {printData.blTitleOverride || settings?.blTitlePrefix || 'BORDEREAU DE LIVRAISON'} : &nbsp;&nbsp; 
              {printData.customDocNumber || `BL-${String(printData.orderNumber || 'SPEC').padStart(3, '0')}-${new Date(printData.customDate || Date.now()).toLocaleDateString('fr-FR').replace(/\//g, '')}`}
            </h2>
          </div>

          {/* Info Blocks */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '10px', border: printBorder }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '11px' }}><strong>{settings?.companyName} SARL</strong></p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.address}</p>
                  <p style={{ margin: '0 0 3px 0' }}>RCCM : {settings?.rccm || 'BF BBD 2018 B 0372'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>IFU : {settings?.nif || '00102506 K'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.bp || 'BP 1245 Bobo-dioulasso'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.division || 'Division des Grandes Entreprises'}</p>
                  <p style={{ margin: '0 0 3px 0' }}>{settings?.taxSystem || 'Réel Normal d\'Imposition'}</p>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '10px', border: printBorder }}>
                  <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                    {printData.customRecipientDetails ? (
                      <div style={{ fontWeight: 'bold' }}>{printData.customRecipientDetails}</div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '8px' }}>
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
                <td colSpan="2" style={{ textAlign: 'center', backgroundColor: '#e5e7eb', padding: '6px', fontWeight: 'bold', fontSize: '13px', border: printBorder }}>
                  {printData.requestRef || `URGENT REQUEST ${printData.clientName?.toUpperCase()}`}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, width: '40px' }}>N°</th>
                <th style={{ ...tableHeaderStyle, width: '60px' }}>Site</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'left' }}>Désignation / Article</th>
                <th style={{ ...tableHeaderStyle, width: '80px' }}>Code</th>
                <th style={{ ...tableHeaderStyle, width: '100px' }}>Réf. CFAO</th>
                <th style={{ ...tableHeaderStyle, width: '50px' }}>Qté</th>
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, i) => (
                <tr key={i}>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{printData.customSite || (printData.clientName || 'SPEC').substring(0,4).toUpperCase()}</td>
                  <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.description}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.code || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.refCfao || '-'}</td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>{item.quantity}</td>
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

          {/* Footer Signatures */}
          <div style={{ marginTop: '20px', borderTop: '1pt solid #000', paddingTop: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                 <p style={{ fontWeight: 'bold', fontSize: '14px', margin: 0 }}>RECEPTION</p>
                 <p style={{ fontStyle: 'italic', fontSize: '12px', margin: 0 }}>Fait à {printData.customCity || 'Ouagadougou'} le {new Date(printData.customDate || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              {/* RECEPTIONNAIRE (LEFT) */}
              <div style={{ textAlign: 'center', width: '300px', padding: '15px', minHeight: '160px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '10px', fontSize: '13px' }}>LE RÉCEPTIONNAIRE</p>
                <p style={{ fontSize: '10px', color: '#666' }}>(Nom, Signature et Cachet)</p>
              </div>

              {/* EMETTEUR (RIGHT) */}
              <div style={{ textAlign: 'center', width: '300px', padding: '15px', minHeight: '160px', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '10px', fontSize: '13px' }}>L'ÉMETTEUR (NS AUTO)</p>
                
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {(selectedPartner?.bl_stamp_image || settings?.blStampImage) && <img src={selectedPartner?.bl_stamp_image || settings.blStampImage} alt="Cachet BL" style={{ maxHeight: '80px', objectFit: 'contain', opacity: 0.8 }} />}
                  {(selectedPartner?.bl_signature_image || settings?.blSignatureImage) && (
                    <img 
                      src={selectedPartner?.bl_signature_image || settings.blSignatureImage} 
                      alt="Signature BL" 
                      style={{ 
                        maxHeight: '60px', 
                        position: 'absolute',
                        bottom: '0',
                        right: '20px',
                        zIndex: 2 
                      }} 
                    />
                  )}
                </div>

                <div style={{ marginTop: '10px', zIndex: 1 }}>
                  <p style={{ fontWeight: 'bold', fontSize: '14px', margin: 0 }}>{printData.customSupervisorName || settings?.blSupervisorName || 'Huges Christian SOW'}</p>
                  <p style={{ fontSize: '11px', margin: 0 }}>{printData.customSupervisorTitle || settings?.blSupervisorTitle || 'Responsable Logistique Adjoint'}</p>
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
          
          <div style={{ padding: '0 80px', position: 'relative', zIndex: 2 }}>
            <p style={{ margin: '0', fontWeight: 'bold', fontSize: '11px' }}>
              {settings?.taxSystem || `${settings?.companyName} - RCCM ${settings?.rccm || 'BF BBD 2018 B 0372'} - IFU ${settings?.nif || '00102506 K'} - RNI - Direction des Moyennes Entreprises`}
            </p>
            <p style={{ margin: '2px 0' }}>{settings?.secondaryAddress || '01 BP 1245 Bobo Dioulasso 01 - Secteur 05 - Parcelle C - Lot 131ter - Tél.: +226 25 37 62 62'}</p>
            <p style={{ margin: '2px 0' }}>{settings?.footerMessage || `E-mail : ${settings?.email || 'commercial@nsautobf.com'} - Site web : ${settings?.website || 'www.nsauto.com'}`}</p>
            <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{settings?.bankInfo || 'IB bank 001193300101 / ECOBANK N°281753286301 - 74'}</p>
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
                  const p = partners.find(p => p.id === e.target.value);
                  setSelectedPartner(p);
                  localStorage.setItem('selectedPartnerId', p.id);
                }}
              >
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
      </div>

      {activeTab === 'dossiers' ? (
        <>
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
            <div className="stat-card" style={{ borderLeft: '5px solid var(--primary)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>💼 Achats en cours</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>
                {(orders.filter(o => o.status !== 'termine').reduce((sum, o) => sum + (o.contractAmount || 0), 0) * (1 + (settings?.tvaRate || 0) / 100)).toLocaleString()} 
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}> FCFA (TTC)</span>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '5px solid var(--success)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>💰 Achats Clôturés</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--success)' }}>
                {(orders.filter(o => o.status === 'termine').reduce((sum, o) => sum + (o.contractAmount || 0), 0) * (1 + (settings?.tvaRate || 0) / 100)).toLocaleString()} 
                <span style={{ fontSize: '0.9rem', opacity: 0.8 }}> FCFA (TTC)</span>
              </div>
            </div>
            <div className="stat-card" style={{ borderLeft: '5px solid var(--warning)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>⏳ En Demande</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--warning)' }}>{orders.filter(o => o.status === 'demande').length} <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>Dossiers</span></div>
            </div>
            <div className="stat-card" style={{ borderLeft: '5px solid var(--info)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>✅ Complétion</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0ea5e9' }}>{orders.length > 0 ? Math.round((orders.filter(o => o.status === 'termine').length / orders.length) * 100) : 0}%</div>
            </div>
          </div>

          <div className="content-card">
          <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}><Plus size={18} /> Nouveau Dossier</button>
              <button className="btn btn-secondary" onClick={exportOrdersToExcel} title="Exporter tous les dossiers affichés"><FileSpreadsheet size={18} /> Excel</button>
            </div>
            
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Réf. Dossier</th><th>Client</th><th>Statut</th><th>Montant Achat</th><th>Actions</th></tr></thead>
              <tbody>
                {orders.map(order => {
                  const isOldRequest = order.status === 'demande' && (new Date() - new Date(order.createdAt)) > (48 * 60 * 60 * 1000);
                  return (
                    <tr key={order.id} className={isOldRequest ? 'row-urgent' : ''}>
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          #{String(order.orderNumber).padStart(3, '0')}
                          {order.attachment && <Paperclip size={14} className="text-primary" title="Document joint" />}
                        </div>
                      </td>
                      <td>{order.clientName}</td>
                      <td>
                        <span className={`badge badge-${order.status === 'termine' ? 'success' : 'warning'} ${isOldRequest ? 'badge-urgent' : ''}`}>
                          {order.status} {isOldRequest && '⚠️'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                          {( (order.contractAmount || 0) * (1 + (settings?.tvaRate || 0) / 100) ).toLocaleString()} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>FCFA</span>
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
            <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><History size={20} color="var(--text-muted)" /> Historique des Documents Libres</h3>
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
                value={selectedCatalogClient}
                onChange={e => setSelectedCatalogClient(e.target.value)}
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
              <thead><tr><th>Code</th><th>Réf CFAO</th><th>Désignation</th><th>Mine</th><th>P.A Contrat</th><th>Actions</th></tr></thead>
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
                    <td style={{ fontWeight: 600 }}>{(item.purchasePrice || 0).toLocaleString()} FCFA</td>
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
              <div key={idx} className="content-card" style={{ padding: '1.5rem', borderLeft: `6px solid ${idx % 2 === 0 ? 'var(--primary)' : 'var(--success)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Dépenses {p.partnerName}</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-main)' }}>
                      {(p.totalAmount || 0).toLocaleString()} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>FCFA</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>{p.orderCount} dossiers enregistrés</div>
                  </div>
                  <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '12px' }}>
                    {idx % 2 === 0 ? <ShoppingCart size={24} color="var(--primary)" /> : <Package size={24} color="var(--success)" />}
                  </div>
                </div>
              </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
            {/* --- ÉVOLUTION MENSUELLE --- */}
            <div className="content-card" style={{ padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><Clock size={20} /> Évolution Mensuelle des Commandes (FCFA)</h3>
              <div style={{ width: '100%', height: '300px' }}>
                <ResponsiveContainer>
                  <AreaChart data={stats?.monthlyEvolution || []}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${(value/1000000).toFixed(1)}M`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} 
                      formatter={(val) => [`${val?.toLocaleString()} FCFA`, 'Total']}
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
                      {art.totalValue?.toLocaleString()} <span style={{ fontSize: '0.7rem' }}>FCFA</span>
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
                      formatter={(val) => [`${val.toLocaleString()} FCFA`, 'Volume']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* --- RÉCAPITULATIF DÉTAILLÉ (Ancien Rapports) --- */}
          <div className="content-card">
            <div className="section-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>Récapitulatif Détaillé des Articles</h3>
                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Liste des articles issus des dossiers clôturés.</p>
              </div>
              <button className="btn btn-secondary" onClick={exportReportToExcel}>
                <Download size={18} /> Exporter Excel
              </button>
            </div>
            <div className="table-wrapper">
              <table className="table-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-light)' }}>
                    <th>Date</th>
                    <th>Partenaire</th>
                    <th>Article / Référence</th>
                    <th style={{ textAlign: 'center' }}>Qté</th>
                    <th style={{ textAlign: 'right' }}>P.A (FCFA)</th>
                    <th style={{ textAlign: 'right' }}>Total (FCFA)</th>
                  </tr>
                </thead>
                <tbody>
                  {reportItems.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Aucun article trouvé.</td></tr>
                  ) : (
                    reportItems.map((item, idx) => (
                      <tr key={idx}>
                        <td>{new Date(item.orderDate).toLocaleDateString()}</td>
                        <td><span className="badge badge-info">{item.supplierName}</span></td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.description}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Réf: {item.code || '-'}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{item.purchasePrice?.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{(item.purchasePrice * item.quantity).toLocaleString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        )
      ) : null}

      {/* Modal Nouveau Dossier */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>{isEditing ? `Modifier Dossier #${String(selectedOrder?.orderNumber).padStart(3, '0')}` : 'Nouveau Dossier Achats Partenaires'}</h3>
              <button className="modal-close" onClick={() => { setIsModalOpen(false); setIsEditing(false); setSelectedOrder(null); setNewOrder({ clientId: '', supplierId: '', notes: '', items: [] }); }}>×</button>
            </div>
            <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '1.5rem' }}><label className="form-label">Client Final</label>
                  <select className="form-control" value={newOrder.clientId} onChange={e => setNewOrder({...newOrder, clientId: e.target.value})}>
                    <option value="">Choisir...</option>{clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>

              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Chercher dans le Catalogue CFAO</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-control" placeholder="Entrez une référence ou un nom..." value={itemSearch} onChange={e => handleItemSearch(e.target.value)} />
                  <button className="btn btn-secondary" onClick={() => addItemFromCatalog(null)}>Ajout Manuel</button>
                </div>
                {suggestions.length > 0 && (
                  <div className="search-suggestions">
                    {suggestions.map(a => (
                      <div key={a.id} className="suggestion-item" onClick={() => addItemFromCatalog(a)}>
                        <div style={{ fontWeight: 600 }}>{a.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Réf: {a.code} | Prix: {(a.purchasePrice || 0).toLocaleString()} FCFA</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="table-wrapper" style={{ marginTop: '1rem', maxHeight: '300px' }}>
                <table className="table-sm" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '100px' }}>Code</th>
                      <th style={{ width: '100px' }}>Réf. CFAO</th>
                      <th>Désignation</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Qté</th>
                      <th style={{ width: '110px' }}>P.A CFAO</th>
                      <th style={{ width: '90px', textAlign: 'right' }}>Total</th>
                      <th style={{ width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {newOrder.items.map((item, idx) => (
                       <tr key={idx}>
                        <td><input type="text" className="form-control" style={{ fontSize: '0.85rem' }} value={item.code} onChange={e => { const ni = [...newOrder.items]; ni[idx].code = e.target.value; setNewOrder({...newOrder, items: ni}); }} /></td>
                        <td><input type="text" className="form-control" style={{ fontSize: '0.85rem' }} value={item.refCfao} onChange={e => { const ni = [...newOrder.items]; ni[idx].refCfao = e.target.value; setNewOrder({...newOrder, items: ni}); }} /></td>
                        <td><input type="text" className="form-control" style={{ fontSize: '0.85rem' }} value={item.description} onChange={e => { const ni = [...newOrder.items]; ni[idx].description = e.target.value; setNewOrder({...newOrder, items: ni}); }} /></td>
                        <td><input type="number" className="form-control" style={{ textAlign: 'center', padding: '4px' }} value={item.quantity} onChange={e => { const ni = [...newOrder.items]; ni[idx].quantity = e.target.value; setNewOrder({...newOrder, items: ni}); }} /></td>
                        <td><input type="number" className="form-control" value={item.purchasePrice} onChange={e => { const ni = [...newOrder.items]; ni[idx].purchasePrice = e.target.value; setNewOrder({...newOrder, items: ni}); }} /></td>
                        <td style={{ fontWeight: 600, textAlign: 'right' }}>{(item.quantity * item.purchasePrice).toLocaleString()}</td>
                        <td><button className="btn btn-danger-outline btn-sm" onClick={() => { const ni = [...newOrder.items]; ni.splice(idx, 1); setNewOrder({...newOrder, items: ni}); }}><X size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label className="form-label">Notes / Justificatif</label>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <textarea className="form-control" rows="2" style={{ flex: 1 }} value={newOrder.notes} onChange={e => setNewOrder({ ...newOrder, notes: e.target.value })} placeholder="Observations ou détails particuliers..."></textarea>
                  <div style={{ minWidth: '150px' }}>
                    <label className="btn btn-secondary btn-sm" style={{ width: '100%', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
                      <Paperclip size={16} /> {newOrder.attachment ? 'Changer' : 'Joindre'}
                      <input type="file" style={{ display: 'none' }} onChange={handleFileChange} />
                    </label>
                    {newOrder.attachment && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--success)', marginTop: '4px', textAlign: 'center' }}>
                        ✓ Justificatif lié
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { setIsModalOpen(false); setIsEditing(false); setSelectedOrder(null); setNewOrder({ clientId: '', supplierId: '', notes: '', items: [] }); }}>Annuler</button>
              <button className="btn btn-primary" onClick={handleSubmitOrder} disabled={newOrder.items.length === 0}><Save size={18} /> {isEditing ? 'Enregistrer les modifications' : 'Créer le Dossier'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Voir Dossier */}
      {isViewModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h3>Détails Dossier #{String(selectedOrder.orderNumber).padStart(3, '0')}</h3>
              <button className="modal-close" onClick={() => setIsViewModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem', padding: '1.25rem', backgroundColor: 'var(--bg-light)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}><span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Client :</span> <strong style={{ color: 'var(--text-main)', marginLeft: '8px' }}>{selectedOrder.clientName}</strong></p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}><span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Statut Actuel :</span> <span className={`badge badge-${selectedOrder.status === 'termine' ? 'success' : 'warning'}`} style={{ marginLeft: '8px' }}>{selectedOrder.status}</span></p>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}><span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Date de Création :</span> <strong style={{ color: 'var(--text-main)', marginLeft: '8px' }}>{new Date(selectedOrder.createdAt).toLocaleDateString()}</strong></p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                <div>
                  <div className="table-wrapper">
                    <table className="table-sm">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Réf CFAO</th>
                          <th>Désignation</th>
                          <th style={{ textAlign: 'center' }}>Qté</th>
                          <th style={{ textAlign: 'right' }}>P.A CFAO</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items?.map((item, idx) => (
                           <tr key={idx}>
                            <td>{item.code || '-'}</td>
                            <td>{item.refCfao || '-'}</td>
                            <td>{item.description}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{(item.purchasePrice || 0).toLocaleString()} FCFA</td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{(item.quantity * item.purchasePrice).toLocaleString()} FCFA</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ background: 'linear-gradient(135deg, var(--primary), #4f46e5)', color: 'white', padding: '0.8rem 1.5rem', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 800, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}>
                      TOTAL ACHAT : {selectedOrder.contractAmount?.toLocaleString()} FCFA
                    </div>
                  </div>
                </div>

                <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '1.5rem' }}>
                  <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Clock size={18} /> Historique</h4>
                  <div className="timeline" style={{ position: 'relative' }}>
                    {selectedOrder.history?.map((h, i) => {
                      const prev = selectedOrder.history[i-1];
                      let durationStr = "";
                      if (prev) {
                        const diff = new Date(h.createdAt) - new Date(prev.createdAt);
                        const hours = Math.floor(diff / (1000 * 60 * 60));
                        const days = Math.floor(hours / 24);
                        durationStr = days > 0 ? `${days}j ${hours % 24}h` : `${hours}h ${Math.floor((diff / (1000 * 60)) % 60)}m`;
                      }

                      return (
                        <div key={h.id} style={{ position: 'relative', paddingLeft: '1.5rem', paddingBottom: '1.5rem' }}>
                          <div style={{ position: 'absolute', left: '-5px', top: '5px', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: h.newStatus === 'termine' ? 'var(--success)' : 'var(--primary)' }}></div>
                          {i < selectedOrder.history.length - 1 && <div style={{ position: 'absolute', left: '-1px', top: '15px', bottom: '0', width: '2px', backgroundColor: '#e2e8f0' }}></div>}
                          
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{h.newStatus.toUpperCase()}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {new Date(h.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          {h.userName && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>par {h.userName}</div>}
                          {durationStr && <div style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 600, marginTop: '2px' }}>⏱ {durationStr} d'attente</div>}
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
              <div className="form-group"><label className="form-label">Désignation Produit</label><input type="text" className="form-control" value={catalogItem.name || ''} onChange={e => setCatalogItem({...catalogItem, name: e.target.value})} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group"><label className="form-label">Code</label><input type="text" className="form-control" value={catalogItem.code || ''} onChange={e => setCatalogItem({...catalogItem, code: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Référence CFAO</label><input type="text" className="form-control" value={catalogItem.refCfao || ''} onChange={e => setCatalogItem({...catalogItem, refCfao: e.target.value})} /></div>
              </div>
              <div className="form-group">
                <label className="form-label">Mine (Site Client)</label>
                <select className="form-control" value={catalogItem.clientId || ''} onChange={e => setCatalogItem({...catalogItem, clientId: e.target.value})}>
                  <option value="">Toutes les Mines (Global)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
               <div className="form-group"><label className="form-label">P.A Contrat (FCFA)</label><input type="number" className="form-control" value={catalogItem.purchasePrice || 0} onChange={e => setCatalogItem({...catalogItem, purchasePrice: e.target.value})} /></div>
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

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Titre du Document</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={printData.blTitleOverride || ''} 
                  onChange={e => setPrintData({ ...printData, blTitleOverride: e.target.value })} 
                  style={{ fontWeight: 'bold', color: 'var(--primary)', padding: '6px 12px' }}
                />
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Référence / Objet</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={printData.requestRef || ''} 
                    onChange={e => setPrintData({ ...printData, requestRef: e.target.value })} 
                    style={{ fontWeight: '600', padding: '6px 12px' }}
                  />
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
              
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '20%' }}>Code</th>
                      <th style={{ width: '35%' }}>Désignation</th>
                      <th style={{ width: '25%' }}>Référence</th>
                      <th style={{ width: '15%' }}>Quantité</th>
                      <th style={{ width: '5%' }}></th>
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
                                const supplier = suppliers.find(s => String(s.id) === String(fullOrder.supplierId));
                                
                                setPrintData({
                                  ...fullOrder,
                                  items,
                                  orderNumber: bc.bc_number.split('-')[1],
                                  bcTitleOverride: bc.title,
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
              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Titre du Bon de Commande</label>
                <input 
                  type="text" 
                  className="form-control" 
                  value={printData.bcTitleOverride || ''} 
                  onChange={e => setPrintData({ ...printData, bcTitleOverride: e.target.value })} 
                  style={{ fontWeight: 'bold', color: 'var(--primary)', padding: '6px 12px' }}
                />
              </div>

              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.8rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Référence / Objet</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={printData.requestRef || ''} 
                    onChange={e => setPrintData({ ...printData, requestRef: e.target.value })} 
                    style={{ fontWeight: '600', padding: '6px 12px' }}
                  />
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

              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: '0.8rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Signataire (Nom)</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px' }} value={printData.customSupervisorName || ''} onChange={e => setPrintData({ ...printData, customSupervisorName: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>Titre</label>
                  <input type="text" className="form-control" style={{ padding: '6px 12px' }} value={printData.customSupervisorTitle || ''} onChange={e => setPrintData({ ...printData, customSupervisorTitle: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '4px', fontSize: '0.8rem' }}>TVA (%)</label>
                  <input type="number" className="form-control" style={{ padding: '6px 12px' }} value={printData.customTvaRate} onChange={e => setPrintData({ ...printData, customTvaRate: parseFloat(e.target.value) || 0 })} />
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
              <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Format requis : .xlsx ou .xls</p>
                <p>Colonnes reconnues :</p>
                <ul style={{ paddingLeft: '1.5rem', marginTop: '0.5rem' }}>
                  <li><strong>Désignation</strong> (Obligatoire)</li>
                  <li><strong>Code</strong></li>
                  <li><strong>Réf CFAO</strong></li>
                  <li><strong>Prix Achat Contrat</strong></li>
                  <li><strong>Mine</strong> (Nom exact du client)</li>
                </ul>
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
