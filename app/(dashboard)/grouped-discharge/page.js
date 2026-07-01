'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Truck, Search, Calendar, Eye, Trash2, Printer, 
  ChevronLeft, ChevronRight, X, Info, CheckCircle, Package, Plus, Ban, Edit
} from 'lucide-react';
import { storage } from '../../lib/storage';
import { useAuth } from '../../providers';
import { hasPermission } from '../../lib/auth';
import AlertModal from '../../components/AlertModal';



export default function GroupedDischargePage() {
  const { user } = useAuth();
  
  // Tabs: 'create' or 'history'
  const [activeTab, setActiveTab] = useState('create');
  
  // Data states
  const [clients, setClients] = useState([]);
  const [partners, setPartners] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Create tab states
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('all');
  const [previewDocNumber, setPreviewDocNumber] = useState('');
  const [editingDischargeId, setEditingDischargeId] = useState(null);
  
  // Catalog search states
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogSuggestions, setCatalogSuggestions] = useState([]);
  const [isSearchingCatalog, setIsSearchingCatalog] = useState(false);
  const searchTimeoutRef = useRef(null);
  const searchInputContainerRef = useRef(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Form preparation states (matching contract-gateway BL preparation)
  const [prepData, setPrepData] = useState({
    blTitleOverride: '',
    sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
    requestRef: '',
    customSenderDetails: '',
    customRecipientDetails: '',
    customDate: '',
    customCity: '',
    customSite: '',
    customSupervisorName: '',
    customSupervisorTitle: '',
    customDocNumber: '',
    printNotes: '',
    // Custom column labels
    blColNo: 'N°',
    blColSite: 'Site',
    blColDesc: 'Article',
    blColCode: 'Code',
    blColRef: 'Réf',
    blColQty: 'Quantité',
    // Hide column flags
    hideBlColNo: false,
    hideBlColSite: false,
    hideBlColDesc: false,
    hideBlColCode: false,
    hideBlColRef: false,
    hideBlColQty: false,
    items: []
  });
  
  // History tab states
  const [historyDischarges, setHistoryDischarges] = useState([]);
  const [historyClientId, setHistoryClientId] = useState('all');
  const [historyPartnerId, setHistoryPartnerId] = useState('all');
  const [historySearch, setHistorySearch] = useState('');
  
  // Printing states
  const [isPrinting, setIsPrinting] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [selectedPartner, setSelectedPartner] = useState(null);

  // Pagination for history
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Modals
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const [selectedDischarge, setSelectedDischarge] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  // Load initial lists
  useEffect(() => {
    loadClients();
    loadPartners();
    loadSettings();
    
    // Close suggestions dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (searchInputContainerRef.current && !searchInputContainerRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Prepopulate form when client or partner selection changes
  useEffect(() => {
    if (activeTab === 'create' && selectedClientId) {
      if (!editingDischargeId) {
        prepopulateForm();
      }
    } else {
      resetPrepForm();
    }
  }, [selectedClientId, selectedPartnerId, activeTab, settings, editingDischargeId]);

  // Load history when filters, search query or tab changes (debounced)
  useEffect(() => {
    if (activeTab === 'history') {
      const delayDebounceFn = setTimeout(() => {
        loadHistory();
      }, 300);
      return () => clearTimeout(delayDebounceFn);
    }
  }, [historyClientId, historyPartnerId, historySearch, activeTab]);

  const loadClients = async () => {
    try {
      const data = await storage.get('clients?storeId=all');
      setClients(data || []);
    } catch (err) {
      console.error("Error loading clients:", err);
    }
  };

  const loadPartners = async () => {
    try {
      const data = await storage.get('contract-partners');
      setPartners(data || []);
    } catch (err) {
      console.error("Error loading partners:", err);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data || null);
    } catch (err) {
      console.error("Error loading settings:", err);
    }
  };

  const resetPrepForm = () => {
    setEditingDischargeId(null);
    setPrepData({
      blTitleOverride: '',
      sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
      requestRef: '',
      customSenderDetails: '',
      customRecipientDetails: '',
      customDate: new Date().toISOString().split('T')[0],
      customCity: settings?.city || 'Ouagadougou',
      customSite: '',
      customSupervisorName: settings?.blSupervisorName || 'Huges Christian SOW',
      customSupervisorTitle: settings?.blSupervisorTitle || 'Responsable Logistique Adjoint',
      customDocNumber: '',
      printNotes: '',
      blColNo: 'N°',
      blColSite: 'Site',
      blColDesc: 'Article',
      blColCode: 'Code',
      blColRef: 'Réf',
      blColQty: 'Quantité',
      hideBlColNo: false,
      hideBlColSite: false,
      hideBlColDesc: false,
      hideBlColCode: false,
      hideBlColRef: false,
      hideBlColQty: false,
      items: []
    });
  };

  const prepopulateForm = async () => {
    if (selectedClientId === 'libre') {
      let docNum = '';
      try {
        const res = await fetch(`/api/sequence?type=BL&preview=true&_t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          docNum = data.documentNumber;
          setPreviewDocNumber(docNum);
        }
      } catch (err) {
        console.error("Error fetching sequence:", err);
      }

      const senderDetails = [
        settings?.companyName || 'NS AUTO SARL',
        settings?.address || 'Secteur 05, Parcelle C, Lot 1317 ter',
        settings?.rccm ? `RCCM : ${settings.rccm}` : 'RCCM : BF BBD 2018 B 0372',
        settings?.nif ? `IFU : ${settings.nif}` : 'IFU : 00102506 K',
        settings?.bp || 'BP 1245 Bobo-dioulasso',
        settings?.division || 'Division des Grandes Entreprises',
        settings?.taxSystem || 'Réel Normal d\'Imposition'
      ].filter(Boolean).join('\n');

      setPrepData(prev => ({
        ...prev,
        blTitleOverride: 'BORDEREAU DE LIVRAISON',
        sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
        requestRef: 'URGENT REQUEST',
        customSenderDetails: senderDetails,
        customRecipientDetails: '',
        customDate: new Date().toISOString().split('T')[0],
        customCity: settings?.city || 'Ouagadougou',
        customSite: 'GEN',
        customSupervisorName: settings?.blSupervisorName || 'Huges Christian SOW',
        customSupervisorTitle: settings?.blSupervisorTitle || 'Responsable Logistique Adjoint',
        customDocNumber: docNum,
        printNotes: '',
        items: []
      }));
      return;
    }

    const client = clients.find(c => String(c.id) === String(selectedClientId));
    const clientName = client ? client.name : '';
    
    let docNum = '';
    try {
      const res = await fetch(`/api/sequence?type=BL&preview=true&_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        docNum = data.documentNumber;
        setPreviewDocNumber(docNum);
      }
    } catch (err) {
      console.error("Error fetching sequence:", err);
    }
    
    const senderDetails = [
      settings?.companyName || 'NS AUTO SARL',
      settings?.address || 'Secteur 05, Parcelle C, Lot 1317 ter',
      settings?.rccm ? `RCCM : ${settings.rccm}` : 'RCCM : BF BBD 2018 B 0372',
      settings?.nif ? `IFU : ${settings.nif}` : 'IFU : 00102506 K',
      settings?.bp || 'BP 1245 Bobo-dioulasso',
      settings?.division || 'Division des Grandes Entreprises',
      settings?.taxSystem || 'Réel Normal d\'Imposition'
    ].filter(Boolean).join('\n');

    const recipientDetails = [
      client?.name,
      client?.address,
      client?.bp ? `BP : ${client.bp}` : null,
      client?.phone ? `Tél : ${client.phone}` : null,
      client?.rccm ? `RCCM : ${client.rccm}` : null,
      client?.nif ? `IFU : ${client.nif}` : null
    ].filter(Boolean).join('\n');

    const cleanClientName = clientName.replace(/\s+/g, '');
    const defaultSite = cleanClientName.substring(0, 4).toUpperCase();

    setPrepData(prev => ({
      ...prev,
      blTitleOverride: `BORDEREAU NSA-${clientName.toUpperCase()}`,
      sectionTitle: 'FOURNITURE DE PIECES DE RECHANGE',
      requestRef: `URGENT REQUEST ${clientName.toUpperCase()}`,
      customSenderDetails: senderDetails,
      customRecipientDetails: recipientDetails,
      customDate: new Date().toISOString().split('T')[0],
      customCity: settings?.city || 'Ouagadougou',
      customSite: defaultSite,
      customSupervisorName: settings?.blSupervisorName || 'Huges Christian SOW',
      customSupervisorTitle: settings?.blSupervisorTitle || 'Responsable Logistique Adjoint',
      customDocNumber: docNum,
      printNotes: '',
      items: [] // Starts empty, user adds items from catalog or manually
    }));
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const token = sessionStorage.getItem('token');
      let url = `/api/grouped-discharge?mode=history`;
      if (historyClientId !== 'all') url += `&clientId=${historyClientId}`;
      if (historyPartnerId !== 'all') url += `&partnerId=${historyPartnerId}`;
      if (historySearch.trim() !== '') url += `&search=${encodeURIComponent(historySearch.trim())}`;
      url += `&_t=${Date.now()}`;

      const res = await fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      if (!res.ok) throw new Error("Échec du chargement de l'historique");
      const data = await res.json();
      setHistoryDischarges(data || []);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Erreur', "Impossible de charger l'historique.");
    } finally {
      setLoadingHistory(false);
      setLoading(false);
    }
  };

  // Autocomplete catalog search
  const handleCatalogSearchChange = (e) => {
    const value = e.target.value;
    setCatalogSearch(value);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!value.trim()) {
      setCatalogSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearchingCatalog(true);
    setShowSuggestions(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const token = sessionStorage.getItem('token');
        let url = `/api/contract-catalog?search=${encodeURIComponent(value)}`;
        if (selectedClientId && selectedClientId !== 'libre') {
          url += `&clientId=${selectedClientId}`;
        }
        if (selectedPartnerId && selectedPartnerId !== 'all') {
          url += `&partnerId=${selectedPartnerId}`;
        }
        url += `&_t=${Date.now()}`;

        const res = await fetch(url, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (res.ok) {
          const suggestions = await res.json();
          setCatalogSuggestions(suggestions || []);
        }
      } catch (err) {
        console.error("Error searching catalog:", err);
      } finally {
        setIsSearchingCatalog(false);
      }
    }, 400);
  };

  // Add suggestion item to the list
  const handleSelectSuggestion = (suggestion) => {
    // Check if item already exists
    const cleanSugCode = (suggestion.code || '').replace(/-/g, '').toLowerCase();
    const cleanSugRef = (suggestion.refCfao || '').replace(/-/g, '').toLowerCase();

    const exists = prepData.items.some(it => {
      const cleanItCode = (it.code || '').replace(/-/g, '').toLowerCase();
      const cleanItRef = (it.refCfao || '').replace(/-/g, '').toLowerCase();
      
      const codeMatch = cleanItCode && cleanSugCode && cleanItCode === cleanSugCode;
      const refMatch = cleanItRef && cleanSugRef && cleanItRef === cleanSugRef;
      return codeMatch || refMatch;
    });

    if (exists) {
      showAlert('warning', 'Doublon', 'Cet article est déjà présent dans la liste.');
      setShowSuggestions(false);
      setCatalogSearch('');
      return;
    }

    const newItem = {
      id: `catalog-${suggestion.id || Date.now()}`,
      code: suggestion.code || '',
      description: suggestion.name || '',
      refCfao: suggestion.refCfao || '',
      quantity: ''
    };

    setPrepData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    setCatalogSearch('');
    setCatalogSuggestions([]);
    setShowSuggestions(false);
  };

  const showAlert = (type, title, message) => {
    setAlertModal({ open: true, type, title, message, onConfirm: null });
  };

  const showConfirm = (title, message, onConfirm) => {
    setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });
  };

  const closeAlert = () => {
    setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  };

  // Save & Print Standalone BL / BEG
  const handleSaveAndPrint = async () => {
    if (prepData.items.length === 0) {
      showAlert('warning', 'Aucun article', 'Veuillez ajouter au moins un article à la liste.');
      return;
    }

    const hasInvalidQty = prepData.items.some(it => !it.quantity || (parseInt(it.quantity) || 0) <= 0);
    if (hasInvalidQty) {
      showAlert('warning', 'Quantité requise', 'Veuillez saisir une quantité supérieure à 0 pour tous les articles de la liste.');
      return;
    }

    const deliveryItems = prepData.items.filter(it => (parseInt(it.quantity) || 0) > 0);

    const client = clients.find(c => String(c.id) === String(selectedClientId));
    let clientName = client ? client.name : 'Client';
    if (selectedClientId === 'libre') {
      const firstLine = prepData.customRecipientDetails?.trim().split('\n')[0];
      clientName = firstLine || 'BL Libre - Autre entreprise';
    }
    
    const partner = partners.find(p => p.id === selectedPartnerId);
    const partnerName = partner ? partner.name : null;

    showConfirm(
      "Confirmer l'enregistrement",
      "Confirmez-vous avoir bien saisi toutes les informations avant d'enregistrer et d'imprimer ce Bon de Livraison ?",
      async () => {
        closeAlert();
        setLoading(true);
        try {
          const token = sessionStorage.getItem('token');
          
          let finalDocNumber = prepData.customDocNumber;
          if (!finalDocNumber || finalDocNumber === previewDocNumber) {
            const seqRes = await fetch(`/api/sequence?type=BL&_t=${Date.now()}`);
            if (seqRes.ok) {
              const seqData = await seqRes.json();
              finalDocNumber = seqData.documentNumber;
            }
          }

          const metadataItem = {
            isMetadata: true,
            customCity: prepData.customCity,
            customDate: prepData.customDate,
            customSupervisorName: prepData.customSupervisorName,
            customSupervisorTitle: prepData.customSupervisorTitle,
            customSenderDetails: prepData.customSenderDetails,
            customRecipientDetails: prepData.customRecipientDetails,
            customSite: prepData.customSite,
            requestRef: prepData.requestRef,
            blTitleOverride: prepData.blTitleOverride,
            sectionTitle: prepData.sectionTitle,
            printNotes: prepData.printNotes,
            blColNo: prepData.blColNo,
            blColSite: prepData.blColSite,
            blColDesc: prepData.blColDesc,
            blColCode: prepData.blColCode,
            blColRef: prepData.blColRef,
            blColQty: prepData.blColQty,
            hideBlColNo: prepData.hideBlColNo,
            hideBlColSite: prepData.hideBlColSite,
            hideBlColDesc: prepData.hideBlColDesc,
            hideBlColCode: prepData.hideBlColCode,
            hideBlColRef: prepData.hideBlColRef,
            hideBlColQty: prepData.hideBlColQty
          };
          const itemsToSend = [...deliveryItems, metadataItem];

          const isUpdate = !!editingDischargeId;
          const res = await fetch('/api/grouped-discharge', {
            method: isUpdate ? 'PUT' : 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : ''
            },
            body: JSON.stringify({
              id: editingDischargeId,
              action: isUpdate ? 'update' : undefined,
              clientId: selectedClientId,
              clientName,
              partnerId: selectedPartnerId === 'all' ? null : selectedPartnerId,
              partnerName,
              items: itemsToSend,
              notes: prepData.printNotes,
              customSenderDetails: prepData.customSenderDetails,
              customRecipientDetails: prepData.customRecipientDetails,
              customDate: prepData.customDate,
              customCity: prepData.customCity,
              customSite: prepData.customSite,
              customSupervisorName: prepData.customSupervisorName,
              customSupervisorTitle: prepData.customSupervisorTitle,
              customDocNumber: finalDocNumber,
              sectionTitle: prepData.sectionTitle,
              blColNo: prepData.blColNo,
              blColSite: prepData.blColSite,
              blColDesc: prepData.blColDesc,
              blColCode: prepData.blColCode,
              blColRef: prepData.blColRef,
              blColQty: prepData.blColQty,
              hideBlColNo: prepData.hideBlColNo,
              hideBlColSite: prepData.hideBlColSite,
              hideBlColDesc: prepData.hideBlColDesc,
              hideBlColCode: prepData.hideBlColCode,
              hideBlColRef: prepData.hideBlColRef,
              hideBlColQty: prepData.hideBlColQty
            })
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Une erreur est survenue.");
          }

          const result = await res.json();
          showAlert('success', 'Succès', `Le bordereau ${result.dischargeNumber} a été enregistré.`);
          
          // Setup printing state
          const pt = partners.find(p => p.id === selectedPartnerId);
          setSelectedPartner(pt || null);
          setPrintData({
            dischargeNumber: result.dischargeNumber,
            clientName,
            client,
            items: deliveryItems,
            notes: prepData.printNotes,
            created_at: prepData.customDate || new Date(),
            ...prepData,
            customDocNumber: finalDocNumber
          });

          setSelectedClientId('');
          resetPrepForm();
          
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
          }, 800);

        } catch (err) {
          console.error(err);
          showAlert('error', 'Erreur de génération', err.message);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Reprint from history
  const handlePrintDischarge = (discharge) => {
    const pt = partners.find(p => p.id === discharge.partner_id);
    const client = clients.find(c => c.id === discharge.client_id);
    setSelectedPartner(pt || null);

    const metadata = discharge.items?.find(it => it.isMetadata) || {};
    const deliveryItems = discharge.items?.filter(it => !it.isMetadata) || [];

    setPrintData({
      dischargeNumber: discharge.discharge_number,
      clientName: discharge.client_name,
      client,
      items: deliveryItems,
      notes: discharge.notes,
      created_at: discharge.created_at,
      
      // Load custom print headers/details from metadata
      blTitleOverride: metadata.blTitleOverride || `BORDEREAU NSA-${discharge.client_name?.toUpperCase()}`,
      sectionTitle: metadata.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE',
      requestRef: metadata.requestRef || '',
      customSenderDetails: metadata.customSenderDetails || '',
      customRecipientDetails: metadata.customRecipientDetails || '',
      customCity: metadata.customCity || 'Ouagadougou',
      customSite: metadata.customSite || '',
      customSupervisorName: metadata.customSupervisorName || '',
      customSupervisorTitle: metadata.customSupervisorTitle || '',
      
      blColNo: metadata.blColNo || 'N°',
      blColSite: metadata.blColSite || 'Site',
      blColDesc: metadata.blColDesc || 'Article',
      blColCode: metadata.blColCode || 'Code',
      blColRef: metadata.blColRef || 'Réf',
      blColQty: metadata.blColQty || 'Quantité',
      
      hideBlColNo: metadata.hideBlColNo || false,
      hideBlColSite: metadata.hideBlColSite || false,
      hideBlColDesc: metadata.hideBlColDesc || false,
      hideBlColCode: metadata.hideBlColCode || false,
      hideBlColRef: metadata.hideBlColRef || false,
      hideBlColQty: metadata.hideBlColQty || false
    });
    setIsPrinting(true);
    const originalTitle = document.title;
    if (discharge.discharge_number) {
      document.title = discharge.discharge_number;
    }
    setTimeout(() => {
      window.print();
      document.title = originalTitle;
      setIsPrinting(false);
      setPrintData(null);
    }, 800);
  };

  // Cancel Grouped Discharge (updates status to 'annule')
  const handleCancelDischarge = (discharge) => {
    if (user?.role === 'gestionnaire2' || user?.role === 'gestionnaire 2') {
      showAlert('error', 'Action interdite', "Votre rôle ne vous permet pas d'annuler un Bon de Livraison.");
      return;
    }
    showConfirm(
      "Annuler le bordereau ?",
      `Êtes-vous sûr de vouloir annuler le bordereau ${discharge.discharge_number} ?`,
      async () => {
        closeAlert();
        setLoading(true);
        try {
          const token = sessionStorage.getItem('token');
          const res = await fetch(`/api/grouped-discharge?id=${discharge.id}&action=cancel`, {
            method: 'PUT',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Une erreur est survenue.");
          }
          showAlert('success', 'Annulation réussie', "Le bordereau a été annulé.");
          loadHistory();
        } catch (err) {
          console.error(err);
          showAlert('error', 'Erreur', err.message);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // Delete/Cancel Grouped Discharge (simply deletes the document record)
  const handleDeleteDischarge = (discharge) => {
    if (user?.role === 'gestionnaire2' || user?.role === 'gestionnaire 2') {
      showAlert('error', 'Action interdite', "Votre rôle ne vous permet pas de supprimer un Bon de Livraison.");
      return;
    }
    showConfirm(
      "Supprimer le bordereau ?",
      `Êtes-vous sûr de vouloir supprimer définitivement le bordereau ${discharge.discharge_number} de l'historique ?`,
      async () => {
        closeAlert();
        setLoading(true);
        try {
          const token = sessionStorage.getItem('token');
          const res = await fetch(`/api/grouped-discharge?id=${discharge.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': token ? `Bearer ${token}` : '' }
          });
          if (!res.ok) {
            const errData = await res.json();
            throw new Error(errData.error || "Une erreur est survenue.");
          }
          showAlert('success', 'Suppression réussie', "Le bordereau a été supprimé.");
          loadHistory();
        } catch (err) {
          console.error(err);
          showAlert('error', 'Erreur', err.message);
        } finally {
          setLoading(false);
        }
      }
    );
  };

  // View details modal
  const handleViewDischarge = (discharge) => {
    setSelectedDischarge(discharge);
    setIsViewModalOpen(true);
  };

  const handleEditDischarge = (discharge) => {
    setEditingDischargeId(discharge.id);
    setSelectedClientId(discharge.client_id || 'libre');
    setSelectedPartnerId(discharge.partner_id || 'all');
    
    const metadata = discharge.items?.find(it => it.isMetadata) || {};
    const deliveryItems = (discharge.items?.filter(it => !it.isMetadata) || []).map((it, idx) => ({
      ...it,
      id: it.id || `edit-item-${Date.now()}-${idx}`
    }));

    setPrepData({
      blTitleOverride: metadata.blTitleOverride || '',
      sectionTitle: metadata.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE',
      requestRef: metadata.requestRef || '',
      customSenderDetails: metadata.customSenderDetails || '',
      customRecipientDetails: metadata.customRecipientDetails || '',
      customDate: metadata.customDate || new Date(discharge.created_at).toISOString().split('T')[0],
      customCity: metadata.customCity || settings?.city || 'Ouagadougou',
      customSite: metadata.customSite || '',
      customSupervisorName: metadata.customSupervisorName || settings?.blSupervisorName || '',
      customSupervisorTitle: metadata.customSupervisorTitle || settings?.blSupervisorTitle || '',
      customDocNumber: discharge.discharge_number || '',
      printNotes: metadata.printNotes || discharge.notes || '',
      blColNo: metadata.blColNo || 'N°',
      blColSite: metadata.blColSite || 'Site',
      blColDesc: metadata.blColDesc || 'Article',
      blColCode: metadata.blColCode || 'Code',
      blColRef: metadata.blColRef || 'Réf',
      blColQty: metadata.blColQty || 'Quantité',
      hideBlColNo: metadata.hideBlColNo || false,
      hideBlColSite: metadata.hideBlColSite || false,
      hideBlColDesc: metadata.hideBlColDesc || false,
      hideBlColCode: metadata.hideBlColCode || false,
      hideBlColRef: metadata.hideBlColRef || false,
      hideBlColQty: metadata.hideBlColQty || false,
      items: deliveryItems
    });
    
    setActiveTab('create');
  };

  // Add a completely free text item row
  const handleAddFreeItem = () => {
    const newItem = {
      id: `free-${Date.now()}`,
      code: '',
      refCfao: '',
      description: '',
      quantity: ''
    };
    setPrepData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  // Remove item from prep list
  const handleRemoveItem = (index) => {
    const newItems = prepData.items.filter((_, idx) => idx !== index);
    setPrepData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  // Edit item fields in prep list
  const handleItemChange = (index, field, value) => {
    const newItems = [...prepData.items];
    newItems[index] = {
      ...newItems[index],
      [field]: value
    };
    setPrepData(prev => ({
      ...prev,
      items: newItems
    }));
  };

  // Pagination helpers
  const totalPages = Math.ceil(historyDischarges.length / itemsPerPage) || 1;
  const paginatedDischarges = historyDischarges.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Print view override render
  if (isPrinting && printData) {
    const printBorder = '1.5pt solid #000 !important';
    const cellStyle = { border: printBorder, padding: '3.5px 6px', fontSize: '9px', verticalAlign: 'middle', boxSizing: 'border-box', color: '#000' };
    const tableHeaderStyle = { ...cellStyle, backgroundColor: '#d1d5db', fontWeight: 'bold', textAlign: 'center', fontSize: '9px', WebkitPrintColorAdjust: 'exact' };

    const showNo = printData.hideBlColNo !== true;
    const showSite = printData.hideBlColSite !== true;
    const showDesc = printData.hideBlColDesc !== true;
    const showCode = printData.hideBlColCode !== true;
    const showRef = printData.hideBlColRef !== true;
    const showQty = printData.hideBlColQty !== true;

    const numDesignationCols = [showCode, showSite, showDesc, showRef].filter(Boolean).length;
    const remainingCols = numDesignationCols + (showQty ? 1 : 0);

    return (
      <div className="receipt-print-only" style={{
        display: 'block', backgroundColor: 'white', width: '21cm', minHeight: '29.7cm', padding: '0', position: 'relative', fontFamily: '"Times New Roman", Times, serif', margin: '0 auto'
      }}>
        <style dangerouslySetInnerHTML={{
          __html: `
          @page { size: A4 portrait; margin: 0 !important; }
          @media print {
            body { margin: 0 !important; padding: 0 !important; }
            .receipt-print-only { width: 100% !important; min-height: 100% !important; padding: 0 !important; margin: 0 auto !important; position: relative !important; top: 0 !important; left: 0 !important; right: 0 !important; }
            .receipt-print-only table { border-collapse: collapse !important; width: 100% !important; }
            .receipt-print-only th, .receipt-print-only td { border: 1.5pt solid black !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .receipt-print-only td.master-td { border: none !important; padding: 0 !important; }
            .gray-bg { background-color: #d1d5db !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .red-footer { 
              position: fixed !important; bottom: 0 !important; left: 0 !important; right: 0 !important; width: 100% !important; 
              background-color: #b91c1c !important; color: white !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
              z-index: 999 !important;
            }
          }
          .gray-bg { background-color: #d1d5db !important; }
        `}} />

          <table style={{ width: '100%', border: 'none', borderCollapse: 'collapse' }}>
            <tfoot style={{ display: 'table-footer-group' }}>
              <tr><td className="master-td" style={{ border: 'none', height: '110px', padding: '0' }}></td></tr>
            </tfoot>
            <tbody style={{ display: 'table-row-group' }}>
              <tr>
                <td className="master-td" style={{ border: 'none', padding: '0' }}>
                  <div style={{ padding: '0px 40px 20px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '32px' }}>
            {(selectedPartner?.logo || settings?.logo) && (
              <img
                src={selectedPartner?.logo || settings?.logo}
                alt="Logo"
                style={{ maxHeight: '120px', marginRight: '2px', position: 'relative', top: '34px' }}
              />
            )}
            <div style={{ flex: 1, height: '2.5pt', backgroundColor: '#b91c1c', marginBottom: '13px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
          </div>

          <div style={{
            border: '1.5pt solid #000', padding: '10px', textAlign: 'center', marginBottom: '40px',
            backgroundColor: '#d1d5db',
            WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact'
          }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              <span style={{ textDecoration: 'underline' }}>{printData.blTitleOverride || 'BORDEREAU DE LIVRAISON'} :</span> &nbsp;&nbsp;
              {printData.dischargeNumber}
            </h2>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px' }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '6px', border: printBorder }}>
                  <div style={{ fontSize: '11px', whiteSpace: 'pre-wrap', lineHeight: '1.3', fontWeight: 'bold' }}>
                    {printData.customSenderDetails || (
                      <>
                        <p style={{ margin: '0 0 6px 0', fontSize: '11px' }}><strong>{settings?.companyName || 'NS AUTO'}</strong></p>
                        <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>{settings?.address || 'Bobo Dioulasso, Burkina Faso'}</p>
                        <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>RCCM : {settings?.rccm || 'BF BBD 2018 B 0372'}</p>
                        <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>IFU : {settings?.nif || '00102506 K'}</p>
                      </>
                    )}
                  </div>
                </td>
                <td style={{ width: '50%', verticalAlign: 'top', padding: '6px', border: printBorder }}>
                  <div style={{ fontSize: '11px', lineHeight: '1.3', fontWeight: 'bold' }}>
                    {printData.customRecipientDetails ? (
                      printData.customRecipientDetails.split('\n').map((line, idx) => (
                        <p key={idx} style={{ margin: idx === 0 ? '0 0 6px 0' : '0 0 2px 0' }}>{line}</p>
                      ))
                    ) : (
                      <>
                        <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '6px' }}>{printData.clientName}</div>
                        {printData.client?.address && <p style={{ margin: '0 0 2px 0', fontSize: '11px' }}>{printData.client.address}</p>}
                      </>
                    )}
                  </div>
                </td>
              </tr>
              {printData.requestRef && (
                <tr>
                  <td colSpan="2" style={{ textAlign: 'center', backgroundColor: '#e5e7eb', padding: '6px', fontWeight: 'bold', fontSize: '10px', border: printBorder, whiteSpace: 'pre-wrap' }}>
                    {printData.requestRef}
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Render Table with Dynamic custom columns */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {showNo && <th className="gray-bg" rowSpan="3" style={{ ...tableHeaderStyle, width: '30px' }}>{printData.blColNo || 'N°'}</th>}
                {numDesignationCols > 0 && (
                  <th className="gray-bg" colSpan={numDesignationCols} style={{ ...tableHeaderStyle, fontSize: '9px', letterSpacing: '1px', padding: '4px' }}>DESIGNATION</th>
                )}
                {showQty && <th className="gray-bg" style={{ ...tableHeaderStyle, width: '70px' }}>{printData.blColQty || 'Quantité'}</th>}
              </tr>
              <tr>
                {numDesignationCols > 0 && (
                  <th colSpan={numDesignationCols} style={{ ...cellStyle, textAlign: 'left', fontWeight: 'bold', fontSize: '9px', paddingLeft: '8px', backgroundColor: '#fff' }}>
                    {printData.sectionTitle || 'FOURNITURE DE PIECES DE RECHANGE'}
                  </th>
                )}
                {showQty && <th style={{ ...cellStyle, width: '70px', backgroundColor: '#fff' }}></th>}
              </tr>
              <tr>
                {showCode && (
                  <th className="gray-bg" style={{ ...tableHeaderStyle, width: '80px', verticalAlign: 'top', padding: '3px 4px' }}>
                    <div style={{ textDecoration: 'underline' }}>{printData.blColCode || 'Code'}</div>
                    <div style={{ fontWeight: 'normal', fontSize: '8px', marginTop: '1px' }}>{printData.customSite}</div>
                  </th>
                )}
                {showSite && <th className="gray-bg" style={{ ...tableHeaderStyle, width: '60px', textDecoration: 'underline' }}>{printData.blColSite || 'Site'}</th>}
                {showDesc && <th className="gray-bg" style={{ ...tableHeaderStyle, textAlign: 'left', textDecoration: 'underline' }}>{printData.blColDesc || 'Article'}</th>}
                {showRef && <th className="gray-bg" style={{ ...tableHeaderStyle, width: '90px', textDecoration: 'underline' }}>{printData.blColRef || 'Réf'}</th>}
                {showQty && <th className="gray-bg" style={{ ...tableHeaderStyle, width: '70px' }}></th>}
              </tr>
            </thead>
            <tbody>
              {printData.items.map((item, i) => (
                <tr key={i}>
                  {showNo && <td className="gray-bg" style={{ ...cellStyle, textAlign: 'center' }}>{i + 1}</td>}
                  {showCode && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.code || 'N/A'}</td>}
                  {showSite && <td style={{ ...cellStyle, textAlign: 'center' }}>{printData.customSite || 'NSA'}</td>}
                  {showDesc && <td style={{ ...cellStyle, fontWeight: 'bold' }}>{item.description}</td>}
                  {showRef && <td style={{ ...cellStyle, textAlign: 'center' }}>{item.refCfao || '-'}</td>}
                  {showQty && <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>}
                </tr>
              ))}
              <tr>
                {showNo && <td className="gray-bg" style={{ ...cellStyle }}></td>}
                {remainingCols > 0 && (
                  <td colSpan={remainingCols} style={{ ...cellStyle, fontSize: '9px', padding: '4px 8px', verticalAlign: 'top', backgroundColor: '#fff' }}>
                    <div style={{ fontWeight: 'bold' }}>Délais de livraison</div>
                    <div style={{ fontWeight: 'bold' }}>sur site :</div>
                  </td>
                )}
              </tr>
              <tr>
                {showNo && <td className="gray-bg" style={{ ...cellStyle }}></td>}
                {remainingCols > 0 && (
                  <td className="gray-bg" colSpan={remainingCols} style={{ ...cellStyle, padding: '8px' }}></td>
                )}
              </tr>
            </tbody>
          </table>

          {printData.notes && (
            <div style={{ marginTop: '15px', padding: '8px', border: '1pt solid #000', borderRadius: '2px' }}>
              <p style={{ margin: 0, fontSize: '10px', fontWeight: 'bold', textDecoration: 'underline', marginBottom: '2px' }}>INSTRUCTIONS / NOTES DE LIVRAISON :</p>
              <p style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>{printData.notes}</p>
            </div>
          )}

          <div style={{ marginTop: '35px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ width: '300px', padding: '5px', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
                <p style={{ fontWeight: 'bold', fontSize: '12px', margin: 0, textDecoration: 'underline' }}>RECEPTION WAREHOUSE</p>
              </div>

              <div style={{ textAlign: 'center', width: '300px', padding: '5px', minHeight: '90px', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <p style={{ fontStyle: 'italic', fontSize: '10px', margin: 0, marginBottom: '5px' }}>Fait à {printData.customCity || 'Ouagadougou'} le {new Date(printData.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', width: '100%', minHeight: '50px', margin: '5px 0' }}>
                  {(selectedPartner?.bl_stamp_image || settings?.blStampImage) && <img src={selectedPartner?.bl_stamp_image || settings.blStampImage} alt="Cachet" style={{ maxHeight: '70px', objectFit: 'contain', opacity: 0.8 }} />}
                  {(selectedPartner?.bl_signature_image || settings?.blSignatureImage) && (
                    <img
                      src={selectedPartner?.bl_signature_image || settings.blSignatureImage}
                      alt="Signature"
                      style={{ maxHeight: '50px', position: 'absolute', bottom: '0', right: '20px', zIndex: 2 }}
                    />
                  )}
                </div>
                <div style={{ zIndex: 1 }}>
                  <p style={{ fontWeight: 'bold', fontSize: '11px', margin: 0, textTransform: 'uppercase' }}>{printData.customSupervisorName || settings?.blSupervisorName || 'Huges Christian SOW'}</p>
                  <p style={{ fontSize: '9px', margin: 0, textTransform: 'uppercase' }}>{printData.customSupervisorTitle || settings?.blSupervisorTitle || 'Responsable Logistique Adjoint'}</p>
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
          height: '95px', backgroundColor: '#b91c1c', color: '#fff', fontSize: '9px', textAlign: 'center', lineHeight: '1.4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', bottom: '0', left: '0', right: '0',
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', borderTop: '2px solid #000'
        }}>
          <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '70px', backgroundColor: '#000', clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)' }}></div>
          <div style={{ padding: '0 20px', width: '100%', position: 'relative', zIndex: 2 }}>
            <p style={{ margin: '0', fontWeight: 'bold', fontSize: '9px' }}>
              {settings?.footerLine1 || `${settings?.companyName || 'NS AUTO'} - RCCM ${settings?.rccm || 'BF BBD 2018 B 0372'} - IFU ${settings?.nif || '00102506 K'} - RNI - Direction des Moyennes Entreprises (Hauts Bassins)`}
            </p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>{settings?.footerLine2 || '01 BP 1245 bobo Dioulasso 01 - Secteur 05 - Parcelle C - Lot 131 ter - Tél : +226 25 37 62 62'}</p>
            <p style={{ margin: '1px 0', fontSize: '9px' }}>E-mail : {settings?.email || 'commercial@nsautobf.com'} - Site web : {settings?.website || 'www.nsautobf.com'}</p>
            <p style={{ margin: '1px 0', fontWeight: 'bold', fontSize: '9px' }}>{settings?.footerLine4 || 'IB bank 001193300101 / ECOBANK No 281753286301 - 74'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page" style={{ padding: '1.5rem', minHeight: '100vh', position: 'relative' }}>
      
      {/* Styles Premium Glassmorphism & Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --glass-bg: rgba(255, 255, 255, 0.75);
          --glass-border: rgba(226, 232, 240, 0.8);
          --shadow-premium: 0 10px 30px -10px rgba(0, 0, 0, 0.05);
        }
        
        [data-theme='dark'] {
          --glass-bg: rgba(30, 41, 59, 0.6);
          --glass-border: rgba(51, 65, 85, 0.8);
          --shadow-premium: 0 10px 30px -10px rgba(0, 0, 0, 0.3);
        }

        .header-title-section {
          margin-bottom: 2rem;
          animation: slideDown 0.5s ease-out;
        }

        .tab-button {
          padding: 0.75rem 1.5rem;
          border-radius: 12px;
          font-weight: 600;
          transition: all 0.3s ease;
          border: 1px solid transparent;
          cursor: pointer;
        }

        .tab-button.active {
          background: linear-gradient(135deg, #b91c1c, #991b1b);
          color: white;
          box-shadow: 0 4px 15px rgba(185, 28, 28, 0.2);
        }

        .tab-button:not(.active) {
          background: var(--glass-bg);
          border-color: var(--glass-border);
          color: var(--text-color);
        }

        .tab-button:not(.active):hover {
          background: var(--border-color);
        }

        .premium-card {
          background: var(--glass-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: var(--shadow-premium);
          margin-bottom: 1.5rem;
          animation: fadeIn 0.5s ease-out;
        }

        .form-select-premium {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 1px solid var(--glass-border);
          background: var(--card-bg);
          color: var(--text-color);
          font-weight: 500;
          outline: none;
          transition: border-color 0.2s;
        }

        .form-select-premium:focus {
          border-color: #b91c1c;
        }

        .suggestions-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: var(--card-bg);
          border: 1px solid var(--glass-border);
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
          z-index: 100;
          max-height: 250px;
          overflow-y: auto;
        }

        .suggestion-item {
          padding: 0.75rem 1rem;
          cursor: pointer;
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          gap: 2px;
          transition: background 0.2s;
        }

        .suggestion-item:hover {
          background: rgba(185, 28, 28, 0.05);
        }

        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />

      {/* Header */}
      <div className="header-title-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: '800', fontSize: '2rem', margin: 0 }}>
            <Truck size={36} className="text-danger" style={{ color: '#b91c1c' }} />
            Décharge Groupée (BL Libre)
          </h1>
          <p className="text-muted" style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
            Sélectionner directement une mine et ajouter des articles de catalogue pour préparer un bon de livraison libre.
          </p>
        </div>
        
        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            className={`tab-button ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => setActiveTab('create')}
          >
            Préparer Décharge / BL
          </button>
          <button 
            className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            Historique des BL
          </button>
        </div>
      </div>

      {/* CREATE TAB */}
      {activeTab === 'create' && (
        <div>
          
          {/* Main selection mine */}
          <div className="premium-card" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', padding: '1rem' }}>
            <div className="form-group" style={{ flex: 2, minWidth: '250px', margin: 0 }}>
              <select 
                className="form-select-premium"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">Sélectionner une mine (Client)...</option>
                <option value="libre" style={{ fontWeight: 'bold', color: '#b91c1c' }}>[ BL Libre - Autre entreprise ]</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>{client.name} {client.clientCode ? `(${client.clientCode})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: '200px', margin: 0 }}>
              <select 
                className="form-select-premium"
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                disabled={!selectedClientId}
              >
                <option value="all">Tous les partenaires</option>
                {partners.map(partner => (
                  <option key={partner.id} value={partner.id}>{partner.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedClientId ? (
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
              <Info size={44} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
              <p style={{ fontWeight: '500' }}>Veuillez sélectionner une mine ci-dessus pour commencer la préparation du Bon de Livraison.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Preparation Form Fields (matching contract-gateway BL Preparation) */}
              <div className="premium-card">
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', color: '#b91c1c' }}>
                  Préparation du Bon de Livraison (BL)
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Titre du Document (Haut)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={prepData.blTitleOverride}
                      onChange={e => setPrepData({ ...prepData, blTitleOverride: e.target.value })}
                      style={{ fontWeight: 'bold', padding: '8px 12px' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Titre de Section (Dans le tableau)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={prepData.sectionTitle}
                      onChange={e => setPrepData({ ...prepData, sectionTitle: e.target.value })}
                      style={{ fontWeight: 'bold', padding: '8px 12px' }}
                      placeholder="Ex: FOURNITURE DE PIECES DE RECHANGE"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Référence / Objet (Zone Libre)</label>
                  <textarea
                    className="form-control"
                    rows="2"
                    value={prepData.requestRef}
                    onChange={e => setPrepData({ ...prepData, requestRef: e.target.value })}
                    style={{ fontWeight: '600', padding: '8px 12px', resize: 'vertical' }}
                  ></textarea>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Détails de l'Expéditeur (Bloc de gauche)</label>
                    <textarea
                      className="form-control"
                      rows="5"
                      value={prepData.customSenderDetails}
                      onChange={e => setPrepData({ ...prepData, customSenderDetails: e.target.value })}
                      style={{ padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical' }}
                    ></textarea>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Détails du Destinataire (Bloc de droite)</label>
                    <textarea
                      className="form-control"
                      rows="5"
                      value={prepData.customRecipientDetails}
                      onChange={e => setPrepData({ ...prepData, customRecipientDetails: e.target.value })}
                      style={{ padding: '8px 12px', fontSize: '0.85rem', resize: 'vertical' }}
                      placeholder="Nom, Adresse, RCCM, NIF..."
                    ></textarea>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Date</label>
                    <input 
                      type="date" 
                      className="form-control" 
                      value={prepData.customDate} 
                      onChange={e => setPrepData({ ...prepData, customDate: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Lieu (Ville)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={prepData.customCity} 
                      onChange={e => setPrepData({ ...prepData, customCity: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Code Site</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={prepData.customSite} 
                      onChange={e => setPrepData({ ...prepData, customSite: e.target.value.toUpperCase() })} 
                      placeholder="Ex: HOUN" 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Signataire (Nom)</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={prepData.customSupervisorName} 
                      onChange={e => setPrepData({ ...prepData, customSupervisorName: e.target.value })} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Titre du Signataire</label>
                    <input 
                      type="text" 
                      className="form-control" 
                      value={prepData.customSupervisorTitle} 
                      onChange={e => setPrepData({ ...prepData, customSupervisorTitle: e.target.value })} 
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Numéro de Document (Manuel - Optionnel)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={prepData.customDocNumber}
                      onChange={e => setPrepData({ ...prepData, customDocNumber: e.target.value })}
                      placeholder="Laisser vide pour une génération automatique (BEG-...)"
                      style={{ fontWeight: 'bold' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: '600', marginBottom: '4px' }}>Instructions logistiques ou de livraison</label>
                    <input
                      type="text"
                      className="form-control"
                      value={prepData.printNotes}
                      onChange={e => setPrepData({ ...prepData, printNotes: e.target.value })}
                      placeholder="Ex: Livrer au magasin principal, chauffeur M. Sawadogo..."
                    />
                  </div>
                </div>

                {/* Custom column labels picker */}
                <div style={{ padding: '1rem', backgroundColor: 'rgba(185, 28, 28, 0.05)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <h5 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.75rem', color: '#b91c1c' }}>Libellés des colonnes (BL)</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {[
                      { col: 'blColNo', hide: 'hideBlColNo', label: 'Col 1 (N°)' },
                      { col: 'blColSite', hide: 'hideBlColSite', label: 'Col 2 (Site)' },
                      { col: 'blColDesc', hide: 'hideBlColDesc', label: 'Col 3 (Désignation)' },
                      { col: 'blColCode', hide: 'hideBlColCode', label: 'Col 4 (Code)' },
                      { col: 'blColRef', hide: 'hideBlColRef', label: 'Col 5 (Référence)' },
                      { col: 'blColQty', hide: 'hideBlColQty', label: 'Col 6 (Qté)' }
                    ].map(c => (
                      <div key={c.col} style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--card-bg)', padding: '6px 10px', border: '1px solid var(--glass-border)', borderRadius: '6px' }}>
                        <input 
                          type="checkbox" 
                          style={{ cursor: 'pointer' }} 
                          checked={prepData[c.hide] !== true} 
                          onChange={e => setPrepData({ ...prepData, [c.hide]: !e.target.checked })} 
                        />
                        <input 
                          type="text" 
                          className="form-control form-control-sm" 
                          style={{ border: '1px solid var(--glass-border)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)', background: 'var(--card-bg)', padding: '2px 6px', borderRadius: '4px', width: '100%', fontSize: '0.85rem', color: 'var(--text-color)', fontWeight: '600', transition: 'border-color 0.2s' }}
                          value={prepData[c.col]} 
                          onChange={e => setPrepData({ ...prepData, [c.col]: e.target.value })} 
                          placeholder={c.label} 
                        />
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Items Table Card */}
              <div className="premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: 'var(--text-color)' }}>
                    Articles inclus dans le Bon de Livraison
                  </h3>
                  
                  {/* Catalog Autocomplete Search Input */}
                  <div ref={searchInputContainerRef} style={{ position: 'relative', width: '300px' }}>
                    <div className="form-group" style={{ margin: 0, position: 'relative' }}>
                      <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text"
                        className="form-control"
                        placeholder="Rechercher / ajouter du catalogue..."
                        value={catalogSearch}
                        onChange={handleCatalogSearchChange}
                        style={{ paddingLeft: '2.25rem', borderRadius: '10px' }}
                      />
                    </div>

                    {showSuggestions && (
                      <div className="suggestions-dropdown">
                        {isSearchingCatalog ? (
                          <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>Recherche en cours...</div>
                        ) : catalogSuggestions.length === 0 ? (
                          <div style={{ padding: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aucun article trouvé</div>
                        ) : (
                          catalogSuggestions.map(item => (
                            <div 
                              key={item.id} 
                              className="suggestion-item"
                              onClick={() => handleSelectSuggestion(item)}
                            >
                              <span style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Code: {item.code || '-'} | Réf CFAO: {item.refCfao || '-'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ width: '15%' }}>Code</th>
                        <th>Désignation (Article)</th>
                        <th style={{ width: '20%' }}>Réf. CFAO</th>
                        <th style={{ width: '15%' }}>À Livrer (Quantité)</th>
                        <th style={{ width: '60px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {prepData.items.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                            <Info size={24} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                            Aucun article ajouté. Recherchez un article dans le catalogue ci-dessus ou ajoutez une ligne libre.
                          </td>
                        </tr>
                      ) : (
                        prepData.items.map((item, idx) => (
                          <tr key={item.id}>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                value={item.code || ''} 
                                onChange={e => handleItemChange(idx, 'code', e.target.value)} 
                                placeholder="Code" 
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                style={{ fontWeight: 'bold' }} 
                                value={item.description} 
                                onChange={e => handleItemChange(idx, 'description', e.target.value)} 
                                placeholder="Désignation de l'article" 
                                required
                              />
                            </td>
                            <td>
                              <input 
                                type="text" 
                                className="form-control form-control-sm" 
                                value={item.refCfao || ''} 
                                onChange={e => handleItemChange(idx, 'refCfao', e.target.value)} 
                                placeholder="Référence" 
                              />
                            </td>
                            <td>
                              <input 
                                type="number"
                                onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} 
                                min="1"
                                className="form-control form-control-sm"
                                style={{ fontWeight: 'bold', borderColor: '#b91c1c' }}
                                value={item.quantity}
                                onChange={e => handleItemChange(idx, 'quantity', e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button 
                                className="btn btn-danger-outline btn-sm"
                                onClick={() => handleRemoveItem(idx)}
                                title="Retirer"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                  <button 
                    className="btn btn-secondary flex items-center gap-1"
                    onClick={handleAddFreeItem}
                  >
                    <Plus size={16} /> Ajouter une ligne libre
                  </button>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => { setSelectedClientId(''); resetPrepForm(); }}
                    >
                      Annuler
                    </button>
                    <button 
                      className="btn btn-primary"
                      onClick={handleSaveAndPrint}
                      disabled={prepData.items.length === 0}
                      style={{ background: 'linear-gradient(135deg, #b91c1c, #991b1b)', border: 'none', padding: '0.75rem 2rem', fontWeight: 'bold' }}
                    >
                      <Printer size={18} style={{ marginRight: '0.5rem', display: 'inline' }} />
                      Sauvegarder & Imprimer le BL
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === 'history' && (
        <div>
          {/* History Filters */}
          <div className="premium-card flex gap-4" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', alignItems: 'center' }}>
            <div className="form-group" style={{ flex: 1.5, minWidth: '250px', margin: 0, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text"
                className="form-control"
                placeholder="Rechercher par N° Bordereau ou Client..."
                value={historySearch}
                onChange={(e) => { setHistorySearch(e.target.value); setCurrentPage(1); }}
                style={{ paddingLeft: '2.25rem', borderRadius: '10px' }}
              />
            </div>

            <div className="form-group" style={{ flex: 1, minWidth: '200px', margin: 0 }}>
              <select 
                className="form-select-premium"
                value={historyClientId}
                onChange={(e) => { setHistoryClientId(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">Toutes les mines (Clients)</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group" style={{ flex: 1, minWidth: '200px', margin: 0 }}>
              <select 
                className="form-select-premium"
                value={historyPartnerId}
                onChange={(e) => { setHistoryPartnerId(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">Tous les partenaires</option>
                {partners.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* History List Table */}
          <div className="premium-card">
            {loadingHistory ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '250px' }}>
                <div className="spinner" style={{ border: '3px solid rgba(0,0,0,0.1)', borderTop: '3px solid #b91c1c', borderRadius: '50%', width: '30px', height: '30px', animation: 'spin 1s linear infinite' }}></div>
              </div>
            ) : historyDischarges.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)' }}>
                <Info size={40} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                <p>Aucun bordereau d'expédition groupé n'a été trouvé.</p>
              </div>
            ) : (
              <>
                <div className="table-wrapper">
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>N° Bordereau (BL)</th>
                        <th>Client / Mine</th>
                        <th>Créé par</th>
                        <th>Partenaire</th>
                        <th>Date Création</th>
                        <th>Nombre d'articles</th>
                        <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDischarges.map(discharge => (
                        <tr key={discharge.id} style={discharge.status === 'annule' ? { opacity: 0.6 } : {}}>
                          <td style={{ fontWeight: '700', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {discharge.discharge_number}
                            {discharge.status === 'annule' && (
                              <span style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', fontWeight: 'bold' }}>
                                Annulé
                              </span>
                            )}
                          </td>
                          <td style={{ fontWeight: '600' }}>{discharge.client_name}</td>
                          <td>
                            <span className="badge badge-info" style={{ textTransform: 'capitalize', fontSize: '11px', fontWeight: '600' }}>
                              {discharge.creator_name || 'Système'}
                            </span>
                          </td>
                          <td>{discharge.partner_name || 'Aucun'}</td>
                          <td>{new Date(discharge.created_at).toLocaleString('fr-FR')}</td>
                          <td>{discharge.items?.filter(it => !it.isMetadata)?.length || 0} article(s)</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleViewDischarge(discharge)}
                                title="Voir les détails"
                              >
                                <Eye size={16} />
                              </button>
                              {user?.role !== 'observateur' && discharge.status !== 'annule' && (
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleEditDischarge(discharge)}
                                  title="Modifier le BL"
                                >
                                  <Edit size={16} />
                                </button>
                              )}
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => handlePrintDischarge(discharge)}
                                title="Réimprimer"
                              >
                                <Printer size={16} />
                              </button>
                              {user?.role !== 'observateur' && user?.role !== 'gestionnaire2' && user?.role !== 'gestionnaire 2' && discharge.status !== 'annule' && (
                                <button 
                                  className="btn btn-danger-outline btn-sm"
                                  onClick={() => handleCancelDischarge(discharge)}
                                  title="Annuler le BL"
                                >
                                  <Ban size={16} />
                                </button>
                              )}
                              {user?.role !== 'observateur' && user?.role !== 'gestionnaire2' && user?.role !== 'gestionnaire 2' && (
                                <button 
                                  className="btn btn-danger-outline btn-sm"
                                  onClick={() => handleDeleteDischarge(discharge)}
                                  title="Supprimer la décharge de l'historique"
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="pagination" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>Page {currentPage} / {totalPages}</span>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW DETAILS MODAL */}
      {isViewModalOpen && selectedDischarge && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                Bordereau {selectedDischarge.discharge_number}
              </h3>
              <button className="modal-close" onClick={() => setIsViewModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--border-color)', borderRadius: '8px' }}>
                <div>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Client / Mine de Destination</p>
                  <p style={{ margin: 0, fontWeight: '700' }}>{selectedDischarge.client_name}</p>
                </div>
                <div>
                  <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date de Création</p>
                  <p style={{ margin: 0, fontWeight: '700' }}>{new Date(selectedDischarge.created_at).toLocaleString('fr-FR')}</p>
                </div>
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.75rem' }}>Articles</h4>
              <div className="table-wrapper" style={{ marginBottom: '1.5rem' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Code NSA</th>
                      <th>Désignation</th>
                      <th>Réf. Fabricant</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Qté</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDischarge.items?.filter(it => !it.isMetadata).map((item, index) => (
                      <tr key={index}>
                        <td>{item.code || 'N/A'}</td>
                        <td style={{ fontWeight: '700' }}>{item.description}</td>
                        <td>{item.refCfao || '-'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedDischarge.notes && (
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '0.5rem' }}>Instructions logistiques</h4>
                  <p style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', whiteSpace: 'pre-wrap', margin: 0 }}>
                    {selectedDischarge.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setIsViewModalOpen(false)}
              >
                Fermer
              </button>
              <button 
                className="btn btn-primary"
                onClick={() => { setIsViewModalOpen(false); handlePrintDischarge(selectedDischarge); }}
                style={{ background: 'linear-gradient(135deg, #b91c1c, #991b1b)', border: 'none' }}
              >
                <Printer size={16} style={{ marginRight: '0.5rem', display: 'inline' }} />
                Imprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALERT MODAL */}
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
}
