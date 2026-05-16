'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../../lib/storage';
import { User, Calendar, FileText, Printer, ChevronLeft, Package, Coins, Download, TrendingUp, Clock } from 'lucide-react';
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
  const [settings, setSettings] = useState(null);
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
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

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 500);
  };

  const handleExport = () => {
    if (!data) return;
    const headers = [
      { key: 'code', label: 'Code' },
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
          ['', 'TOTAL BRUT (HT)', '', data.summary.totalQuantity, `${formatPrice(data.summary.totalGrossAmount)} FCFA`],
          ['', `MONTANT TVA (${Math.round((data.summary.totalTva / (data.summary.totalGrossAmount - data.summary.totalDiscount)) * 100)}%)`, '', '', `${formatPrice(data.summary.totalTva)} FCFA`],
          ['', 'TOTAL NET (TTC)', '', '', `${formatPrice(data.summary.totalAmount)} FCFA`]
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

  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (isPrinting && data) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '40px', backgroundColor: 'white', minHeight: '100vh', color: 'black' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '15px' }}>
          {settings?.logo ? (
            <img src={settings.logo} alt="Logo" style={{ maxHeight: '100px', marginBottom: '15px' }} />
          ) : (
            <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', textTransform: 'uppercase' }}>{settings?.companyName || 'MINING AUTOLOG'}</h1>
          )}
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          {settings?.phone && <p style={{ margin: '2px 0' }}>Tél : {settings.phone}</p>}
          <h2 style={{ margin: '15px 0 5px 0', fontSize: '18px', textTransform: 'uppercase' }}>BILAN DE CONSOMMATION</h2>
          <p style={{ margin: 0 }}>Période : Du {new Date(startDate).toLocaleDateString()} au {new Date(endDate).toLocaleDateString()}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
          <div>
            <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', textDecoration: 'underline' }}>COORDONNÉES CLIENT :</h3>
            <p style={{ margin: 0, fontWeight: 'bold', fontSize: '16px' }}>{selectedClient?.name}</p>
            <p style={{ margin: 0 }}>{selectedClient?.phone || ''}</p>
            <p style={{ margin: 0 }}>{selectedClient?.address || ''}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0 }}>Édité le : {new Date().toLocaleDateString('fr-FR')}</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0', borderBottom: '2px solid #000' }}>
              <th style={{ textAlign: 'left', padding: '10px', border: '1px solid #000' }}>CODE</th>
              <th style={{ textAlign: 'left', padding: '10px', border: '1px solid #000' }}>DÉSIGNATION ARTICLE</th>
              <th style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>P.U (FCFA)</th>
              <th style={{ textAlign: 'center', padding: '10px', border: '1px solid #000' }}>QTÉ</th>
              <th style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>TOTAL (FCFA)</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item, idx) => (
              <tr key={idx}>
                <td style={{ padding: '10px', border: '1px solid #000' }}>{item.code || '-'}</td>
                <td style={{ padding: '10px', border: '1px solid #000' }}>{item.name}</td>
                <td style={{ padding: '10px', border: '1px solid #000' }}>{formatPrice(item.unitPrice)}</td>
                <td style={{ textAlign: 'center', padding: '10px', border: '1px solid #000' }}>{item.totalQuantity}</td>
                <td style={{ textAlign: 'right', padding: '10px', border: '1px solid #000', fontWeight: 'bold' }}>{formatPrice(item.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
              <td colSpan="3" style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>TOTAL BRUT</td>
              <td style={{ textAlign: 'center', padding: '10px', border: '1px solid #000' }}>{data.summary.totalQuantity}</td>
              <td style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>{formatPrice(data.summary.totalGrossAmount)} FCFA</td>
            </tr>
            {data.summary.totalDiscount > 0 && (
              <tr style={{ fontWeight: 'bold' }}>
                <td colSpan="4" style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>TOTAL REMISES</td>
                <td style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>-{formatPrice(data.summary.totalDiscount)} FCFA</td>
              </tr>
            )}
            {data.summary.totalTva > 0 && (
              <tr style={{ fontWeight: 'bold' }}>
                <td colSpan="4" style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>
                  MONTANT TVA ({Math.round((data.summary.totalTva / (data.summary.totalGrossAmount - data.summary.totalDiscount)) * 100)}%)
                </td>
                <td style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>{formatPrice(data.summary.totalTva)} FCFA</td>
              </tr>
            )}
            <tr style={{ backgroundColor: '#e0e0e0', fontWeight: 'bold' }}>
              <td colSpan="4" style={{ textAlign: 'right', padding: '10px', border: '1px solid #000' }}>TOTAL NET À RÉGLER</td>
              <td style={{ textAlign: 'right', padding: '10px', border: '1px solid #000', fontSize: '18px' }}>{formatPrice(data.summary.totalAmount)} FCFA</td>
            </tr>
          </tfoot>
        </table>

        <div style={{ marginTop: '60px', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <p style={{ margin: 0, textDecoration: 'underline' }}>Le Comptable</p>
            <div style={{ height: '80px' }}></div>
          </div>
          <div style={{ textAlign: 'center', width: '200px' }}>
            <p style={{ margin: 0, textDecoration: 'underline' }}>La Direction</p>
            <div style={{ height: '80px' }}></div>
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
              <button className="btn btn-secondary" onClick={handlePrint}>
                <Printer size={18} /> Imprimer / PDF
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
                    <td>{item.name}</td>
                    <td style={{ textAlign: 'right' }}>{formatPrice(item.unitPrice)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{item.totalQuantity}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(item.totalAmount)} FCFA</td>
                  </tr>
                ))}
              </tbody>
              <tfoot style={{ backgroundColor: 'var(--bg-light)', fontWeight: 'bold' }}>
                <tr>
                  <td colSpan="3" style={{ textAlign: 'right' }}>TOTAL BRUT</td>
                  <td style={{ textAlign: 'center' }}>{data.summary.totalQuantity}</td>
                  <td style={{ textAlign: 'right' }}>{formatPrice(data.summary.totalGrossAmount)} FCFA</td>
                </tr>
                {data.summary.totalDiscount > 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'right', color: 'var(--danger)' }}>REMISES ACCORDÉES</td>
                    <td style={{ textAlign: 'right', color: 'var(--danger)' }}>-{formatPrice(data.summary.totalDiscount)} FCFA</td>
                  </tr>
                )}
                {data.summary.totalTva > 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'right', color: 'var(--primary)' }}>
                      MONTANT TVA ({Math.round((data.summary.totalTva / (data.summary.totalGrossAmount - data.summary.totalDiscount)) * 100)}%)
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{formatPrice(data.summary.totalTva)} FCFA</td>
                  </tr>
                )}
                <tr style={{ fontSize: '1.2rem', borderTop: '2px solid var(--primary)' }}>
                  <td colSpan="4" style={{ textAlign: 'right' }}>TOTAL NET</td>
                  <td style={{ textAlign: 'right', color: 'var(--primary)' }}>{formatPrice(data.summary.totalAmount)} FCFA</td>
                </tr>
              </tfoot>
            </table>
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
