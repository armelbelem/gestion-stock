'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Truck, Search, Calendar, Paperclip, Eye, Download, 
  ArrowUpRight, ExternalLink, RefreshCw, CheckCircle, AlertTriangle, 
  ChevronRight, Upload, X, HelpCircle, FileSpreadsheet, Percent, Info
} from 'lucide-react';
import Link from 'next/link';
import { storage } from '../../lib/storage';
import { useAuth } from '../../providers';
import { hasPermission } from '../../lib/auth';
import AlertModal from '../../components/AlertModal';

export default function DocumentsCentralizedPage() {
  const { user } = useAuth();
  
  // Onglet actif : 'BC' ou 'BL'
  const [activeTab, setActiveTab] = useState('BC');
  
  // États de données
  const [documents, setDocuments] = useState([]);
  const [partners, setPartners] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // États pour les filtres
  const [search, setSearch] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'signed', 'pending'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // États des Modals
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });

  // Référence pour l'input file caché d'upload
  const fileInputRef = useRef(null);
  const [uploadingDocId, setUploadingDocId] = useState(null);

  // Charger les données initiales
  useEffect(() => {
    loadPartners();
    loadSettings();
    // Plage de dates par défaut : Du 1er janvier de cette année à aujourd'hui
    const currentYear = new Date().getFullYear();
    setStartDate(`${currentYear}-01-01`);
    setEndDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Recharger les documents lorsque les filtres ou l'onglet actif changent
  useEffect(() => {
    if (startDate && endDate) {
      loadDocuments();
    }
  }, [activeTab, selectedPartnerId, selectedStatus, startDate, endDate, search]);

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

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const url = `/api/documents-centralized?type=${activeTab}&partnerId=${selectedPartnerId}&status=${selectedStatus}&startDate=${startDate}&endDate=${endDate}&search=${encodeURIComponent(search)}&_t=${Date.now()}`;
      
      const token = sessionStorage.getItem('token');
      const res = await fetch(url, {
        headers: { 'Authorization': token ? `Bearer ${token}` : '' }
      });
      
      if (!res.ok) throw new Error("Échec du chargement des documents");
      
      const data = await res.json();
      setDocuments(data || []);
    } catch (err) {
      console.error("Error fetching centralized documents:", err);
      showAlert('error', 'Erreur de chargement', "Impossible de récupérer la liste des documents.");
    } finally {
      setLoading(false);
    }
  };

  // Gestion des Alertes Modales
  const showAlert = (type, title, message) => {
    setAlertModal({ open: true, type, title, message, onConfirm: null });
  };
  const closeAlert = () => {
    setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  };

  // Formater les prix
  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString('fr-FR') + ' F.CFA';
    }
    return num.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' F.CFA';
  };

  // Calculer les statistiques sur les documents filtrés
  const getStats = () => {
    const totalBc = documents.filter(d => d.docType === 'BC').length;
    const totalBl = documents.filter(d => d.docType === 'BL').length;
    const totalDocs = documents.length;
    const signedDocs = documents.filter(d => d.attachment !== null && d.attachment !== '').length;
    const signedRate = totalDocs > 0 ? Math.round((signedDocs / totalDocs) * 100) : 0;
    
    return { totalBc, totalBl, totalDocs, signedDocs, signedRate };
  };

  const statsObj = getStats();

  // Déclencher l'upload de fichier joint pour un document
  const triggerUpload = (docId) => {
    setUploadingDocId(docId);
    fileInputRef.current.click();
  };

  // Gérer l'upload effectif du fichier
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingDocId) return;

    if (file.size > 5 * 1024 * 1024) {
      showAlert('error', 'Fichier trop lourd', 'La taille maximale autorisée est de 5 Mo.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const token = sessionStorage.getItem('token');
      
      // 1. Upload physique du fichier
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': token ? `Bearer ${token}` : '' },
        body: formData
      });
      
      if (!uploadRes.ok) throw new Error("Erreur de téléversement physique");
      const uploadData = await uploadRes.json();

      if (uploadData.success) {
        // Déterminer le document concerné pour appliquer le bon patch
        const doc = documents.find(d => d.id === uploadingDocId);
        if (!doc) throw new Error("Document introuvable");

        let apiPath = '';
        if (doc.docType === 'BL') {
          apiPath = `/api/deliveries?id=${doc.id}`;
        } else if (doc.docType === 'BC' && doc.docSource === 'partenaire') {
          apiPath = `/api/contract-bc-history?id=${doc.id}`;
        } else {
          // Commande Spéciale Externe (pas de support upload dans son API standard)
          throw new Error("Le téléversement n'est supporté que pour les BL et BC Partenaires.");
        }

        // 2. Associer la pièce jointe en base de données via PATCH
        const patchRes = await fetch(apiPath, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({ attachment: uploadData.url })
        });

        if (!patchRes.ok) throw new Error("Échec de l'association du document joint");

        showAlert('success', 'Document téléversé', 'Le scan signé a été associé avec succès.');
        
        // Mettre à jour l'état visuel du modal ouvert si nécessaire
        if (selectedDoc && selectedDoc.id === uploadingDocId) {
          setSelectedDoc(prev => ({ ...prev, attachment: uploadData.url }));
        }

        // Recharger la liste
        await loadDocuments();
      } else {
        throw new Error(uploadData.error || 'Erreur inconnue lors de l\'upload');
      }
    } catch (err) {
      console.error("[UPLOAD ERROR]", err);
      showAlert('error', 'Erreur de téléversement', err.message || "Une erreur est survenue lors de l'upload.");
    } finally {
      setLoading(false);
      setUploadingDocId(null);
      e.target.value = ''; // Reset input file
    }
  };

  // Voir les détails d'un document
  const viewDetails = (doc) => {
    setSelectedDoc(doc);
    setIsViewModalOpen(true);
  };

  return (
    <div className="documents-container" style={{ padding: '1.5rem', minHeight: '100vh', position: 'relative' }}>
      
      {/* Styles CSS Injectés pour une expérience visuelle ultra premium (Glassmorphism & animations) */}
      <style dangerouslySetInnerHTML={{__html: `
        :root {
          --glass-bg: rgba(255, 255, 255, 0.7);
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

        /* Dashboard Stat Cards */
        .stats-dashboard {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2.5rem;
          animation: fadeIn 0.6s ease-out;
        }
        
        .stat-card-doc {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          padding: 1.5rem;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-premium);
          display: flex;
          align-items: center;
          gap: 1.25rem;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .stat-card-doc:hover {
          transform: translateY(-5px);
          box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.1);
        }

        .stat-card-doc::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 6px;
          height: 100%;
        }

        .card-bc::before { background: linear-gradient(to bottom, #3b82f6, #1d4ed8); }
        .card-bl::before { background: linear-gradient(to bottom, #10b981, #047857); }
        .card-signed::before { background: linear-gradient(to bottom, #8b5cf6, #6d28d9); }

        .icon-box-doc {
          width: 54px;
          height: 54px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
        }

        .card-bc .icon-box-doc { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .card-bl .icon-box-doc { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .card-signed .icon-box-doc { background: rgba(139, 92, 246, 0.1); color: #8b5cf6; }

        .stat-info .stat-value {
          font-size: 1.8rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 0.25rem;
          color: var(--text-main) !important;
        }
        
        .stat-info .stat-label {
          font-size: 0.85rem;
          color: var(--text-muted) !important;
          font-weight: 500;
        }

        /* Glass Filter Panel */
        .filter-panel-glass {
          background: var(--glass-bg);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid var(--glass-border);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          box-shadow: var(--shadow-premium);
          animation: slideUp 0.6s ease-out;
        }

        /* Table & Tabs Container */
        .workspace-card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          box-shadow: var(--shadow-premium);
          overflow: hidden;
          margin-bottom: 2rem;
          animation: slideUp 0.7s ease-out;
        }

        .workspace-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-muted);
          padding: 0 1rem;
        }

        .tab-btn-premium {
          padding: 1.25rem 1.75rem;
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--text-muted);
          border: none;
          background: none;
          position: relative;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tab-btn-premium:hover {
          color: var(--text-color);
        }

        .tab-btn-premium.active {
          color: var(--primary);
        }

        .tab-btn-premium.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 3px;
          background: var(--primary);
          border-radius: 3px 3px 0 0;
        }

        /* Rows Hover Effect */
        .table-row-premium {
          transition: background-color 0.2s ease;
          cursor: pointer;
        }
        .table-row-premium:hover {
          background-color: var(--bg-hover) !important;
        }

        /* Badge Status */
        .badge-signed-premium {
          background-color: rgba(16, 185, 129, 0.12) !important;
          color: #10b981 !important;
          border: 1px solid rgba(16, 185, 129, 0.2);
          font-weight: 700 !important;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .badge-pending-premium {
          background-color: rgba(245, 158, 11, 0.12) !important;
          color: #f59e0b !important;
          border: 1px solid rgba(245, 158, 11, 0.2);
          font-weight: 700 !important;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        /* Animations */
        @keyframes slideDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* Custom Modal Glass */
        .modal-glass-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-glass-content {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          width: 90%;
          max-width: 950px;
          max-height: 85vh;
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes zoomIn {
          from { transform: scale(0.9) translateY(10px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }

        .modal-glass-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-muted);
        }

        .modal-glass-body {
          padding: 2rem;
          overflow-y: auto;
          flex-grow: 1;
        }

        .modal-glass-footer {
          padding: 1.25rem 1.5rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          background: var(--bg-muted);
        }

        /* Document Items Details Table */
        .doc-details-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 1.5rem;
        }
        
        .doc-details-table th {
          background-color: var(--bg-muted);
          color: var(--text-color);
          font-weight: 700;
          font-size: 0.85rem;
          padding: 10px 14px;
          text-align: left;
          border-bottom: 2px solid var(--border-color);
        }

        .doc-details-table td {
          padding: 12px 14px;
          font-size: 0.88rem;
          border-bottom: 1px solid var(--border-color);
        }
      `}} />

      {/* Input File invisible pour l'upload à la volée */}
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileUpload}
      />

      {/* Entête de Page */}
      <div className="header-title-section no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 850, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileText size={32} className="text-primary" /> Centralisation des Documents (BL & BC)
          </h1>
          <p className="text-muted" style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
            Suivez, recherchez et gérez l'ensemble des Bons de Commande et Bons de Livraison de l'entreprise.
          </p>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}
            onClick={loadDocuments}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Actualiser
          </button>
        </div>
      </div>

      {/* Tableau de Bord des Statistiques Filtrées */}
      <div className="stats-dashboard no-print">
        <div className="stat-card-doc card-bc">
          <div className="icon-box-doc">
            <FileText size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{loading ? '...' : statsObj.totalBc}</div>
            <div className="stat-label">Bons de Commande (BC)</div>
          </div>
        </div>

        <div className="stat-card-doc card-bl">
          <div className="icon-box-doc">
            <Truck size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{loading ? '...' : statsObj.totalBl}</div>
            <div className="stat-label">Bons de Livraison (BL)</div>
          </div>
        </div>

        <div className="stat-card-doc card-signed">
          <div className="icon-box-doc">
            <Percent size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{loading ? '...' : `${statsObj.signedRate}%`}</div>
            <div className="stat-label">Documents Signés & Joints</div>
          </div>
        </div>
      </div>

      {/* Panel de Filtres Multicritères Glassmorphism */}
      <div className="filter-panel-glass no-print">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          
          {/* Recherche Textuelle */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)' }}>Recherche intelligente</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="N°, titre, article..." 
                style={{ paddingLeft: '32px', height: '40px' }}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '12px', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Filtre Partenaire */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)' }}>Partenaire contractuel</label>
            <select 
              className="form-control" 
              style={{ height: '40px' }}
              value={selectedPartnerId}
              onChange={e => setSelectedPartnerId(e.target.value)}
            >
              <option value="all">Tous les partenaires</option>
              {partners.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Filtre Statut Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)' }}>Statut pièce jointe</label>
            <select 
              className="form-control" 
              style={{ height: '40px' }}
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
            >
              <option value="all">Tous les documents</option>
              <option value="signed">Scans signés uniquement</option>
              <option value="pending">En attente de signature</option>
            </select>
          </div>

          {/* Plage de dates */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)' }}>Période (Du)</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ height: '40px' }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-color)' }}>Période (Au)</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ height: '40px' }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

        </div>
      </div>

      {/* Workspace Principal (Onglets + Table des Documents) */}
      <div className="workspace-card">
        
        {/* En-tête des Onglets */}
        <div className="workspace-tabs no-print">
          <button 
            className={`tab-btn-premium ${activeTab === 'BC' ? 'active' : ''}`}
            onClick={() => { setActiveTab('BC'); setDocuments([]); }}
          >
            <FileText size={18} /> Bons de Commande (BC)
          </button>
          
          <button 
            className={`tab-btn-premium ${activeTab === 'BL' ? 'active' : ''}`}
            onClick={() => { setActiveTab('BL'); setDocuments([]); }}
          >
            <Truck size={18} /> Bons de Livraison (BL)
          </button>
        </div>

        {/* Corps du tableau */}
        <div style={{ overflowX: 'auto', minHeight: '350px' }}>
          
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px', gap: '1rem' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
              <p className="text-muted" style={{ fontWeight: 500 }}>Chargement des documents filtrés...</p>
            </div>
          ) : documents.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '350px', padding: '2rem', textAlign: 'center' }}>
              <HelpCircle size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
              <h3 style={{ margin: 0, fontWeight: 700 }}>Aucun document trouvé</h3>
              <p className="text-muted" style={{ maxWidth: '400px', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                Aucun document ne correspond à vos critères de filtres ou à votre recherche pour la période sélectionnée.
              </p>
            </div>
          ) : (
            <table className="table" style={{ width: '100%', margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '140px' }}>N° Document</th>
                  <th style={{ width: '110px' }}>Date</th>
                  <th>Partenaire / Client / Fournisseur</th>
                  <th>Détail du Contenu (Articles)</th>
                  <th style={{ width: '150px', textAlign: 'center' }}>Scan Signé</th>
                  <th style={{ width: '180px', textAlign: 'center' }} className="no-print">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map(doc => {
                  const itemsSummary = doc.items.map(i => {
                    const parts = [`${i.quantity}x ${i.description.split('\n')[0]}`];
                    if (i.code) parts.push(`(${i.code})`);
                    return parts.join(' ');
                  }).join(', ');
                  const itemsLength = doc.items.length;
                  const displaySummary = itemsSummary.length > 55 ? itemsSummary.slice(0, 55) + '...' : itemsSummary;

                  return (
                    <tr 
                      key={doc.id} 
                      className="table-row-premium"
                      onClick={() => viewDetails(doc)}
                    >
                      <td style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#1e40af' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {doc.docType === 'BC' ? <FileText size={14} className="text-primary" /> : <Truck size={14} className="text-success" />}
                          {doc.docNumber}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.88rem' }}>
                        {new Date(doc.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 650, fontSize: '0.9rem' }}>
                            {doc.docSource === 'externe' ? doc.supplierName : doc.partnerName}
                          </span>
                          {doc.docSource === 'externe' && doc.partnerName && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Client : {doc.partnerName}
                            </span>
                          )}
                          {doc.folderNumber && (
                            <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 'bold' }}>
                              Dossier #{String(doc.folderNumber).padStart(3, '0')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                        <div title={itemsSummary}>
                          {displaySummary}
                          {itemsLength > 3 && (
                            <span className="badge badge-primary" style={{ marginLeft: '6px', fontSize: '0.65rem', padding: '2px 6px' }}>
                              +{itemsLength - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                        {doc.attachment ? (
                          <a 
                            href={doc.attachment} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="badge badge-signed-premium"
                            title="Visualiser le scan d'origine"
                            style={{ textDecoration: 'none' }}
                          >
                            <CheckCircle size={12} /> Signé
                          </a>
                        ) : (
                          <span className="badge badge-pending-premium">
                            <AlertTriangle size={12} /> Manquant
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }} className="no-print" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          
                          {/* Visualiser les détails dans le popup */}
                          <button 
                            className="btn btn-secondary btn-sm" 
                            title="Détails du document"
                            onClick={() => viewDetails(doc)}
                            style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Eye size={16} />
                          </button>

                          {/* Télécharger/Voir Pièce Jointe */}
                          {doc.attachment && (
                            <a 
                              href={doc.attachment} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="btn btn-secondary btn-sm" 
                              title="Télécharger le fichier joint"
                              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}
                            >
                              <Download size={16} />
                            </a>
                          )}

                          {/* Joindre/Téléverser scan (Sauf BC externe qui n'a pas d'API d'upload directe disponible dans l'ERP) */}
                          {doc.docSource !== 'externe' && (
                            <button 
                              className="btn btn-secondary btn-sm" 
                              title={doc.attachment ? "Remplacer le scan" : "Joindre le scan signé"}
                              onClick={() => triggerUpload(doc.id)}
                              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Upload size={16} style={{ color: doc.attachment ? 'var(--text-muted)' : 'var(--warning)' }} />
                            </button>
                          )}

                          {/* Lien vers la page d'origine */}
                          {doc.docSource === 'externe' ? (
                            <Link 
                              href="/external-orders"
                              className="btn btn-secondary btn-sm" 
                              title="Ouvrir commandes spéciales"
                              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <ArrowUpRight size={16} />
                            </Link>
                          ) : (
                            <Link 
                              href={`/contract-gateway`}
                              className="btn btn-secondary btn-sm" 
                              title="Ouvrir achats partenaires"
                              style={{ width: '32px', height: '32px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <ArrowUpRight size={16} />
                            </Link>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

        </div>
      </div>

      {/* Modal Premium Visionneuse de Détails (Glassmorphism Modal) */}
      {isViewModalOpen && selectedDoc && (
        <div className="modal-glass-backdrop" onClick={() => setIsViewModalOpen(false)}>
          <div className="modal-glass-content" onClick={e => e.stopPropagation()}>
            
            {/* Header Modal */}
            <div className="modal-glass-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className="icon-box-premium" style={{ width: '40px', height: '40px', borderRadius: '8px' }}>
                  {selectedDoc.docType === 'BC' ? <FileText size={20} className="text-primary" /> : <Truck size={20} className="text-success" />}
                </span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    Détails du {selectedDoc.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Type : {selectedDoc.docType === 'BC' ? 'Bon de Commande' : 'Bon de Livraison'} ({selectedDoc.docSource === 'partenaire' ? 'Partenaire Contractuel' : 'Externe'})
                  </p>
                </div>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ width: '36px', height: '36px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none' }}
                onClick={() => setIsViewModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body Modal */}
            <div className="modal-glass-body">
              
              {/* Infos Clés */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', padding: '1.25rem', backgroundColor: 'var(--bg-muted)', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Numéro de Document</span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 'bold', color: '#1e40af', marginTop: '2px' }}>{selectedDoc.docNumber}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Date d'émission</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '2px' }}>
                    {new Date(selectedDoc.date).toLocaleDateString('fr-FR')} {new Date(selectedDoc.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                    {selectedDoc.docSource === 'externe' ? 'Fournisseur' : 'Partenaire'}
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 'bold', marginTop: '2px' }}>
                    {selectedDoc.docSource === 'externe' ? selectedDoc.supplierName : selectedDoc.partnerName}
                  </span>
                </div>

                {selectedDoc.folderNumber && (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 'bold' }}>Dossier Associé</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 'bold', color: '#991b1b', marginTop: '2px' }}>
                      N° {String(selectedDoc.folderNumber).padStart(3, '0')}
                    </span>
                  </div>
                )}

              </div>

              {/* Titre Articles */}
              <h4 style={{ margin: '1.5rem 0 0.5rem 0', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={16} className="text-primary" /> Liste des articles contenus ({selectedDoc.items.length})
              </h4>

              {/* Table des articles du document */}
              <table className="doc-details-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>N°</th>
                    <th>Description de l'article</th>
                    <th style={{ width: '90px', textAlign: 'center' }}>Quantité</th>
                    {hasPermission(user, 'stock', 'view_cost_price') && (
                      <>
                        <th style={{ width: '130px', textAlign: 'right' }}>Prix Achat HT</th>
                        <th style={{ width: '140px', textAlign: 'right' }}>Total HT</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selectedDoc.items.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>
                        <div>{item.description}</div>
                        {(item.code || item.refCfao) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 'normal' }}>
                            {item.code && <span>Code : <strong style={{ color: 'var(--primary)' }}>{item.code}</strong></span>}
                            {item.code && item.refCfao && <span style={{ margin: '0 6px' }}>|</span>}
                            {item.refCfao && <span>Réf : <strong style={{ color: 'var(--danger)' }}>{item.refCfao}</strong></span>}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                      {hasPermission(user, 'stock', 'view_cost_price') && (
                        <>
                          <td style={{ textAlign: 'right' }}>{formatPrice(item.purchasePrice)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(item.purchasePrice * item.quantity)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                  {/* Ligne des Totaux si permission d'accès aux prix */}
                  {hasPermission(user, 'stock', 'view_cost_price') && (
                    <tr style={{ backgroundColor: 'var(--bg-muted)', fontWeight: 'bold' }}>
                      <td colSpan={2} style={{ textAlign: 'right' }}>Total Général HT :</td>
                      <td style={{ textAlign: 'center' }}>
                        {selectedDoc.items.reduce((sum, it) => sum + it.quantity, 0)}
                      </td>
                      <td colSpan={2} style={{ textAlign: 'right', fontSize: '1.05rem', color: '#1e40af' }}>
                        {formatPrice(selectedDoc.items.reduce((sum, it) => sum + (it.purchasePrice * it.quantity), 0))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Fichier joint scan signature */}
              <div style={{ marginTop: '2rem', padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'between', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Paperclip size={20} className={selectedDoc.attachment ? 'text-success' : 'text-warning'} />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 'bold' }}>Scan du document signé original</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {selectedDoc.attachment ? "Un scan signé est actuellement associé à ce document." : "Aucun scan signé n'est associé à ce document."}
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
                  {/* Actions Pièces Jointes */}
                  {selectedDoc.attachment && (
                    <a 
                      href={selectedDoc.attachment} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', textDecoration: 'none' }}
                    >
                      <Eye size={14} /> Voir le scan
                    </a>
                  )}
                  {selectedDoc.docSource !== 'externe' && (
                    <button 
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      onClick={() => triggerUpload(selectedDoc.id)}
                    >
                      <Upload size={14} /> {selectedDoc.attachment ? "Changer le scan" : "Téléverser le scan signé"}
                    </button>
                  )}
                </div>
              </div>

            </div>

            {/* Footer Modal */}
            <div className="modal-glass-footer">
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsViewModalOpen(false)}
              >
                Fermer
              </button>

              {/* Raccourci vers la fiche complète du dossier */}
              {selectedDoc.docSource === 'externe' ? (
                <Link 
                  href="/external-orders"
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Ouvrir Commande Spéciale <ExternalLink size={16} />
                </Link>
              ) : (
                <Link 
                  href={`/contract-gateway`}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  Ouvrir Achats Partenaires <ExternalLink size={16} />
                </Link>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Alerte Modal Standard */}
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
