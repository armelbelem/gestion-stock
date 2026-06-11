'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../../lib/storage';
import { User, Calendar, FileText, Printer, ChevronLeft, Package, Coins, Download, TrendingUp, Clock, X, FileSpreadsheet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { exportToExcel } from '../../../utils/excelExport';
import AlertModal from '../../../components/AlertModal';

export default function ClientReportPage() {
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printData, setPrintData] = useState(null);
  const [settings, setSettings] = useState(null);
  const [partners, setPartners] = useState([]);
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const [printHistory, setPrintHistory] = useState([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const pathname = usePathname();

  const formatPrice = (val) => {
    if (val === undefined || val === null) return '0';
    const num = Number(val) || 0;
    if (settings?.roundAmounts !== 0 && settings?.roundAmounts !== false) {
      return Math.trunc(num).toLocaleString();
    }
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  useEffect(() => {
    const loadClients = async () => {
      const c = await storage.get('clients');
      setClients(c);
    };
    loadClients();
    loadSettings();
    const loadPartners = async () => {
      const p = await storage.get('contract-partners');
      setPartners(p || []);
    };
    loadPartners();

    const loadHistory = async () => {
      try {
        const h = await storage.get('print-history-bilan');
        if (h && Array.isArray(h)) {
          const mapped = h.map(item => ({
            id: item.id,
            date: item.created_at,
            clientId: item.client_id,
            clientName: item.client_name,
            period: item.period,
            totalAmount: item.total_amount,
            printData: typeof item.print_data === 'string' ? JSON.parse(item.print_data) : item.print_data
          }));
          setPrintHistory(mapped);
        }
      } catch(e) { console.error('Error loading history:', e); }
    };
    loadHistory();
  }, []);


  const loadSettings = async () => {
    try {
      const s = await storage.get('settings');
      setSettings(s);
    } catch (err) { console.error(err); }
  };

  const generateReport = async () => {
    if (!selectedClientId) return;
    setLoading(true);
    setData(null); // Vider les anciennes données immédiatement
    try {
      const res = await storage.get(`reports/sales-by-client?clientId=${selectedClientId}&startDate=${startDate}&endDate=${endDate}`);
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintClick = () => {
    const defaultCompany = `${settings?.companyName || 'NS AUTO'} ${selectedClient?.clientCode ? `/ Code client : ${selectedClient.clientCode}` : ''}\n` +
      [
        settings?.address,
        settings?.rccm ? `RCCM : ${settings.rccm}` : '',
        settings?.nif ? `IFU : ${settings.nif}` : '',
        settings?.bp,
        settings?.division,
        settings?.taxSystem
      ].filter(Boolean).join('\n');

    const defaultClient = `${selectedClient?.name}\n` +
      [
        selectedClient?.address,
        selectedClient?.bp ? `BP : ${selectedClient.bp}` : '',
        selectedClient?.phone ? `Tél : ${selectedClient.phone}` : '',
        selectedClient?.rccm ? `RCCM : ${selectedClient.rccm}` : '',
        selectedClient?.nif ? `IFU : ${selectedClient.nif}` : ''
      ].filter(Boolean).join('\n');

    const defaultPeriod = `DU ${new Date(startDate).toLocaleDateString()} AU ${new Date(endDate).toLocaleDateString()}`;
    const tvaBase = (data.summary.totalGrossAmount || 0) - (data.summary.totalDiscount || 0);
    const tvaRate = tvaBase > 0 && data.summary.totalTva > 0
      ? data.summary.totalTva / tvaBase
      : 0;

    setPrintData({
      title: `BILAN DE CONSOMMATION : ${selectedClient?.name}`,
      companyDetails: defaultCompany,
      clientDetails: defaultClient,
      periodText: defaultPeriod,
      date: new Date().toISOString().split('T')[0],
      city: settings?.city || 'Ouagadougou',
      supervisorName: settings?.supervisorName || 'Guy Roland TONDE',
      supervisorTitle: settings?.supervisorTitle || 'SUPERVISEUR',
      notes: '',
      notesTitle: 'Notes / Conditions Particulières',
      colHeaders: {
        code: 'CODE',
        barcode: 'RÉFÉRENCE',
        name: 'DÉSIGNATION ARTICLE',
        unitPrice: 'P.U (FCFA)',
        qty: 'QTÉ',
        total: 'TOTAL (FCFA)'
      },
      items: JSON.parse(JSON.stringify(data.items)),
      summary: JSON.parse(JSON.stringify(data.summary)),
      tvaRate: tvaRate
    });
    setIsPrintModalOpen(true);
  };

  const updatePrintItem = (index, field, value) => {
    const newItems = [...printData.items];
    newItems[index][field] = value;
    if (field === 'unitPrice' || field === 'totalQuantity') {
      newItems[index].totalAmount = Number(newItems[index].unitPrice || 0) * Number(newItems[index].totalQuantity || 0);
    }
    recalculatePrintSummary(newItems);
  };

  const addPrintItem = () => {
    const newItems = [...printData.items, { code: '', barcode: '', name: '', unitPrice: 0, totalQuantity: 1, totalAmount: 0 }];
    recalculatePrintSummary(newItems);
  };

  const removePrintItem = (index) => {
    const newItems = printData.items.filter((_, i) => i !== index);
    recalculatePrintSummary(newItems);
  };

  const recalculatePrintSummary = (newItems) => {
    setPrintData(prev => {
      const totalQuantity = newItems.reduce((sum, item) => sum + Number(item.totalQuantity || 0), 0);
      const totalGrossAmount = newItems.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
      const totalDiscount = prev.summary.totalDiscount || 0;
      const totalTva = Math.round((totalGrossAmount - totalDiscount) * prev.tvaRate);
      const totalAmount = totalGrossAmount - totalDiscount + totalTva;
      return { ...prev, items: newItems, summary: { ...prev.summary, totalQuantity, totalGrossAmount, totalDiscount, totalTva, totalAmount } };
    });
  };

    const executePrint = async () => {
    setIsPrintModalOpen(false);
    
    try {
      const historyRecord = {
        id: Date.now().toString(),
        clientId: selectedClientId,
        clientName: selectedClient?.name,
        period: printData.periodText,
        totalAmount: printData.summary.totalAmount,
        printData: printData
      };
      
      const res = await storage.create('print-history-bilan', historyRecord);
      if (res.success) {
        const newHistoryRecord = { ...historyRecord, date: new Date().toISOString() };
        setPrintHistory(prev => [newHistoryRecord, ...prev]);
      }
    } catch(e) {
      console.error('Failed to save history to DB:', e);
    }

    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500);
  };

  const deletePrintHistory = async (id) => {
    if (!window.confirm("Voulez-vous vraiment supprimer cet historique ?")) return;
    try {
      await fetch(`/api/print-history-bilan/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      setPrintHistory(prev => prev.filter(h => h.id !== id));
    } catch (e) {
      console.error('Error deleting history', e);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const headers = [
      { key: 'code', label: 'Code' },
      { key: 'barcode', label: 'Référence' },
      { key: 'name', label: 'Article' },
      { key: 'unitPrice', label: 'Prix Unitaire' },
      { key: 'totalQuantity', label: 'Quantité Vendue' },
      { key: 'totalAmount', label: 'Montant Total' }
    ];
    const formattedItems = data.items.map(item => ({
      ...item,
      unitPrice: formatPrice(item.unitPrice),
      totalAmount: formatPrice(item.totalAmount)
    }));

    exportToExcel(
      formattedItems, 
      headers, 
      `Bilan_${selectedClient?.name}_du_${startDate}_au_${endDate}`,
      {
        title: `BILAN DE CONSOMMATION - ${selectedClient?.name}`,
        companyName: settings?.companyName || "NS AUTO",
        period: `Du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()}`,
        summary: [
          ['', '', 'TOTAL BRUT (HT)', '', data.summary.totalQuantity, `${formatPrice(data.summary.totalGrossAmount)} FCFA`],
          (() => {
            const base = (data.summary.totalGrossAmount || 0) - (data.summary.totalDiscount || 0);
            const pct = base > 0 && data.summary.totalTva > 0 ? Math.round((data.summary.totalTva / base) * 100) : 0;
            return ['', '', `MONTANT TVA (${pct}%)`, '', '', `${formatPrice(data.summary.totalTva)} FCFA`];
          })(),
          ['', '', 'TOTAL NET (TTC)', '', '', `${formatPrice(data.summary.totalAmount)} FCFA`]
        ]
      }
    );
  };
  
  const handleSettle = async () => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Régler la période ?',
      message: `Voulez-vous marquer TOUTES les consommations de ${selectedClient?.name} du ${new Date(startDate).toLocaleDateString()} au ${new Date(endDate).toLocaleDateString()} comme PAYÉES ?`,
      onConfirm: async () => {
        setAlertModal(prev => ({ ...prev, open: false }));
        setLoading(true);
        try {
          const res = await storage.create('reports/sales-by-client', {
            clientId: selectedClientId,
            startDate,
            endDate
          });
          if (res.success) {
            setAlertModal({
              open: true,
              type: 'info',
              title: 'Succès',
              message: `La période a été réglée avec succès. Total encaissé : ${res.totalSettled.toLocaleString()} FCFA.`
            });
            generateReport();
          } else {
            setAlertModal({
              open: true,
              type: 'info',
              title: 'Information',
              message: res.message || "Aucune vente à régler pour cette période."
            });
          }
        } catch (err) {
          setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
        } finally {
          setLoading(false);
        }
      }
    });
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

  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (isPrinting && data) {
    const stamp = settings?.stampImage || partners.find(p => p.stamp_image)?.stamp_image;
    const sig = settings?.signatureImage || partners.find(p => p.signature_image)?.signature_image;

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
          @page { margin: 0 !important; }
          @media print {
            .receipt-print-only { 
              width: 21cm !important; 
              min-height: 29.7cm !important; 
              padding: 0 !important; 
              margin: 0 !important; 
              position: relative !important;
              top: -60px !important;
            }
            .receipt-print-only table { border-collapse: collapse !important; width: 100% !important; }
            .receipt-print-only th, .receipt-print-only td { border: 1.5pt solid black !important; -webkit-print-color-adjust: exact !important; }
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
            .red-footer p { color: white !important; }
            .receipt-print-only td.no-print-border { border: none !important; }
            /* Règles pour la pagination */
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
            .avoid-page-break { page-break-inside: avoid; break-inside: avoid; }
          }
        `}} />
        <div style={{ padding: '0px 40px 20px 40px' }}>
          {/* Header Rebrand - Perfect Alignment */}
          <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: '32px' }}>
            {settings?.logo ? (
              <img
                src={settings?.logo}
                alt="Logo"
                style={{ maxHeight: '120px', marginRight: '2px', position: 'relative', top: '34px' }}
              />
            ) : (
              <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase', marginRight: '15px' }}>
                {settings?.companyName || 'NS AUTO'}
              </h1>
            )}
            <div style={{ flex: 1, height: '2.5pt', backgroundColor: '#b91c1c', marginBottom: '13px', WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}></div>
          </div>

        {/* Titre central */}
        <div style={{ border: '2px solid black', padding: '10px', textAlign: 'center', marginBottom: '15px', backgroundColor: '#f9f9f9' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase' }}>
            {printData?.title || `BILAN DE CONSOMMATION : ${selectedClient?.name}`}
          </h2>
        </div>

        {/* Blocs d'informations */}
        <div style={{ display: 'flex', border: '2px solid black', marginBottom: '20px' }}>
          {/* Bloc Entreprise (NS AUTO) */}
          <div style={{ flex: 1, borderRight: '2px solid black', padding: '10px', fontSize: '12px', lineHeight: '1.5' }}>
            {(printData?.companyDetails || '').split('\n').map((line, idx) => (
              idx === 0 
                ? <strong key={idx} style={{ fontSize: '14px', display: 'block', marginBottom: '5px' }}>{line}</strong> 
                : <div key={idx} style={{ marginBottom: '2px' }}>{line}</div>
            ))}
          </div>

          {/* Bloc Client */}
          <div style={{ flex: 1, padding: '10px', fontSize: '12px', lineHeight: '1.5' }}>
            {(printData?.clientDetails || '').split('\n').map((line, idx) => (
              idx === 0 
                ? <strong key={idx} style={{ fontSize: '14px', display: 'block', marginBottom: '5px' }}>{line}</strong> 
                : <div key={idx} style={{ marginBottom: '2px' }}>{line}</div>
            ))}
          </div>
        </div>

        {/* Bandeau Période */}
        <div style={{ backgroundColor: '#e0e0e0', border: '1px solid black', borderBottom: 'none', padding: '5px', textAlign: 'center', fontWeight: 'bold', fontSize: '9px' }}>
          PÉRIODE : {printData?.periodText || `DU ${new Date(startDate).toLocaleDateString()} AU ${new Date(endDate).toLocaleDateString()}`}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '8px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #000' }}>
              {printData?.hideColCode !== true && <th style={{ textAlign: 'left', padding: '4px', border: '1px solid #000' }}>{printData?.colHeaders?.code || 'CODE'}</th>}
              {printData?.hideColBarcode !== true && <th style={{ textAlign: 'left', padding: '4px', border: '1px solid #000' }}>{printData?.colHeaders?.barcode || 'RÉFÉRENCE'}</th>}
              {printData?.hideColName !== true && <th style={{ textAlign: 'left', padding: '4px', border: '1px solid #000' }}>{printData?.colHeaders?.name || 'DÉSIGNATION ARTICLE'}</th>}
              {printData?.hideColUnitPrice !== true && <th style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>{printData?.colHeaders?.unitPrice || 'P.U (FCFA)'}</th>}
              {printData?.hideColQty !== true && <th style={{ textAlign: 'center', padding: '4px', border: '1px solid #000' }}>{printData?.colHeaders?.qty || 'QTÉ'}</th>}
              {printData?.hideColTotal !== true && <th style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>{printData?.colHeaders?.total || 'TOTAL (FCFA)'}</th>}
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Calcul du colspan pour les totaux
              const numLeftCols = [printData?.hideColCode !== true, printData?.hideColBarcode !== true, printData?.hideColName !== true, printData?.hideColUnitPrice !== true].filter(Boolean).length;
              const hasQty = printData?.hideColQty !== true;
              const hasTotal = printData?.hideColTotal !== true;
              
              return (
                <React.Fragment>
                  {printData?.items?.map((item, idx) => (
                    <tr key={idx}>
                      {printData?.hideColCode !== true && <td style={{ padding: '4px', border: '1px solid #000' }}>{item.code || '-'}</td>}
                      {printData?.hideColBarcode !== true && <td style={{ padding: '4px', border: '1px solid #000' }}>{item.barcode || '-'}</td>}
                      {printData?.hideColName !== true && <td style={{ padding: '4px', border: '1px solid #000' }}>{item.name}</td>}
                      {printData?.hideColUnitPrice !== true && <td style={{ padding: '4px', border: '1px solid #000', textAlign: 'right' }}>{formatPrice(item.unitPrice)}</td>}
                      {printData?.hideColQty !== true && <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #000' }}>{item.totalQuantity}</td>}
                      {printData?.hideColTotal !== true && <td style={{ textAlign: 'right', padding: '4px', border: '1px solid #000', fontWeight: 'bold' }}>{formatPrice(item.totalAmount)}</td>}
                    </tr>
                  ))}
                  
                  {/* Totaux */}
                  <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                    {numLeftCols > 0 && <td colSpan={numLeftCols} style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>TOTAL BRUT</td>}
                    {hasQty && <td style={{ textAlign: 'center', padding: '4px', border: '1px solid #000' }}>{printData?.summary?.totalQuantity}</td>}
                    {hasTotal && <td style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>{formatPrice(printData?.summary?.totalGrossAmount)} FCFA</td>}
                  </tr>
                  
                  {printData?.summary?.totalDiscount > 0 && (
                    <tr style={{ fontWeight: 'bold' }}>
                      <td colSpan={numLeftCols + (hasQty ? 1 : 0)} style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>TOTAL REMISES</td>
                      {hasTotal && <td style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>-{formatPrice(printData?.summary?.totalDiscount)} FCFA</td>}
                    </tr>
                  )}
                  
                  {printData?.summary?.totalTva > 0 && (() => {
                    const base = (printData?.summary?.totalGrossAmount || 0) - (printData?.summary?.totalDiscount || 0);
                    const pct = base > 0 ? Math.round((printData.summary.totalTva / base) * 100) : 0;
                    return (
                      <tr style={{ fontWeight: 'bold' }}>
                        <td colSpan={numLeftCols + (hasQty ? 1 : 0)} style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>MONTANT TVA ({pct}%)</td>
                        {hasTotal && <td style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>{formatPrice(printData.summary.totalTva)} FCFA</td>}
                      </tr>
                    );
                  })()}
                  
                  <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
                    <td colSpan={numLeftCols + (hasQty ? 1 : 0)} style={{ textAlign: 'right', padding: '4px', border: '1px solid #000' }}>TOTAL NET À RÉGLER</td>
                    {hasTotal && <td style={{ textAlign: 'right', padding: '4px', border: '1px solid #000', fontSize: '14px' }}>{formatPrice(printData?.summary?.totalAmount)} FCFA</td>}
                  </tr>
                  {printData?.notes && (
                    <tr className="no-print-border">
                      <td colSpan={numLeftCols + (hasQty ? 1 : 0) + (hasTotal ? 1 : 0)} className="no-print-border" style={{ border: 'none', padding: '10px 0 0 0', textAlign: 'left', fontWeight: 'normal' }}>
                        <div style={{ padding: '0' }}>
                          <p style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: '#666', textTransform: 'uppercase', marginBottom: '4px' }}>{printData.notesTitle || 'Notes / Conditions Particulières'} :</p>
                          <p style={{ margin: 0, fontSize: '13px', whiteSpace: 'pre-wrap', color: '#333' }}>{printData.notes}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })()}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="6" className="no-print-border" style={{ border: 'none', height: '100px' }}></td>
            </tr>
          </tfoot>
        </table>

        <div className="avoid-page-break" style={{ paddingTop: '20px', paddingBottom: '20px' }}>
          <div style={{ marginTop: '20px', fontSize: '11px' }}>
            <p style={{ margin: '0 0 5px 0' }}>Arrêtée la présente facture à la somme de :</p>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '12px', marginLeft: '40px' }}>
              {numberToWords(Math.trunc(printData?.summary?.totalAmount || 0))} ( {formatPrice(printData?.summary?.totalAmount)} Francs CFA TTC )
            </p>
          </div>

          <div style={{ display: 'flex', marginLeft: 'auto', marginRight: '0', width: 'fit-content', alignItems: 'flex-end', gap: '10px', marginTop: '20px' }}>
            {/* Cachet Area */}
            {stamp && (
              <div style={{ width: '150px', height: '110px', marginBottom: '10px', marginRight: '-30px', zIndex: 1 }}>
                <img src={stamp} alt="Cachet" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            )}

            {/* Signature Area */}
            <div style={{ textAlign: 'right', minWidth: '250px' }}>
              <p style={{ fontStyle: 'italic', fontSize: '13px', marginBottom: '5px' }}>Fait à {printData?.city || settings?.city || 'Ouagadougou'} le {new Date(printData?.date || new Date()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>

              <div style={{ position: 'relative', marginTop: '10px', height: '100px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                {sig && (
                  <img
                    src={sig}
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

                <div style={{ marginTop: sig ? '0' : '50px', zIndex: 2 }}>
                  <p style={{ fontWeight: 'bold', textDecoration: 'underline', fontSize: '15px', margin: 0 }}>
                    {printData?.supervisorName || settings?.supervisorName || 'Guy Roland TONDE'}
                  </p>
                  <p style={{ margin: 0, fontSize: '12px' }}>
                    {printData?.supervisorTitle || settings?.supervisorTitle || 'SUPERVISEUR'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Espace physique pour "pousser" la signature à la page suivante si on est trop proche du bas, le padding n'étant pas toujours pris en compte par Chrome pour les sauts de page */}
        <div style={{ height: '120px', width: '100%' }}></div>
        </div>

        {/* Pied de page rouge (Universel) */}
        <div className="red-footer" style={{
          height: '80px', backgroundColor: '#b91c1c', color: '#fff', fontSize: '10px', textAlign: 'center', lineHeight: '1.4',
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', bottom: '0', left: '0', right: '0',
          WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', borderTop: '2px solid #000'
        }}>
          <div style={{ position: 'absolute', left: '0', top: '0', bottom: '0', width: '70px', backgroundColor: '#000', clipPath: 'polygon(0 0, 100% 0, 70% 100%, 0% 100%)' }}></div>
          <div style={{ padding: '0 20px', width: '100%', position: 'relative', zIndex: 2 }}>
            <p style={{ margin: '0', fontWeight: 'bold', fontSize: '10px' }}>
              {settings?.footerLine1 || `${settings?.companyName || 'NS-AUTO'} - RCCM ${settings?.rccm || 'BF BBD 2018 B 0372'} - IFU ${settings?.nif || '00102506 K'} - RNI - Direction des Moyennes Entreprises`}
            </p>
            <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine2 || '01 BP 1245 Bobo Dioulasso 01 - Secteur 05 - Parcelle C - Lot 131ter - Tél.: +226 25 37 62 62'}</p>
            <p style={{ margin: '1px 0', fontSize: '10px' }}>{settings?.footerLine3 || `E-mail : ${settings?.email || 'commercial@nsautobf.com'} - Site web : ${settings?.website || 'www.nsauto.com'}`}</p>
            <p style={{ margin: '1px 0', fontWeight: 'bold', fontSize: '10px' }}>{settings?.footerLine4 || 'IB bank 001193300101 / ECOBANK N°281753286301 - 74'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Bilan de Vente par Client</h1>
          <p>Générez un récapitulatif détaillé des produits vendus</p>
        </div>
      </div>

      <div className="toolbar" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
        <Link href="/reports" className={`nav-item ${pathname === '/reports' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Coins size={18} /> Financiers
        </Link>
        <Link href="/reports/stock" className={`nav-item ${pathname === '/reports/stock' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Package size={18} /> Mouvements de Stock
        </Link>
        <Link href="/reports/client" className={`nav-item ${pathname === '/reports/client' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <User size={18} /> Bilan par Client
        </Link>
        <Link href="/reports/top-articles" className={`nav-item ${pathname === '/reports/top-articles' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <TrendingUp size={18} /> Top Articles / Client
        </Link>
        <Link href="/reports/dead-stock" className={`nav-item ${pathname === '/reports/dead-stock' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <Clock size={18} /> Articles Dormants
        </Link>
        <Link href="/reports/stock-valuation" className={`nav-item ${pathname === '/reports/stock-valuation' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <FileSpreadsheet size={18} /> Valorisation de Stock
        </Link>
        <Link href="/reports/profitability" className={`nav-item ${pathname === '/reports/profitability' ? 'active' : ''}`} style={{ borderRadius: '0', padding: '0.75rem 1.5rem', marginBottom: '-1px' }}>
          <TrendingUp size={18} /> Analyse Rentabilité
        </Link>
      </div>

      <div className="content-card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Client</label>
            <select className="form-control" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)}>
              <option value="">Choisir un client...</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Date Début</label>
            <input type="date" className="form-control" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Date Fin</label>
            <input type="date" className="form-control" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={generateReport} disabled={!selectedClientId || loading}>
            {loading ? 'Calcul...' : 'Calculer le bilan'}
          </button>
        </div>
      </div>

      {data && (
        <div className="content-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Résultats pour {selectedClient?.name}</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={handleExport}>
                <Download size={18} /> Exporter Excel
              </button>
              <button className="btn btn-secondary" onClick={handlePrintClick}>
                <Printer size={18} /> Imprimer / PDF
              </button>
              <button className="btn btn-secondary" onClick={() => setIsHistoryModalOpen(true)}>
                <Clock size={18} /> Historique Impressions
              </button>
              <button className="btn btn-success" onClick={handleSettle} disabled={loading}>
                <Coins size={18} /> Régler la période
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Référence</th>
                  <th>Article</th>
                  <th style={{ textAlign: 'right' }}>P.U</th>
                  <th style={{ textAlign: 'center' }}>Qté Vendue</th>
                  <th style={{ textAlign: 'right' }}>Montant Total</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500 }}>{item.code || '-'}</td>
                    <td style={{ fontWeight: 500 }}>{item.barcode || '-'}</td>
                    <td>{item.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(item.unitPrice)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.totalQuantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(item.totalAmount)} FCFA</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ backgroundColor: 'var(--bg-light)', fontWeight: 'bold' }}>
                <tr>
                  <td colSpan="4" style={{ textAlign: 'right' }}>TOTAL BRUT</td>
                  <td style={{ textAlign: 'center' }}>{data.summary.totalQuantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatPrice(data.summary.totalGrossAmount)} FCFA</td>
                </tr>
                {data.summary.totalDiscount > 0 && (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'right', color: 'var(--danger)' }}>REMISES ACCORDÉES</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{formatPrice(data.summary.totalDiscount)} FCFA</td>
                  </tr>
                )}
                {data.summary.totalTva > 0 && (() => {
                  const base = (data.summary.totalGrossAmount || 0) - (data.summary.totalDiscount || 0);
                  const pct = base > 0 ? Math.round((data.summary.totalTva / base) * 100) : 0;
                  return (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'right', color: 'var(--primary)' }}>
                        MONTANT TVA ({pct}%)
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{formatPrice(data.summary.totalTva)} FCFA</td>
                    </tr>
                  );
                })()}
                <tr style={{ fontSize: '1.2rem', borderTop: '2px solid var(--primary)' }}>
                  <td colSpan="5" style={{ textAlign: 'right' }}>TOTAL NET</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{formatPrice(data.summary.totalAmount)} FCFA</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
      {/* MODAL PREPARATION IMPRESSION */}
      {isPrintModalOpen && printData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px' }}>
            <div className="modal-header">
              <h3>Préparation Impression Bilan</h3>
              <button className="modal-close" onClick={() => setIsPrintModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Titre du document</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={printData.title || ''} 
                    onChange={e => setPrintData({...printData, title: e.target.value})} 
                    style={{ fontWeight: 'bold', color: 'var(--primary)' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)' }}>Période (Bandeau gris)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={printData.periodText || ''} 
                    onChange={e => setPrintData({...printData, periodText: e.target.value})} 
                    style={{ fontWeight: 'bold', borderColor: 'var(--primary)' }}
                  />
                </div>
              </div>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Détails Expéditeur (Bloc de gauche)</label>
                  <textarea 
                    className="form-control" 
                    rows="5" 
                    value={printData.companyDetails || ''} 
                    onChange={e => setPrintData({...printData, companyDetails: e.target.value})}
                    style={{ fontSize: '0.85rem', resize: 'vertical' }}
                  ></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)' }}>Détails Client (Bloc de droite)</label>
                  <textarea 
                    className="form-control" 
                    rows="5" 
                    value={printData.clientDetails || ''} 
                    onChange={e => setPrintData({...printData, clientDetails: e.target.value})}
                    style={{ fontSize: '0.85rem', borderColor: 'var(--primary)', resize: 'vertical' }}
                  ></textarea>
                </div>
              </div>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Date</label>
                  <input type="date" className="form-control" value={printData.date || ''} onChange={e => setPrintData({...printData, date: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Lieu (Ville)</label>
                  <input type="text" className="form-control" value={printData.city || ''} onChange={e => setPrintData({...printData, city: e.target.value})} />
                </div>
              </div>
              <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Signataire (Nom)</label>
                  <input type="text" className="form-control" value={printData.supervisorName || ''} onChange={e => setPrintData({...printData, supervisorName: e.target.value})} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>Titre</label>
                  <input type="text" className="form-control" value={printData.supervisorTitle || ''} onChange={e => setPrintData({...printData, supervisorTitle: e.target.value})} />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '6px', color: 'var(--primary)', border: '1px dashed #ccc', padding: '4px 8px' }} 
                  value={printData.notesTitle || ''} 
                  onChange={e => setPrintData({...printData, notesTitle: e.target.value})} 
                  placeholder="Titre de la section note"
                />
                <textarea 
                  className="form-control" 
                  rows="2" 
                  value={printData.notes || ''} 
                  onChange={e => setPrintData({...printData, notes: e.target.value})}
                  placeholder="Notes optionnelles qui s'afficheront en bas du document..."
                ></textarea>
              </div>

              <div className="form-group" style={{ marginBottom: '1.5rem', backgroundColor: '#f9f9f9', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)' }}>Personnalisation des Noms de Colonnes</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {[
                    { col: 'code', hide: 'hideColCode', label: 'Code', defaultLabel: 'CODE' },
                    { col: 'barcode', hide: 'hideColBarcode', label: 'Référence', defaultLabel: 'RÉFÉRENCE' },
                    { col: 'name', hide: 'hideColName', label: 'Désignation', defaultLabel: 'DÉSIGNATION ARTICLE' },
                    { col: 'unitPrice', hide: 'hideColUnitPrice', label: 'Prix Unitaire', defaultLabel: 'P.U (FCFA)' },
                    { col: 'qty', hide: 'hideColQty', label: 'Quantité', defaultLabel: 'QTÉ' },
                    { col: 'total', hide: 'hideColTotal', label: 'Total', defaultLabel: 'TOTAL (FCFA)' }
                  ].map(c => (
                    <div key={c.col}>
                      <label style={{ fontSize: '0.75rem', color: '#666', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                        <input 
                          type="checkbox" 
                          title="Afficher/Masquer" 
                          style={{ cursor: 'pointer', margin: 0 }} 
                          checked={printData[c.hide] !== true} 
                          onChange={e => setPrintData({...printData, [c.hide]: !e.target.checked})} 
                        />
                        {c.label}
                      </label>
                      <input 
                        type="text" 
                        className="form-control" 
                        style={{ padding: '0.4rem', fontSize: '0.85rem', opacity: printData[c.hide] ? 0.5 : 1 }} 
                        value={printData.colHeaders?.[c.col] || ''} 
                        onChange={e => setPrintData({...printData, colHeaders: {...printData.colHeaders, [c.col]: e.target.value}})} 
                        placeholder={c.defaultLabel} 
                        disabled={printData[c.hide] === true}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--primary)' }}>Articles (Modifiables avant impression)</label>
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                        <th style={{ padding: '4px' }}>Code</th>
                        <th style={{ padding: '4px' }}>Réf.</th>
                        <th style={{ padding: '4px' }}>Désignation / Article</th>
                        <th style={{ padding: '4px', width: '80px' }}>Qté</th>
                        <th style={{ padding: '4px', width: '100px' }}>P.U</th>
                        <th style={{ padding: '4px', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {printData.items && printData.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '4px' }}><input type="text" className="form-control" style={{ padding: '4px', fontSize: '0.8rem' }} value={item.code || ''} onChange={(e) => updatePrintItem(idx, 'code', e.target.value)} /></td>
                          <td style={{ padding: '4px' }}><input type="text" className="form-control" style={{ padding: '4px', fontSize: '0.8rem' }} value={item.barcode || ''} onChange={(e) => updatePrintItem(idx, 'barcode', e.target.value)} /></td>
                          <td style={{ padding: '4px' }}><input type="text" className="form-control" style={{ padding: '4px', fontSize: '0.8rem' }} value={item.name || ''} onChange={(e) => updatePrintItem(idx, 'name', e.target.value)} /></td>
                          <td style={{ padding: '4px' }}><input type="number" className="form-control" style={{ padding: '4px', fontSize: '0.8rem' }} value={item.totalQuantity || 0} onChange={(e) => updatePrintItem(idx, 'totalQuantity', parseFloat(e.target.value) || 0)} /></td>
                          <td style={{ padding: '4px' }}><input type="number" className="form-control" style={{ padding: '4px', fontSize: '0.8rem' }} value={item.unitPrice || 0} onChange={(e) => updatePrintItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} /></td>
                          <td style={{ padding: '4px', textAlign: 'center' }}>
                            <button className="btn btn-sm" style={{ color: 'red', padding: '0', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => removePrintItem(idx)}><X size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="btn btn-sm btn-secondary" style={{ marginTop: '10px' }} onClick={addPrintItem}>+ Ajouter une ligne</button>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', padding: '1rem 1.5rem', borderTop: '1px solid #eee' }}>
              <button className="btn btn-secondary" onClick={() => setIsPrintModalOpen(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={executePrint} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Printer size={18} /> Lancer l'impression
              </button>
            </div>
          </div>
        </div>
      )}

      

      {/* MODAL HISTORIQUE IMPRESSIONS */}
      {isHistoryModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '850px', width: '90%' }}>
            <div className="modal-header">
              <h3>Historique des impressions de bilan</h3>
              <button className="modal-close" onClick={() => setIsHistoryModalOpen(false)}><X size={20} /></button>
            </div>
            <div className="modal-body custom-scrollbar" style={{ padding: '1.5rem', maxHeight: '70vh', overflowY: 'auto' }}>
              {printHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Aucun historique d'impression n'a été trouvé.
                </div>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date d'impression</th>
                      <th>Client</th>
                      <th>Période couverte</th>
                      <th style={{ textAlign: 'right' }}>Montant Total</th>
                      <th style={{ width: '160px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printHistory.map(historyItem => (
                      <tr key={historyItem.id}>
                        <td>{new Date(historyItem.date).toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>{historyItem.clientName}</td>
                        <td>{historyItem.period}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(historyItem.totalAmount)} FCFA</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                              onClick={() => {
                                if (historyItem.clientId) {
                                  setSelectedClientId(historyItem.clientId);
                                }
                                setPrintData(historyItem.printData);
                                setIsHistoryModalOpen(false);
                                setIsPrintModalOpen(true);
                              }}
                            >
                              <Printer size={14} /> Éditer
                            </button>
                            <button 
                              className="btn btn-sm"
                              style={{ color: '#ef4444', border: '1px solid #ef4444', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={() => deletePrintHistory(historyItem.id)}
                              title="Supprimer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <AlertModal 
        isOpen={alertModal.open} 
        type={alertModal.type} 
        title={alertModal.title} 
        message={alertModal.message} 
        onClose={() => setAlertModal({ ...alertModal, open: false, onConfirm: null })} 
        onConfirm={alertModal.onConfirm} 
      />
    </div>
  );
}
