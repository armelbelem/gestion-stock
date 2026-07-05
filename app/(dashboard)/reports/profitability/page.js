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

export default function ProfitabilityPage() {
  const pathname = usePathname();
  const [settings, setSettings] = useState(null);
  
  // File states
  const [fileA, setFileA] = useState(null); // Sales file
  const [fileB, setFileB] = useState(null); // Purchase prices reference file
  const [fileAData, setFileAData] = useState([]);
  const [fileBData, setFileBData] = useState([]);
  const [fileAError, setFileAError] = useState('');
  const [fileBError, setFileBError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Rapprochement results
  const [results, setResults] = useState(null);
  const [reportMeta, setReportMeta] = useState(null);
  const [activeTab, setActiveTab] = useState('matched'); // matched, unmatchedA, unmatchedB, duplicates, anomalies
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
      const response = await storage.get('reports/saved?type=profitability');
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
        const qtySoldPatterns = [/quantité.*vendue/i, /qte.*vendue/i, /quantite.*vendue/i, /vendue/i, /total.*vendu/i, /vendu/i, /qté/i, /qte/i, /quantité/i, /quantite/i];

        if (fileType === 'A') {
          setFileAData(rows);
          if (rows.length > 0) {
            const firstRow = rows[0];
            const missing = [];
            if (!findColumnKey(firstRow, refPatterns)) missing.push("Référence");
            if (!findColumnKey(firstRow, designationPatterns)) missing.push("Désignation / Article");
            if (!findColumnKey(firstRow, qtySoldPatterns)) missing.push("Quantité vendue");
            if (!findColumnKey(firstRow, salePricePatterns)) missing.push("Prix de vente unitaire");
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
            if (!findColumnKey(firstRow, purchasePricePatterns)) missing.push("Prix d'achat unitaire");
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

  const findColumnKey = (row, patterns) => {
    if (!row) return null;
    const keys = Object.keys(row);
    for (const pattern of patterns) {
      const foundKey = keys.find(k => pattern.test(String(k).trim().toLowerCase()));
      if (foundKey) return foundKey;
    }
    return null;
  };

  // Process profitability mapping
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
    const qtySoldPatterns = [/quantité.*vendue/i, /qte.*vendue/i, /quantite.*vendue/i, /vendue/i, /total.*vendu/i, /vendu/i, /qté/i, /qte/i, /quantité/i, /quantite/i];

    const listA = [];
    const duplicatesA = [];
    const seenA = new Map();
    const anomalies = [];
    let processedRowsA = 0;
    let errorsCorrectedOrIgnored = 0;

    // Read File A (Sales)
    fileAData.forEach((row, index) => {
      if (Object.keys(row).length === 0) return;

      const refKey = findColumnKey(row, refPatterns);
      const desKey = findColumnKey(row, designationPatterns);
      const saleKey = findColumnKey(row, salePricePatterns);
      const qtyKey = findColumnKey(row, qtySoldPatterns);

      const rawRef = refKey ? row[refKey] : null;
      if (!rawRef) {
        anomalies.push({
          row: index + 2,
          file: 'Fichier A (Ventes)',
          type: 'Erreur',
          details: 'Référence manquante ou vide, ligne ignorée.'
        });
        errorsCorrectedOrIgnored++;
        return;
      }

      processedRowsA++;
      const normRef = normalizeRef(rawRef);
      const designation = desKey ? row[desKey] : '';
      
      // Parse selling price
      let sellingPrice = 0;
      if (saleKey) {
        const rawPV = row[saleKey];
        const val = String(rawPV).replace(/[^0-9.,]/g, '').replace(',', '.');
        sellingPrice = parseFloat(val) || 0;
        if (isNaN(parseFloat(val))) {
          anomalies.push({
            row: index + 2,
            file: 'Fichier A (Ventes)',
            type: 'Correction',
            details: `Prix de vente non numérique ("${rawPV}"), remplacé par 0.`
          });
          errorsCorrectedOrIgnored++;
        }
      }

      // Parse quantity
      let quantity = 0;
      if (qtyKey) {
        const rawQty = row[qtyKey];
        const val = String(rawQty).replace(/[^0-9.-]/g, '');
        quantity = parseFloat(val) || 0;
        if (isNaN(parseFloat(val))) {
          anomalies.push({
            row: index + 2,
            file: 'Fichier A (Ventes)',
            type: 'Correction',
            details: `Quantité vendue non numérique ("${rawQty}"), remplacée par 0.`
          });
          errorsCorrectedOrIgnored++;
        }
      }

      const entry = {
        originalRef: String(rawRef).trim(),
        normalizedRef: normRef,
        designation: String(designation).trim(),
        sellingPrice,
        quantity,
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
      if (!rawRef) {
        anomalies.push({
          row: index + 2,
          file: 'Fichier B (Prix d\'Achat)',
          type: 'Erreur',
          details: 'Référence manquante ou vide, ligne ignorée.'
        });
        errorsCorrectedOrIgnored++;
        return;
      }

      processedRowsB++;
      const normRef = normalizeRef(rawRef);
      const designation = desKey ? row[desKey] : '';

      // Parse purchase price
      let purchasePrice = 0;
      if (purchaseKey) {
        const rawPA = row[purchaseKey];
        const val = String(rawPA).replace(/[^0-9.,]/g, '').replace(',', '.');
        purchasePrice = parseFloat(val) || 0;
        if (isNaN(parseFloat(val))) {
          anomalies.push({
            row: index + 2,
            file: 'Fichier B (Prix d\'Achat)',
            type: 'Correction',
            details: `Prix d'achat non numérique ("${rawPA}"), remplacé par 0.`
          });
          errorsCorrectedOrIgnored++;
        }
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

    // Group lists by normalized reference
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

    const matched = [];
    const unmatchedA = []; // In A but not in B
    const unmatchedB = []; // In B but not in A

    // Iterate through all unique references in groupsA
    groupsA.forEach((itemsA, normRef) => {
      const itemsB = groupsB.get(normRef) || [];
      const maxLen = Math.max(itemsA.length, itemsB.length);

      for (let i = 0; i < maxLen; i++) {
        if (i < itemsA.length && i < itemsB.length) {
          const aVal = itemsA[i];
          const bVal = itemsB[i];
          // Prioritize designation from File B (Referentiel des prix d'achat)
          const designation = bVal.designation || aVal.designation || "Article Sans Nom";
          const quantity = aVal.quantity;
          const purchasePrice = bVal.purchasePrice;
          const sellingPrice = aVal.sellingPrice;

          const revenue = quantity * sellingPrice;
          const cost = quantity * purchasePrice;
          const margin = revenue - cost;
          const marginRate = revenue > 0 ? (margin / revenue) * 100 : 0;

          matched.push({
            reference: bVal.originalRef || aVal.originalRef,
            normalizedRef: normRef,
            article: designation,
            quantity,
            purchasePrice,
            sellingPrice,
            cost,
            revenue,
            margin,
            marginRate
          });
        } else if (i < itemsA.length) {
          const aVal = itemsA[i];
          unmatchedA.push({
            reference: aVal.originalRef,
            normalizedRef: normRef,
            article: aVal.designation || "Inconnu",
            quantity: aVal.quantity,
            sellingPrice: aVal.sellingPrice,
            details: `Présent dans les ventes mais absent du fichier prix d'achat`
          });
          anomalies.push({
            row: aVal.rowNumber,
            file: 'Fichier A (Ventes)',
            type: 'Écart',
            details: `Référence "${aVal.originalRef}" absente du fichier des prix d'achat.`
          });
        } else {
          const bVal = itemsB[i];
          unmatchedB.push({
            reference: bVal.originalRef,
            normalizedRef: normRef,
            article: bVal.designation || "Inconnu",
            purchasePrice: bVal.purchasePrice,
            details: `Présent dans les prix d'achat mais absent du fichier ventes`
          });
          anomalies.push({
            row: bVal.rowNumber,
            file: 'Fichier B (Prix d\'Achat)',
            type: 'Écart',
            details: `Référence "${bVal.originalRef}" absente du fichier des ventes.`
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
            details: `Présent dans les prix d'achat mais absent du fichier ventes`
          });
          anomalies.push({
            row: bVal.rowNumber,
            file: 'Fichier B (Prix d\'Achat)',
            type: 'Écart',
            details: `Référence "${bVal.originalRef}" absente du fichier des ventes.`
          });
        });
      }
    });

    // Global calculations
    const totalRevenue = matched.reduce((sum, item) => sum + item.revenue, 0);
    const totalCost = matched.reduce((sum, item) => sum + item.cost, 0);
    const totalMargin = totalRevenue - totalCost;
    const globalMarginRate = totalRevenue > 0 ? (totalMargin / totalRevenue) * 100 : 0;

    const reportData = {
      matched,
      unmatchedA,
      unmatchedB,
      duplicates: [...duplicatesA, ...duplicatesB],
      anomalies: anomalies.sort((a, b) => a.row - b.row),
      totals: {
        totalRevenue,
        totalCost,
        totalMargin,
        globalMarginRate,
        totalTreated: processedRowsA + processedRowsB,
        totalFound: matched.length,
        totalNotFound: unmatchedA.length + unmatchedB.length,
        totalDuplicates: duplicatesA.length + duplicatesB.length,
        errorsCorrectedOrIgnored
      }
    };

    setResults(reportData);
    
    // Save report to database
    storage.create('reports/saved', {
      type: 'profitability',
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
      { key: 'quantity', label: 'Quantité vendue' },
      { key: 'purchasePrice', label: 'Prix achat unitaire' },
      { key: 'sellingPrice', label: 'Prix vente unitaire' },
      { key: 'cost', label: 'Coût achat total' },
      { key: 'revenue', label: 'Chiffre d\'affaires' },
      { key: 'margin', label: 'Marge bénéficiaire' },
      { key: 'marginRate', label: 'Taux de marge (%)' }
    ];

    const dataToExport = results.matched.map(item => ({
      reference: item.reference,
      article: item.article,
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      sellingPrice: item.sellingPrice,
      cost: item.cost,
      revenue: item.revenue,
      margin: item.margin,
      marginRate: `${item.marginRate.toFixed(2)} %`
    }));

    // Add summary row at the end
    const summary = [
      [],
      ["TOTAUX", "", "", "", "", results.totals.totalCost, results.totals.totalRevenue, results.totals.totalMargin, `${results.totals.globalMarginRate.toFixed(2)} %`],
      ["Nombre total d'articles analysés", results.totals.totalFound, "", "", "", "", "", "", ""]
    ];

    exportToExcel(dataToExport, headers, `rapport_rentabilite_marge_${new Date().toISOString().split('T')[0]}`, {
      title: "RAPPORT DE RENTABILITÉ ET DE MARGE BÉNÉFICIAIRE",
      companyName: settings?.companyName || "NS AUTO",
      period: `Analyse générée le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`,
      summary
    });
  };

  const resetAll = async () => {
    if (confirm("Voulez-vous vraiment réinitialiser ce rapport ? Cela le supprimera également pour tous les autres utilisateurs.")) {
      try {
        const storeId = typeof window !== 'undefined' ? (localStorage.getItem('selectedStore') || 'all') : 'all';
        const response = await fetch(`/api/reports/saved?type=profitability&storeId=${storeId}`, {
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
          <p>Rentabilité globale et performance par article</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="toolbar" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0', overflowX: 'auto' }}>
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
              <TrendingUp className="text-primary" /> Analyse de Rentabilité et de Marge Bénéficiaire
            </h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', maxWidth: '800px' }}>
              Importez le bilan de consommation/ventes (Fichier A) contenant les quantités vendues et prix de vente, et le référentiel des prix d'achat (Fichier B).
              Le système calculera automatiquement le chiffre d'affaires, le coût total d'achat, la marge dégagée et le taux de marge de chaque article.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', marginBottom: '2.5rem' }}>
              {/* File A Upload (Sales) */}
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
                  <h3 style={{ fontSize: '1rem', margin: '0 0 4px 0' }}>Fichier A : Bilan de consommation (Ventes)</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    Doit contenir : Référence, Désignation, Quantité totale vendue, Prix de vente unitaire
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

              {/* File B Upload (Purchase prices) */}
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
                  <h3 style={{ fontSize: '1rem', margin: '0 0 4px 0' }}>Fichier B : Référentiel des prix d'achat</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    Doit contenir : Référence, Désignation, Prix d'achat unitaire
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
                {loading ? "Calcul en cours..." : "Générer le rapport de rentabilité"}
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Action Bar */}
            <div className="toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={resetAll}>
                Importer d'autres fichiers
              </button>

              <button className="btn btn-primary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={18} /> Exporter le bilan de rentabilité (.xlsx)
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
                <div className="stat-icon-bg"><Coins size={48} /></div>
                <div className="stat-label">Chiffre d'affaires global</div>
                <div className="stat-value">{formatPrice(results.totals.totalRevenue)} FCFA</div>
                <div className="card-trend"><span>Total des ventes rapprochées</span></div>
              </div>

              <div className="stat-card stat-card-premium bg-gradient-purple">
                <div className="stat-icon-bg"><Package size={48} /></div>
                <div className="stat-label">Coût total d'achat</div>
                <div className="stat-value">{formatPrice(results.totals.totalCost)} FCFA</div>
                <div className="card-trend"><span>Coût d'achat total des ventes</span></div>
              </div>

              <div className="stat-card stat-card-premium bg-gradient-green">
                <div className="stat-icon-bg"><TrendingUp size={48} /></div>
                <div className="stat-label">Marge bénéficiaire totale</div>
                <div className="stat-value">{formatPrice(results.totals.totalMargin)} FCFA</div>
                <div className="card-trend" style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 'bold' }}>
                  <span>Taux de marge global : {results.totals.globalMarginRate.toFixed(2)} %</span>
                </div>
              </div>
            </div>

            {/* Summary details */}
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
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lignes Analysées</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', marginTop: '4px' }}>{results.totals.totalTreated}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Références Communes</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success)', marginTop: '4px' }}>{results.totals.totalFound}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Non Trouvées / Écarts</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: results.totals.totalNotFound > 0 ? 'var(--danger)' : 'inherit', marginTop: '4px' }}>
                  {results.totals.totalNotFound}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Doublons Détectés</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: results.totals.totalDuplicates > 0 ? 'var(--warning)' : 'inherit', marginTop: '4px' }}>
                  {results.totals.totalDuplicates}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Erreurs Ignorées / Corrigées</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)', marginTop: '4px' }}>
                  {results.totals.errorsCorrectedOrIgnored}
                </div>
              </div>
            </div>

            {/* Result Tabs */}
            <div className="content-card">
              <div className="toolbar" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0', marginBottom: '1.5rem', overflowX: 'auto' }}>
                <button 
                  className={`nav-item ${activeTab === 'matched' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('matched'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'matched' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Bilan de Rentabilité ({filteredMatched.length})
                </button>
                <button 
                  className={`nav-item ${activeTab === 'unmatchedA' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('unmatchedA'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'unmatchedA' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Ventes Sans Prix d'Achat ({results.unmatchedA.length})
                </button>
                <button 
                  className={`nav-item ${activeTab === 'unmatchedB' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('unmatchedB'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'unmatchedB' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Prix d'Achat Sans Ventes ({results.unmatchedB.length})
                </button>
                <button 
                  className={`nav-item ${activeTab === 'duplicates' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('duplicates'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'duplicates' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Doublons ({results.duplicates.length})
                </button>
                <button 
                  className={`nav-item ${activeTab === 'anomalies' ? 'active' : ''}`}
                  onClick={() => { setActiveTab('anomalies'); setCurrentPage(1); }}
                  style={{ padding: '0.75rem 1.25rem', borderBottom: activeTab === 'anomalies' ? '2px solid var(--primary)' : 'none', borderRadius: 0, marginBottom: '-1px' }}
                >
                  Journal d'Anomalies ({results.anomalies.length})
                </button>
              </div>

              {/* SEARCH BAR */}
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

              {/* Matched Data Table */}
              {activeTab === 'matched' && (
                <>
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Référence</th>
                          <th>Article (Nom du Référentiel B)</th>
                          <th style={{ textAlign: 'center' }}>Quantité</th>
                          <th style={{ textAlign: 'right' }}>Prix Achat Unit.</th>
                          <th style={{ textAlign: 'right' }}>Prix Vente Unit.</th>
                          <th style={{ textAlign: 'right' }}>Coût Total</th>
                          <th style={{ textAlign: 'right' }}>CA Réalisé</th>
                          <th style={{ textAlign: 'right' }}>Marge</th>
                          <th style={{ textAlign: 'right' }}>Taux Marge (%)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMatched.length === 0 ? (
                          <tr><td colSpan="9" style={{ textAlign: 'center', padding: '2rem' }}>Aucun article trouvé.</td></tr>
                        ) : (
                          paginatedMatched.map((item, index) => (
                            <tr key={index}>
                              <td style={{ fontWeight: '600' }}>{item.reference}</td>
                              <td>{item.article}</td>
                              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.purchasePrice)}</td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.sellingPrice)}</td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.cost)}</td>
                              <td style={{ textAlign: 'right' }}>{formatPrice(item.revenue)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 'bold', color: item.margin >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {formatPrice(item.margin)}
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: '500', color: item.marginRate >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                                {item.marginRate.toFixed(2)} %
                              </td>
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

              {/* Sales but no Purchase Price Table */}
              {activeTab === 'unmatchedA' && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Référence</th>
                        <th>Article (Fichier Ventes)</th>
                        <th style={{ textAlign: 'center' }}>Quantité Vendue</th>
                        <th style={{ textAlign: 'right' }}>Prix Vente Unit.</th>
                        <th>Détails de l'anomalie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.unmatchedA.length === 0 ? (
                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>Aucun écart trouvé.</td></tr>
                      ) : (
                        results.unmatchedA.map((item, index) => (
                          <tr key={index}>
                            <td style={{ fontWeight: '600', color: 'var(--danger)' }}>{item.reference}</td>
                            <td>{item.article}</td>
                            <td style={{ textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ textAlign: 'right' }}>{formatPrice(item.sellingPrice)}</td>
                            <td style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{item.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Purchase Price but no Sales Table */}
              {activeTab === 'unmatchedB' && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Référence</th>
                        <th>Article (Fichier Prix d'Achat)</th>
                        <th style={{ textAlign: 'right' }}>Prix Achat Unit.</th>
                        <th>Détails de l'anomalie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.unmatchedB.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Aucun écart trouvé.</td></tr>
                      ) : (
                        results.unmatchedB.map((item, index) => (
                          <tr key={index}>
                            <td style={{ fontWeight: '600' }}>{item.reference}</td>
                            <td>{item.article}</td>
                            <td style={{ textAlign: 'right' }}>{formatPrice(item.purchasePrice)}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{item.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Duplicates Table */}
              {activeTab === 'duplicates' && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Référence</th>
                        <th>Article</th>
                        <th>Source et Emplacement</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.duplicates.length === 0 ? (
                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '2rem' }}>Aucun doublon détecté.</td></tr>
                      ) : (
                        results.duplicates.map((item, index) => (
                          <tr key={index}>
                            <td style={{ fontWeight: '600', color: 'var(--warning)' }}>{item.ref}</td>
                            <td>{item.designation}</td>
                            <td style={{ color: 'var(--warning)', fontSize: '0.85rem' }}>{item.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Anomalies Journal Table */}
              {activeTab === 'anomalies' && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: '80px', textAlign: 'center' }}>Ligne</th>
                        <th>Source / Fichier</th>
                        <th style={{ width: '120px' }}>Type</th>
                        <th>Message / Renseignements</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.anomalies.length === 0 ? (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>Aucune anomalie enregistrée.</td></tr>
                      ) : (
                        results.anomalies.map((item, index) => (
                          <tr key={index}>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.row}</td>
                            <td>{item.file}</td>
                            <td>
                              <span className={`badge ${item.type === 'Erreur' ? 'badge-danger' : item.type === 'Correction' ? 'badge-warning' : 'badge-primary'}`}>
                                {item.type}
                              </span>
                            </td>
                            <td>{item.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
