'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle2, 
  Search, Coins, Package, TrendingUp, HelpCircle, ArrowRight, Info, AlertCircle
} from 'lucide-react';
import { storage } from '../../../lib/storage';
import { exportToExcel } from '../../../utils/excelExport';

export default function StockValuationPage() {
  const pathname = usePathname();
  const [settings, setSettings] = useState(null);
  
  // File states
  const [fileA, setFileA] = useState(null); // Selling prices
  const [fileB, setFileB] = useState(null); // Stock & Purchase prices
  const [fileAData, setFileAData] = useState([]);
  const [fileBData, setFileBData] = useState([]);
  const [fileAError, setFileAError] = useState('');
  const [fileBError, setFileBError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Rapprochement results
  const [results, setResults] = useState(null);
  const [reportMeta, setReportMeta] = useState(null);
  const [activeTab, setActiveTab] = useState('matched'); // matched, unmatchedA, unmatchedB, duplicates
  const [searchTerm, setSearchTerm] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    loadSettings();
    loadSavedReport();
  }, []);

  const loadSavedReport = async () => {
    setLoading(true);
    try {
      const response = await storage.get('reports/saved?type=stock-valuation');
      if (response && response.data) {
        setResults(response.data);
        setReportMeta({
          fileAName: response.fileAName,
          fileBName: response.fileBName,
          generatedBy: response.generatedBy,
          updatedAt: response.updatedAt
        });
      }
    } catch (err) {
      console.error("Erreur lors du chargement du rapport sauvegardé:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) {
      console.error(err);
    }
  };

  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Helper to normalize reference: uppercase and strip non-alphanumeric characters
  const normalizeRef = (ref) => {
    if (!ref) return '';
    return String(ref).toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  };

  // Read Excel File
  const handleFileChange = (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fileType === 'A') {
      setFileA(file);
      setFileAError('');
    } else {
      setFileB(file);
      setFileBError('');
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet);
        
        const refPatterns = [/référence/i, /reference/i, /ref/i, /code/i];
        const designationPatterns = [/désignation/i, /designation/i, /article/i, /nom/i, /description/i];
        const salePricePatterns = [/prix.*vente/i, /p\.v/i, /pv/i, /vente/i, /prix/i];
        const purchasePricePatterns = [/prix.*achat/i, /p\.a/i, /pa/i, /achat/i, /prix/i];
        const stockPatterns = [/stock.*disponible/i, /stock/i, /qté/i, /qte/i, /quantité/i, /quantite/i, /dispo/i];

        if (fileType === 'A') {
          setFileAData(rows);
          if (rows.length > 0) {
            const firstRow = rows[0];
            const missing = [];
            if (!findColumnKey(firstRow, refPatterns)) missing.push("Référence");
            if (!findColumnKey(firstRow, designationPatterns)) missing.push("Désignation / Article");
            if (!findColumnKey(firstRow, stockPatterns)) missing.push("Stock disponible");
            if (!findColumnKey(firstRow, salePricePatterns)) missing.push("Prix de vente");
            if (missing.length > 0) {
              setFileAError(`Format non respecté. Colonnes manquantes : ${missing.join(', ')}`);
            }
          } else {
            setFileAError("Le fichier Excel importé est vide.");
          }
        } else {
          setFileBData(rows);
          if (rows.length > 0) {
            const firstRow = rows[0];
            const missing = [];
            if (!findColumnKey(firstRow, refPatterns)) missing.push("Référence");
            if (!findColumnKey(firstRow, designationPatterns)) missing.push("Désignation / Article");
            if (!findColumnKey(firstRow, purchasePricePatterns)) missing.push("Prix d'achat");
            if (missing.length > 0) {
              setFileBError(`Format non respecté. Colonnes manquantes : ${missing.join(', ')}`);
            }
          } else {
            setFileBError("Le fichier Excel importé est vide.");
          }
        }
      } catch (err) {
        console.error(err);
        if (fileType === 'A') {
          setFileAError(`Erreur de lecture : ${err.message}`);
        } else {
          setFileBError(`Erreur de lecture : ${err.message}`);
        }
      }
    };
    reader.readAsBinaryString(file);
  };

  // Find column key matching pattern
  const findColumnKey = (row, patterns) => {
    if (!row) return null;
    const keys = Object.keys(row);
    for (const pattern of patterns) {
      const foundKey = keys.find(k => pattern.test(String(k).trim().toLowerCase()));
      if (foundKey) return foundKey;
    }
    return null;
  };

  // Process mapping and matching
  const handleProcess = () => {
    if (fileAData.length === 0 || fileBData.length === 0) {
      alert("Veuillez importer les deux fichiers Excel avant de lancer le traitement.");
      return;
    }

    setLoading(true);
    
    // Patterns for columns
    const refPatterns = [/référence/i, /reference/i, /ref/i, /code/i];
    const designationPatterns = [/désignation/i, /designation/i, /article/i, /nom/i, /description/i];
    const salePricePatterns = [/prix.*vente/i, /p\.v/i, /pv/i, /vente/i, /prix/i];
    const purchasePricePatterns = [/prix.*achat/i, /p\.a/i, /pa/i, /achat/i, /prix/i];
    const stockPatterns = [/stock.*disponible/i, /stock/i, /qté/i, /qte/i, /quantité/i, /quantite/i, /dispo/i];

    // Read File A (Selling prices & Stock available)
    const listA = [];
    const duplicatesA = [];
    const seenA = new Map();
    let processedRowsA = 0;

    fileAData.forEach((row, index) => {
      // Skip empty rows
      if (Object.keys(row).length === 0) return;

      const refKey = findColumnKey(row, refPatterns);
      const desKey = findColumnKey(row, designationPatterns);
      const saleKey = findColumnKey(row, salePricePatterns);
      const stockKey = findColumnKey(row, stockPatterns);

      const rawRef = refKey ? row[refKey] : null;
      if (!rawRef) return; // Ignore row if no reference

      processedRowsA++;
      const normRef = normalizeRef(rawRef);
      const designation = desKey ? row[desKey] : '';
      
      // Parse selling price
      let sellingPrice = 0;
      if (saleKey) {
        const val = String(row[saleKey]).replace(/[^0-9.,]/g, '').replace(',', '.');
        sellingPrice = parseFloat(val) || 0;
      }

      // Parse stock
      let stock = 0;
      if (stockKey) {
        const val = String(row[stockKey]).replace(/[^0-9.-]/g, '');
        stock = parseFloat(val) || 0;
      }

      const entry = {
        originalRef: String(rawRef).trim(),
        normalizedRef: normRef,
        designation: String(designation).trim(),
        sellingPrice,
        stock,
        rowNumber: index + 2
      };

      listA.push(entry);

      if (seenA.has(normRef)) {
        duplicatesA.push({
          ref: rawRef,
          normalizedRef: normRef,
          designation,
          details: `Fichier A (Ligne ${index + 2})`,
          existing: seenA.get(normRef)
        });
      } else {
        seenA.set(normRef, entry);
      }
    });

    // Read File B (Purchase prices)
    const listB = [];
    const duplicatesB = [];
    const seenB = new Map();
    let processedRowsB = 0;

    fileBData.forEach((row, index) => {
      if (Object.keys(row).length === 0) return;

      const refKey = findColumnKey(row, refPatterns);
      const desKey = findColumnKey(row, designationPatterns);
      const purchaseKey = findColumnKey(row, purchasePricePatterns);

      const rawRef = refKey ? row[refKey] : null;
      if (!rawRef) return;

      processedRowsB++;
      const normRef = normalizeRef(rawRef);
      const designation = desKey ? row[desKey] : '';

      // Parse purchase price
      let purchasePrice = 0;
      if (purchaseKey) {
        const val = String(row[purchaseKey]).replace(/[^0-9.,]/g, '').replace(',', '.');
        purchasePrice = parseFloat(val) || 0;
      }

      const entry = {
        originalRef: String(rawRef).trim(),
        normalizedRef: normRef,
        designation: String(designation).trim(),
        purchasePrice,
        rowNumber: index + 2
      };

      listB.push(entry);

      if (seenB.has(normRef)) {
        duplicatesB.push({
          ref: rawRef,
          normalizedRef: normRef,
          designation,
          details: `Fichier B (Ligne ${index + 2})`,
          existing: seenB.get(normRef)
        });
      } else {
        seenB.set(normRef, entry);
      }
    });

    // Perform Match
    const matched = [];
    const unmatchedA = []; // In A but not in B (Missing purchase price)
    const unmatchedB = []; // In B but not in A (Missing selling price / stock)

    // Group lists by normalized reference to pair them up by order of appearance
    const groupsA = new Map();
    listA.forEach(item => {
      if (!groupsA.has(item.normalizedRef)) {
        groupsA.set(item.normalizedRef, []);
      }
      groupsA.get(item.normalizedRef).push(item);
    });

    const groupsB = new Map();
    listB.forEach(item => {
      if (!groupsB.has(item.normalizedRef)) {
        groupsB.set(item.normalizedRef, []);
      }
      groupsB.get(item.normalizedRef).push(item);
    });

    // Iterate through all unique normalized references in groupsA
    groupsA.forEach((itemsA, normRef) => {
      const itemsB = groupsB.get(normRef) || [];
      const maxLen = Math.max(itemsA.length, itemsB.length);

      for (let i = 0; i < maxLen; i++) {
        if (i < itemsA.length && i < itemsB.length) {
          const aVal = itemsA[i];
          const bVal = itemsB[i];
          const designation = aVal.designation || bVal.designation || "Article Sans Nom";
          const stock = aVal.stock;
          const purchasePrice = bVal.purchasePrice;
          const sellingPrice = aVal.sellingPrice;

          matched.push({
            reference: aVal.originalRef,
            normalizedRef: normRef,
            article: designation,
            stock,
            purchasePrice,
            sellingPrice,
            stockValuePurchase: stock * purchasePrice,
            stockValueSale: stock * sellingPrice
          });
        } else if (i < itemsA.length) {
          const aVal = itemsA[i];
          unmatchedA.push({
            reference: aVal.originalRef,
            normalizedRef: normRef,
            article: aVal.designation || "Inconnu",
            stock: aVal.stock,
            sellingPrice: aVal.sellingPrice,
            details: `Présent dans Vente/Stock mais absent du fichier Prix d'Achat`
          });
        } else {
          const bVal = itemsB[i];
          unmatchedB.push({
            reference: bVal.originalRef,
            normalizedRef: normRef,
            article: bVal.designation || "Inconnu",
            purchasePrice: bVal.purchasePrice,
            details: `Présent dans Prix d'Achat mais absent du fichier Vente/Stock`
          });
        }
      }
    });

    // Catch references in groupsB that are completely missing in groupsA
    groupsB.forEach((itemsB, normRef) => {
      if (!groupsA.has(normRef)) {
        itemsB.forEach(bVal => {
          unmatchedB.push({
            reference: bVal.originalRef,
            normalizedRef: normRef,
            article: bVal.designation || "Inconnu",
            purchasePrice: bVal.purchasePrice,
            details: `Présent dans Prix d'Achat mais absent du fichier Vente/Stock`
          });
        });
      }
    });

    // Summarize totals
    const totalStockValuePurchase = matched.reduce((sum, item) => sum + item.stockValuePurchase, 0);
    const totalStockValueSale = matched.reduce((sum, item) => sum + item.stockValueSale, 0);
    const totalPotentialMargin = totalStockValueSale - totalStockValuePurchase;

    const reportData = {
      matched,
      unmatchedA,
      unmatchedB,
      duplicates: [...duplicatesA, ...duplicatesB],
      totals: {
        totalStockValuePurchase,
        totalStockValueSale,
        totalPotentialMargin,
        totalTreated: processedRowsA + processedRowsB,
        totalFound: matched.length,
        totalNotFound: unmatchedA.length + unmatchedB.length,
        totalDuplicates: duplicatesA.length + duplicatesB.length
      }
    };

    setResults(reportData);
    
    // Save report to database
    storage.create('reports/saved', {
      type: 'stock-valuation',
      storeId: typeof window !== 'undefined' ? (localStorage.getItem('selectedStore') || 'all') : 'all',
      fileAName: fileA?.name || 'Fichier A',
      fileBName: fileB?.name || 'Fichier B',
      data: reportData
    }).then(() => {
      // Reload metadata
      loadSavedReport();
    }).catch(err => {
      console.error("Erreur lors de la sauvegarde du rapport :", err);
    });

    setCurrentPage(1);
    setLoading(false);
  };

  const handleExport = () => {
    if (!results || results.matched.length === 0) return;

    const headers = [
      { key: 'reference', label: 'Référence' },
      { key: 'article', label: 'Article' },
      { key: 'stock', label: 'Stock' },
      { key: 'purchasePrice', label: 'Prix d\'achat' },
      { key: 'sellingPrice', label: 'Prix de vente' },
      { key: 'stockValuePurchase', label: 'Valeur stock achat' },
      { key: 'stockValueSale', label: 'Valeur stock vente' }
    ];

    const dataToExport = results.matched.map(item => ({
      reference: item.reference,
      article: item.article,
      stock: item.stock,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      stockValuePurchase: item.stockValuePurchase,
      stockValueSale: item.stockValueSale
    }));

    // Add summary row at the end
    const summary = [
      [], // Empty separation row
      ["TOTAUX", "", "", "", "", results.totals.totalStockValuePurchase, results.totals.totalStockValueSale],
      ["MARGE POTENTIELLE TOTALE", "", "", "", "", "", results.totals.totalPotentialMargin]
    ];

    exportToExcel(dataToExport, headers, `rapport_valorisation_stock_${new Date().toISOString().split('T')[0]}`, {
      title: "RAPPORT DE VALORISATION DU STOCK",
      companyName: settings?.companyName || "NS AUTO",
      period: `Rapprochement généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
      summary
    });
  };

  const resetAll = async () => {
    if (confirm("Voulez-vous vraiment réinitialiser ce rapport ? Cela le supprimera également pour tous les autres utilisateurs.")) {
      try {
        const storeId = typeof window !== 'undefined' ? (localStorage.getItem('selectedStore') || 'all') : 'all';
        const response = await fetch(`/api/reports/saved?type=stock-valuation&storeId=${storeId}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          setFileA(null);
          setFileB(null);
          setFileAData([]);
          setFileBData([]);
          setFileAError('');
          setFileBError('');
          setResults(null);
          setSearchTerm('');
          setReportMeta(null);
        } else {
          alert("Erreur lors de la suppression du rapport.");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur de connexion au serveur.");
      }
    }
  };

  // Filter matched items based on search term
  const getFilteredMatched = () => {
    if (!results) return [];
    return results.matched.filter(item => 
      item.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.article.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const filteredMatched = getFilteredMatched();
  const paginatedMatched = filteredMatched.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredMatched.length / itemsPerPage) || 1;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Rapports et Analyses</h1>
          <p>Suivez les indicateurs clés de votre activité</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="toolbar" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        <Link href="/reports" className={`nav-item ${pathname === '/reports' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Coins size={18} /> Financiers
        </Link>
        <Link href="/reports/stock" className={`nav-item ${pathname === '/reports/stock' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Package size={18} /> Mouvements de Stock
        </Link>
        <Link href="/reports/client" className={`nav-item ${pathname === '/reports/client' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Info size={18} /> Bilan par Client
        </Link>
        <Link href="/reports/top-articles" className={`nav-item ${pathname === '/reports/top-articles' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <TrendingUp size={18} /> Top Articles / Client
        </Link>
        <Link href="/reports/dead-stock" className={`nav-item ${pathname === '/reports/dead-stock' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Info size={18} /> Articles Dormants
        </Link>
        <Link href="/reports/stock-valuation" className={`nav-item ${pathname === '/reports/stock-valuation' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <FileSpreadsheet size={18} /> Valorisation de Stock
        </Link>
        <Link href="/reports/profitability" className={`nav-item ${pathname === '/reports/profitability' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <TrendingUp size={18} /> Analyse Rentabilité
        </Link>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {!results ? (
          <div className="content-card" style={{ padding: '2.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileSpreadsheet className="text-primary" /> Rapprochement & Valorisation de Stock
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '800px' }}>
              Importez la liste des articles avec prix de vente et stock disponible (Fichier A) et la liste des articles avec prix d'achat (Fichier B).
              Le système effectuera un rapprochement automatique par Référence (insensible aux tirets, espaces ou minuscules)
              et générera la valorisation complète.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
              {/* File A Upload */}
              <div style={{
                border: fileAError ? '2px dashed var(--danger)' : '2px dashed var(--border)',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: fileAError ? 'rgba(239, 68, 68, 0.05)' : fileA ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                position: 'relative'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: fileAError ? 'rgba(239, 68, 68, 0.15)' : fileA ? 'var(--success-light)' : 'var(--bg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: fileAError ? 'var(--danger)' : fileA ? 'var(--success)' : 'var(--text-muted)'
                }}>
                  {fileAError ? <AlertTriangle size={24} /> : fileA ? <CheckCircle2 size={24} /> : <Upload size={24} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 4px 0' }}>Fichier A : Prix de vente et stock disponible</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    Doit contenir : Référence, Désignation, Stock disponible, Prix de vente
                  </p>
                </div>
                {fileA && !fileAError && (
                  <div className="badge badge-success" style={{ fontSize: '0.8rem' }}>
                    {fileA.name} ({fileAData.length} lignes)
                  </div>
                )}
                {fileAError && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem', zIndex: 2 }}>
                    <AlertTriangle size={16} /> {fileAError}
                  </div>
                )}
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={(e) => handleFileChange(e, 'A')}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }} 
                />
              </div>

              {/* File B Upload */}
              <div style={{
                border: fileBError ? '2px dashed var(--danger)' : '2px dashed var(--border)',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: fileBError ? 'rgba(239, 68, 68, 0.05)' : fileB ? 'rgba(34, 197, 94, 0.05)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                position: 'relative'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: fileBError ? 'rgba(239, 68, 68, 0.15)' : fileB ? 'var(--success-light)' : 'var(--bg-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: fileBError ? 'var(--danger)' : fileB ? 'var(--success)' : 'var(--text-muted)'
                }}>
                  {fileBError ? <AlertTriangle size={24} /> : fileB ? <CheckCircle2 size={24} /> : <Upload size={24} />}
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', margin: '0 0 4px 0' }}>Fichier B : Liste des prix d'achat</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    Doit contenir : Référence, Désignation, Prix d'achat
                  </p>
                </div>
                {fileB && !fileBError && (
                  <div className="badge badge-success" style={{ fontSize: '0.8rem' }}>
                    {fileB.name} ({fileBData.length} lignes)
                  </div>
                )}
                {fileBError && (
                  <div style={{ color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '0.5rem', zIndex: 2 }}>
                    <AlertTriangle size={16} /> {fileBError}
                  </div>
                )}
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={(e) => handleFileChange(e, 'B')}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                className="btn btn-primary btn-lg" 
                onClick={handleProcess}
                disabled={loading || !fileA || !fileB || fileAError || fileBError}
                style={{ padding: '0.75rem 2.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                {loading ? "Traitement en cours..." : "Lancer le rapprochement"}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Action Bar */}
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" onClick={resetAll}>
                  Importer d'autres fichiers
                </button>
              </div>

              <button className="btn btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={18} /> Exporter le rapport Excel
              </button>
            </div>

            {reportMeta && (
              <div style={{
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                padding: '0.75rem 1.25rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                fontSize: '0.85rem',
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem',
                color: 'var(--text-muted)'
              }}>
                <div>
                  <strong>Fichiers sources :</strong> {reportMeta.fileAName} et {reportMeta.fileBName}
                </div>
                <div>
                  Généré par <strong>{reportMeta.generatedBy}</strong> le {new Date(reportMeta.updatedAt).toLocaleString('fr-FR')}
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', marginBottom: '2rem' }}>
              <div className="stat-card stat-card-premium bg-gradient-blue">
                <div className="stat-icon-bg"><Package size={48} /></div>
                <div className="stat-label">Valeur Stock à l'Achat</div>
                <div className="stat-value">{formatPrice(results.totals.totalStockValuePurchase)} FCFA</div>
                <div className="card-trend"><span>Basé sur le prix d'achat</span></div>
              </div>

              <div className="stat-card stat-card-premium bg-gradient-green">
                <div className="stat-icon-bg"><Coins size={48} /></div>
                <div className="stat-label">Valeur Stock à la Vente</div>
                <div className="stat-value">{formatPrice(results.totals.totalStockValueSale)} FCFA</div>
                <div className="card-trend"><span>Basé sur le prix de vente</span></div>
              </div>

              <div className="stat-card stat-card-premium bg-gradient-purple">
                <div className="stat-icon-bg"><TrendingUp size={48} /></div>
                <div className="stat-label">Marge Potentielle Globale</div>
                <div className="stat-value">{formatPrice(results.totals.totalPotentialMargin)} FCFA</div>
                <div className="card-trend"><span>Marge théorique sur stock</span></div>
              </div>
            </div>

            {/* Treatment Summary Alert */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              backgroundColor: 'var(--bg-muted)',
              padding: '1.25rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              marginBottom: '2rem'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lignes Traitées</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '4px' }}>{results.totals.totalTreated}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Articles Rapprochés</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '4px' }}>{results.totals.totalFound}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Écarts / Non Trouvés</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: results.totals.totalNotFound > 0 ? 'var(--danger)' : 'inherit', marginTop: '4px' }}>
                  {results.totals.totalNotFound}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doublons Références</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: results.totals.totalDuplicates > 0 ? 'var(--warning)' : 'inherit', marginTop: '4px' }}>
                  {results.totals.totalDuplicates}
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="content-card">
              {/* Internal Tabs */}
              <div className="toolbar" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0', marginBottom: '1.5rem', overflowX: 'auto' }}>
                <button 
                  className={`nav-item ${activeTab === 'matched' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('matched'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'matched' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Articles Trouvés / Rapprochés ({filteredMatched.length})
                </button>
                <button 
                  className={`nav-item ${activeTab === 'unmatchedA' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('unmatchedA'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'unmatchedA' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Sans Prix d'Achat (Fichier B) ({results.unmatchedA.length})
                </button>
                <button 
                  className={`nav-item ${activeTab === 'unmatchedB' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('unmatchedB'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'unmatchedB' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Absents du Fichier A (Ventes/Stock) ({results.unmatchedB.length})
                </button>
                <button 
                  className={`nav-item ${activeTab === 'duplicates' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('duplicates'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'duplicates' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Doublons ({results.duplicates.length})
                </button>
              </div>

              {/* SEARCH BAR (Only for matched tab) */}
              {activeTab === 'matched' && (
                <div className="search-input-wrapper" style={{ marginBottom: '1.5rem', maxWidth: '400px' }}>
                  <Search size={18} className="search-icon" />
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Rechercher par référence ou article..." 
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              )}

              {/* TABLES */}
              {activeTab === 'matched' && (
                <>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Référence</th>
                          <th>Article</th>
                          <th style={{ textAlign: 'center' }}>Stock</th>
                          <th style={{ textAlign: 'right' }}>Prix Achat</th>
                          <th style={{ textAlign: 'right' }}>Prix Vente</th>
                          <th style={{ textAlign: 'right' }}>Valeur Achat</th>
                          <th style={{ textAlign: 'right' }}>Valeur Vente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMatched.length === 0 ? (
                          <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Aucun article trouvé.</td></tr>
                        ) : (
                          paginatedMatched.map((item, index) => (
                            <tr key={index}>
                              <td style={{ fontWeight: '600' }}>{item.reference}</td>
                              <td>{item.article}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge ${item.stock <= 0 ? 'badge-danger' : item.stock <= 5 ? 'badge-warning' : 'badge-primary'}`}>
                                  {item.stock}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.purchasePrice)}</td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.sellingPrice)}</td>
                              <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatPrice(item.stockValuePurchase)}</td>
                              <td style={{ textAlign: 'right', fontWeight: '500', color: 'var(--success)' }}>{formatPrice(item.stockValueSale)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* PAGINATION */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Affichage de {((currentPage - 1) * itemsPerPage) + 1} à {Math.min(currentPage * itemsPerPage, filteredMatched.length)} sur {filteredMatched.length} articles
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                        >
                          Précédent
                        </button>
                        <span style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: 'bold' }}>
                          Page {currentPage} sur {totalPages}
                        </span>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                          disabled={currentPage === totalPages}
                        >
                          Suivant
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeTab === 'unmatchedA' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(var(--danger-rgb), 0.05)', borderRadius: '6px', borderLeft: '4px solid var(--danger)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <AlertTriangle className="text-danger" size={20} />
                    <span style={{ fontSize: '0.9rem' }}>
                      Ces articles sont répertoriés dans votre fichier de ventes et stocks (Fichier A) mais aucun prix d'achat n'a été trouvé dans le Fichier B. Ils sont exclus de la valorisation d'achat (valorisés à 0).
                    </span>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Référence</th>
                          <th>Article proposé</th>
                          <th style={{ textAlign: 'center' }}>Stock</th>
                          <th style={{ textAlign: 'right' }}>Prix de vente</th>
                          <th>Statut / Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.unmatchedA.length === 0 ? (
                          <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Aucun écart détecté.</td></tr>
                        ) : (
                          results.unmatchedA.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600' }}>{item.reference}</td>
                              <td>{item.article}</td>
                              <td style={{ textAlign: 'center' }}>{item.stock}</td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.sellingPrice)}</td>
                              <td><span className="badge badge-warning">Prix Achat Inexistant</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'unmatchedB' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(var(--danger-rgb), 0.05)', borderRadius: '6px', borderLeft: '4px solid var(--danger)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <AlertTriangle className="text-danger" size={20} />
                    <span style={{ fontSize: '0.9rem' }}>
                      Ces articles possèdent un prix d'achat (Fichier B) mais sont absents du fichier principal de ventes et stock (Fichier A). Ils n'ont donc pas de stock disponible associé.
                    </span>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Référence</th>
                          <th>Article proposé</th>
                          <th style={{ textAlign: 'right' }}>Prix d'achat</th>
                          <th>Statut / Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.unmatchedB.length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Aucun écart détecté.</td></tr>
                        ) : (
                          results.unmatchedB.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600' }}>{item.reference}</td>
                              <td>{item.article}</td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.purchasePrice)}</td>
                              <td><span className="badge badge-danger">Absent du Fichier Ventes/Stock</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'duplicates' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: 'rgba(var(--warning-rgb), 0.05)', borderRadius: '6px', borderLeft: '4px solid var(--warning)', display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <AlertCircle className="text-warning" size={20} />
                    <span style={{ fontSize: '0.9rem' }}>
                      Les références suivantes apparaissent plusieurs fois dans vos fichiers. Le système a automatiquement regroupé et cumulé les stocks pour éviter les pertes d'information.
                    </span>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Référence</th>
                          <th>Désignation</th>
                          <th>Fichier source</th>
                          <th>Info traitement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.duplicates.length === 0 ? (
                          <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Aucun doublon détecté.</td></tr>
                        ) : (
                          results.duplicates.map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ fontWeight: '600' }}>{item.ref}</td>
                              <td>{item.designation}</td>
                              <td><span className="badge badge-warning">{item.details}</span></td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                Correspondance trouvée sur la clé normalisée <code>{item.normalizedRef}</code>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
