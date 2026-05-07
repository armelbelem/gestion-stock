'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  Plus, ShoppingCart, Calendar, User, ChevronDown, ChevronUp, 
  Package, Printer, Eye, ChevronLeft, ChevronRight,
  DollarSign, Search, XCircle, Download, FileText
} from 'lucide-react';
import { exportToExcel } from '../../utils/excelExport';
import Link from 'next/link';
import { useAuth } from '../../providers';
import AlertModal from '../../components/AlertModal';

export default function SalesPage() {
  const [sales, setSales] = useState([]);
  const [expandedSale, setExpandedSale] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [paymentModal, setPaymentModal] = useState({ open: false, saleId: null, total: 0, paid: 0 });
  const [newPayment, setNewPayment] = useState({ amount: '', notes: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [printChoiceModal, setPrintChoiceModal] = useState({ open: false, sale: null });
  const itemsPerPage = 10;
  const [isReporting, setIsReporting] = useState(false);
  const [settings, setSettings] = useState(null);
  const { user: currentUser } = useAuth();
  
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateRange]);

  useEffect(() => {
    loadSales();
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      setSettings(data);
    } catch (err) { console.error(err); }
  };

  const loadSales = async () => {
    try {
      const data = await storage.get('sales');
      setSales(data);
    } catch (err) {
      console.error("Error loading sales:", err);
    }
  };

  const handleCancelSale = (saleId) => {
    showConfirm(
      'Annuler cette vente ?',
      'Cette action est irréversible. Les articles seront automatiquement remis en stock.',
      async () => {
        try {
          await storage.create(`sales/${saleId}/cancel`, {});
          loadSales();
          showAlert('success', 'Annulation réussie', 'La vente a été annulée et le stock a été mis à jour.');
        } catch (error) {
          showAlert('error', 'Erreur', error.message);
        }
      }
    );
  };
  
  const handleConvertProforma = (saleId) => {
    showConfirm(
      'Convertir en vente réelle ?',
      'Cette action déduira les articles du stock et validera la transaction définitivement.',
      async () => {
        try {
          const res = await fetch(`/api/sales/${saleId}/convert`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Erreur lors de la conversion");
          
          loadSales();
          showAlert('success', 'Conversion réussie', 'Le proforma a été transformé en vente réelle.');
        } catch (error) {
          showAlert('error', 'Erreur', error.message);
        }
      }
    );
  };

  const handlePrint = (sale) => {
    setPrintData(sale);
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
      setPrintData(null);
    }, 500);
  };

  const toggleExpand = (id) => {
    setExpandedSale(expandedSale === id ? null : id);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'payé': return <span className="badge badge-success">Payé</span>;
      case 'partiel': return <span className="badge badge-warning">Partiel</span>;
      case 'en_attente': return <span className="badge badge-danger">Consommation</span>;
      case 'annulée': return <span className="badge badge-danger">Annulée</span>;
      case 'proforma': return <span className="badge" style={{ backgroundColor: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }}>PROFORMA</span>;
      default: return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    try {
      await storage.create(`sales/${paymentModal.saleId}/payments`, {
        amount: Number(newPayment.amount),
        notes: newPayment.notes
      });
      setPaymentModal({ ...paymentModal, open: false });
      setNewPayment({ amount: '', notes: '' });
      loadSales();
      showAlert('success', 'Succès', 'Paiement enregistré !');
    } catch (error) {
      showAlert('error', 'Erreur', error.message);
    }
  };

  const setQuickRange = (type) => {
    const end = new Date();
    const start = new Date();
    if (type === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (type === 'yesterday') {
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (type === 'week') {
      start.setDate(start.getDate() - 7);
    } else if (type === 'month') {
      start.setDate(1);
    }
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  };

  const filteredSales = sales.filter(sale => {
    const matchesSearch = sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sale.clientName && sale.clientName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    // Restriction : Seul l'admin voit les proformas
    if (sale.status === 'proforma' && currentUser?.role !== 'admin') return false;

    const saleDate = new Date(sale.date);
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;
    
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);
    
    return (!start || saleDate >= start) && (!end || saleDate <= end);
  });

  const totalPeriodAmount = filteredSales.reduce((acc, s) => acc + (s.status !== 'annulée' ? s.totalAmount : 0), 0);

  const handleExportSaleExcel = (sale) => {
    const isProforma = sale.status === 'proforma';
    const title = isProforma ? "FACTURE PROFORMA" : "REÇU DE VENTE";
    
    const headers = [
      { key: 'articleName', label: 'Désignation' },
      { key: 'quantity', label: 'Quantité' },
      { key: 'unitPrice', label: 'Prix Unitaire' },
      { key: 'total', label: 'Total HT' }
    ];
    
    const afterDiscount = sale.totalAmount - (sale.tvaAmount || 0);
    const subtotalHT = afterDiscount + (sale.discount || 0);

    exportToExcel(
      items, 
      headers, 
      `${isProforma ? 'proforma' : 'facture'}_${sale.id.substring(0,8)}`,
      {
        title: title,
        companyName: settings?.companyName || "NS AUTO",
        period: `Le ${formatDate(sale.date)}`,
        summary: [
          '', '', 'SOUS-TOTAL HT', `${subtotalHT.toLocaleString()} FCFA`,
          '', '', 'REMISE', `-${(sale.discount || 0).toLocaleString()} FCFA`,
          '', '', 'TVA', `${(sale.tvaAmount || 0).toLocaleString()} FCFA`,
          '', '', 'TOTAL NET TTC', `${sale.totalAmount.toLocaleString()} FCFA`
        ]
      }
    );
    showAlert('success', 'Succès', 'Exportation Excel générée !');
  };

  const handleExportExcel = () => {
    const headers = [
      { key: 'idShort', label: 'Référence' },
      { key: 'clientName', label: 'Client' },
      { key: 'sellerName', label: 'Vendeur' },
      { key: 'dateFormatted', label: 'Date' },
      { key: 'totalAmount', label: 'Montant (FCFA)' },
      { key: 'status', label: 'Statut' }
    ];
    
    const dataToExport = filteredSales.map(s => ({
      ...s,
      idShort: `#${s.id.substring(0,8).toUpperCase()}`,
      dateFormatted: formatDate(s.date)
    }));

    exportToExcel(
      dataToExport, 
      headers, 
      `rapport_ventes_${dateRange.start || 'toutes'}_${dateRange.end || 'toutes'}`,
      {
        title: "RAPPORT DE VENTES",
        companyName: settings?.companyName || "NS AUTO",
        period: `${dateRange.start || 'Début'} au ${dateRange.end || 'Fin'}`,
        summary: ['', 'TOTAUX GÉNÉRAUX', '', '', `${totalPeriodAmount.toLocaleString()} FCFA`, '']
      }
    );
  };

  const handlePrintReport = () => {
    setIsReporting(true);
    setTimeout(() => {
      window.print();
      setIsReporting(false);
    }, 500);
  };

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentSales = filteredSales.slice(indexOfFirstItem, indexOfLastItem);

  if (isPrinting && printData) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          {settings?.logo ? (
            <img src={settings.logo} alt="Logo" style={{ maxHeight: '80px', marginBottom: '10px' }} />
          ) : (
            <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'MINING AUTOLOG'}</h1>
          )}
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          {settings?.phone && <p style={{ margin: '2px 0' }}>Tél : {settings.phone}</p>}
          {(settings?.nif || settings?.rccm) && (
            <p style={{ fontSize: '0.8rem', margin: '2px 0' }}>
              {settings?.nif && `NIF: ${settings.nif}`} {settings?.rccm && `| RCCM: ${settings.rccm}`}
            </p>
          )}
          <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed #ccc' }}>
            <h2 style={{ margin: '0', fontSize: '18px' }}>
              {printData.status === 'proforma' ? 'FACTURE PROFORMA' : 'REÇU DE VENTE'} #{printData.id.substring(0, 8).toUpperCase()}
            </h2>
            <p style={{ margin: '5px 0' }}>Date : {formatDate(printData.date)}</p>
          </div>
        </div>
        <div style={{ marginBottom: '20px' }}>
          <p><strong>Client :</strong> {printData.clientName}</p>
          <p><strong>Vendeur :</strong> {printData.sellerName}</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Article</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Qté</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {printData.items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                <td style={{ padding: '8px' }}>{item.articleName}</td>
                <td style={{ textAlign: 'center', padding: '8px' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', padding: '8px' }}>{(item.quantity * item.unitPrice).toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '1px solid black' }}>
              <td colSpan="2" style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.9rem', color: '#666' }}>TOTAL HT</td>
              <td style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.9rem', color: '#666' }}>{(printData.totalAmount - (printData.tvaAmount || 0) + (printData.discount || 0)).toLocaleString()} FCFA</td>
            </tr>
            {printData.discount > 0 && (
              <tr>
                <td colSpan="2" style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.9rem', color: '#666' }}>REMISE</td>
                <td style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.9rem', color: '#666' }}>-{(printData.discount || 0).toLocaleString()} FCFA</td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid #eee' }}>
              <td colSpan="2" style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.9rem', color: '#666' }}>TVA</td>
              <td style={{ textAlign: 'right', padding: '4px 8px', fontSize: '0.9rem', color: '#666' }}>{(printData.tvaAmount || 0).toLocaleString()} FCFA</td>
            </tr>
            <tr style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
              <td colSpan="2" style={{ textAlign: 'right', padding: '12px 8px' }}>TOTAL NET TTC</td>
              <td style={{ textAlign: 'right', padding: '12px 8px' }}>{printData.totalAmount.toLocaleString()} FCFA</td>
            </tr>
          </tfoot>
        </table>
        
        {settings?.footerMessage && (
          <div style={{ textAlign: 'center', marginTop: '30px', paddingTop: '10px', borderTop: '1px dashed #ccc', fontSize: '0.9rem', fontStyle: 'italic' }}>
            {settings.footerMessage}
          </div>
        )}

        <div style={{ marginTop: '20px', fontSize: '0.7rem', textAlign: 'center', color: '#666' }}>
          Imprimé le {new Date().toLocaleString()}
        </div>
      </div>
    );
  }

  if (isReporting) {
    return (
      <div className="receipt-print-only" style={{ display: 'block', padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid black', paddingBottom: '10px' }}>
          <h1 style={{ margin: '0', fontSize: '24px', fontWeight: '800', textTransform: 'uppercase' }}>{settings?.companyName || 'MINING AUTOLOG'}</h1>
          {settings?.address && <p style={{ margin: '2px 0' }}>{settings.address}</p>}
          <h2 style={{ marginTop: '15px' }}>RAPPORT DE VENTES</h2>
          <p>Période : {dateRange.start ? formatShortDate(dateRange.start) : 'Début'} au {dateRange.end ? formatShortDate(dateRange.end) : 'Fin'}</p>
        </div>
        
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid black', backgroundColor: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '8px' }}>Réf</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Client</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
              <th style={{ textAlign: 'right', padding: '8px' }}>Montant</th>
              <th style={{ textAlign: 'center', padding: '8px' }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {filteredSales.map((sale) => (
              <React.Fragment key={sale.id}>
                <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid #ccc' }}>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>#{sale.id.substring(0,8).toUpperCase()}</td>
                  <td style={{ padding: '8px', fontWeight: 'bold' }}>{sale.clientName}</td>
                  <td style={{ padding: '8px' }}>{formatDate(sale.date)}</td>
                  <td style={{ textAlign: 'right', padding: '8px', fontWeight: 'bold' }}>{sale.totalAmount.toLocaleString()} FCFA</td>
                  <td style={{ textAlign: 'center', padding: '8px' }}>{sale.status}</td>
                </tr>
                {sale.items && sale.items.map((item, idx) => (
                  <tr key={`${sale.id}-${idx}`} style={{ fontSize: '0.85rem', color: '#555' }}>
                    <td colSpan="2" style={{ padding: '4px 8px 4px 30px' }}>• {item.articleName}</td>
                    <td style={{ padding: '4px 8px' }}>Qté: {item.quantity}</td>
                    <td colSpan="2"></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 'bold', borderTop: '2px solid black' }}>
              <td colSpan="3" style={{ textAlign: 'right', padding: '12px' }}>TOTAL GÉNÉRAL</td>
              <td style={{ textAlign: 'right', padding: '12px' }}>{totalPeriodAmount.toLocaleString()} FCFA</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div style={{ marginTop: '30px', fontSize: '0.8rem', textAlign: 'right' }}>
          Généré le {new Date().toLocaleString()}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Ventes</h1>
          <p>Historique des ventes effectuées</p>
        </div>
        <Link href="/sales/new" className="btn btn-primary">
          <Plus size={16} /> Nouvelle Vente
        </Link>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0, position: 'relative', flex: '1 1 300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Rechercher une vente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input type="date" className="form-control" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
            <span className="text-muted">au</span>
            <input type="date" className="form-control" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange('today')}>Aujourd'hui</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange('week')}>7 j</button>
            <button className="btn btn-secondary btn-sm" onClick={() => setQuickRange('month')}>Mois</button>
            <button className="btn btn-secondary" title="Réinitialiser" onClick={() => setDateRange({start: '', end: ''})}><XCircle size={16} /></button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: 'auto' }}>
            <button className="btn btn-secondary" onClick={handleExportExcel} title="Exporter Excel">
              <Download size={18} /> Excel
            </button>
            <button className="btn btn-secondary" onClick={handlePrintReport} title="Imprimer / PDF">
              <FileText size={18} /> PDF
            </button>
          </div>
        </div>

        {currentUser?.role !== 'vendeur' && filteredSales.length > 0 && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', gap: '2rem' }}>
            <div style={{ fontSize: '0.9rem' }}>
              <span className="text-muted">Nombre de ventes : </span>
              <strong style={{ color: 'var(--primary)' }}>{filteredSales.length}</strong>
            </div>
            <div style={{ fontSize: '0.9rem' }}>
              <span className="text-muted">Total CA sur période : </span>
              <strong style={{ color: 'var(--success)' }}>{totalPeriodAmount.toLocaleString()} FCFA</strong>
            </div>
          </div>
        )}
      </div>
      
      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Référence</th>
                <th>Client</th>
                {currentUser?.role === 'admin' && <th>Vendeur</th>}
                <th>Date</th>
                {currentUser?.role === 'admin' && <th>Montant</th>}
                {currentUser?.role !== 'vendeur' && <th>Statut</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSales.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '2rem' }}>Aucune vente trouvée.</td></tr>
              ) : (
                currentSales.map((sale) => (
                  <React.Fragment key={sale.id}>
                    <tr onClick={() => toggleExpand(sale.id)} style={{ cursor: 'pointer' }}>
                      <td>{expandedSale === sale.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>#{sale.id.substring(0, 8).toUpperCase()}</td>
                      <td>{sale.clientName}</td>
                      {currentUser?.role === 'admin' && <td>{sale.sellerName}</td>}
                      <td>{formatDate(sale.date)}</td>
                      {currentUser?.role === 'admin' && <td style={{ fontWeight: 600 }}>{sale.totalAmount.toLocaleString()} FCFA</td>}
                      {currentUser?.role !== 'vendeur' && <td>{getStatusBadge(sale.status)}</td>}
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); toggleExpand(sale.id); }}><Eye size={14} /></button>
                          
                          {currentUser?.role !== 'vendeur' && (
                            <>
                              {sale.status === 'proforma' && (
                                <button className="btn btn-sm" style={{ backgroundColor: '#fff7ed', color: '#9a3412', border: '1px solid #fdba74' }} title="Transformer en vente" onClick={(e) => { e.stopPropagation(); handleConvertProforma(sale.id); }}>
                                  <ShoppingCart size={14} />
                                </button>
                              )}
                              {sale.status !== 'payé' && sale.status !== 'annulée' && sale.status !== 'proforma' && (
                                <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); setPaymentModal({ open: true, saleId: sale.id, total: sale.totalAmount, paid: sale.amountPaid }); setNewPayment({ amount: sale.totalAmount - sale.amountPaid, notes: '' }); }}><DollarSign size={14} /></button>
                              )}
                              {sale.status !== 'annulée' && (
                                <button className="btn btn-danger-outline btn-sm" onClick={(e) => { e.stopPropagation(); handleCancelSale(sale.id); }}><XCircle size={14} /></button>
                              )}
                            </>
                          )}
                          
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setPrintChoiceModal({ open: true, sale: sale }); }} title="Imprimer / Exporter">
                            <Printer size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedSale === sale.id && (
                      <tr className="expanded-row">
                        <td colSpan="8">
                          <div style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
                            <h4>Articles vendus</h4>
                            <div className="table-wrapper">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Article</th>
                                    <th>Qté</th>
                                    {currentUser?.role === 'admin' && (
                                      <>
                                        <th>Prix</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                      </>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sale.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td>{item.articleName}</td>
                                      <td>{item.quantity}</td>
                                      {currentUser?.role === 'admin' && (
                                        <>
                                          <td>{item.unitPrice.toLocaleString()} FCFA</td>
                                          <td style={{ textAlign: 'right' }}>{(item.quantity * item.unitPrice).toLocaleString()} FCFA</td>
                                        </>
                                      )}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            {currentUser?.role === 'admin' && (
                              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '2rem' }}>
                                <div style={{ textAlign: 'right' }}>
                                  <p className="text-muted">Payé : {sale.amountPaid.toLocaleString()} FCFA</p>
                                  <p style={{ fontWeight: 700, color: 'var(--primary)' }}>À régler : {(sale.totalAmount - sale.amountPaid).toLocaleString()} FCFA</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
            <span>Page {currentPage} / {totalPages}</span>
            <button className="btn btn-secondary" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
          </div>
        )}
      </div>

      {paymentModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Enregistrer un paiement</h3>
              <button className="modal-close" onClick={() => setPaymentModal({ ...paymentModal, open: false })}>&times;</button>
            </div>
            <form onSubmit={handleAddPayment}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Montant (Reste: {(paymentModal.total - paymentModal.paid).toLocaleString()} FCFA)</label>
                  <input type="number" className="form-control" required value={newPayment.amount} onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })} max={paymentModal.total - paymentModal.paid} />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" rows="2" value={newPayment.notes} onChange={(e) => setNewPayment({ ...newPayment, notes: e.target.value })}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setPaymentModal({ ...paymentModal, open: false })}>Annuler</button>
                <button type="submit" className="btn btn-primary">Valider</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {printChoiceModal.open && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '350px', textAlign: 'center' }}>
            <div className="modal-header">
              <h3>Format d'exportation</h3>
              <button className="modal-close" onClick={() => setPrintChoiceModal({ open: false, sale: null })}>&times;</button>
            </div>
            <div className="modal-body" style={{ padding: '2rem 1rem' }}>
              <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>Comment souhaitez-vous obtenir le document #{printChoiceModal.sale?.id.substring(0,8).toUpperCase()} ?</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                <button 
                  className="btn btn-primary btn-lg" 
                  onClick={() => { handlePrint(printChoiceModal.sale); setPrintChoiceModal({ open: false, sale: null }); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <FileText size={20} /> Imprimer en PDF
                </button>
                <button 
                  className="btn btn-secondary btn-lg" 
                  onClick={() => { handleExportSaleExcel(printChoiceModal.sale); setPrintChoiceModal({ open: false, sale: null }); }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}
                >
                  <Download size={20} /> Exporter en Excel
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPrintChoiceModal({ open: false, sale: null })}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
