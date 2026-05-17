'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Settings, Save, Building2, Printer, Globe, ShieldCheck, Database, Trash2, Shield, Download, AlertTriangle, Plus, X } from 'lucide-react';

import { useAuth } from '../../providers';
import AlertModal from '../../components/AlertModal';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    companyName: '', address: '', phone: '', email: '',
    nif: '', rccm: '', logo: '', currency: 'FCFA',
    footerMessage: '', receiptFormat: 'A4',
    supervisorName: '', supervisorTitle: '', stampImage: '', signatureImage: '',
    tvaRate: 18,
    website: '', bankInfo: '', taxSystem: '', secondaryAddress: '',
    blSupervisorName: '', blSupervisorTitle: '',
    blStampImage: '', blSignatureImage: '',
    bcTitlePrefix: '', blTitlePrefix: '',
    bcNumberFormat: 'BC-{ID}-{DATE}', blNumberFormat: 'BL-{ID}-{DATE}',
    bp: '', division: '',
    footerLine1: '', footerLine2: '', footerLine3: '', footerLine4: '',
    roundAmounts: true
  });
  const [cleanupPeriod, setCleanupPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [partners, setPartners] = useState([]);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null, confirmLabel: '', cancelLabel: '' });

  useEffect(() => {
    loadSettings();
    loadPartners();
  }, []);

  const loadPartners = async () => {
    try {
      const data = await storage.get('contract-partners');
      setPartners(data || []);
    } catch (err) { console.error(err); }
  };

  const loadSettings = async () => {
    try {
      const data = await storage.get('settings');
      if (data) {
        setSettings(prev => ({
          ...prev,
          ...data
        }));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (user?.role !== 'admin') return;
    setIsSubmitting(true);
    try {
      await storage.update('settings', 1, settings);
      setAlertModal({ open: true, type: 'success', title: 'Succès', message: 'Paramètres mis à jour avec succès !' });
    } catch (err) {
      setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
    } finally { setIsSubmitting(false); }
  };

  const handlePartnerSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Add images if they were changed
    if (editingPartner?.logo) data.logo = editingPartner.logo;
    if (editingPartner?.stamp_image) data.stamp_image = editingPartner.stamp_image;
    if (editingPartner?.signature_image) data.signature_image = editingPartner.signature_image;
    if (editingPartner?.bl_stamp_image) data.bl_stamp_image = editingPartner.bl_stamp_image;
    if (editingPartner?.bl_signature_image) data.bl_signature_image = editingPartner.bl_signature_image;

    try {
      if (editingPartner?.id) {
        await storage.update('contract-partners', editingPartner.id, { ...data, id: editingPartner.id });
      } else {
        await storage.create('contract-partners', data);
      }
      setIsPartnerModalOpen(false);
      setEditingPartner(null);
      loadPartners();
      setAlertModal({ open: true, type: 'success', title: 'Succès', message: 'Partenaire enregistré !' });
    } catch (err) {
      setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
    }
  };

  const deletePartner = (id) => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Supprimer ?',
      message: 'Voulez-vous vraiment supprimer ce partenaire ?',
      onConfirm: async () => {
        setAlertModal(prev => ({ ...prev, open: false }));
        try {
          await storage.remove('contract-partners', id);
          loadPartners();
        } catch (err) {
          setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
        }
      }
    });
  };

  const handleBackup = async () => {
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/settings/backup', {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Échec du téléchargement');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_mining_autolog_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setAlertModal({ open: true, type: 'error', title: 'Erreur de Sauvegarde', message: err.message });
    }
  };

  const handleClearLogs = async () => {
    const periodLabel = cleanupPeriod === '1' ? '24 heures' : (cleanupPeriod === '7' ? '7 jours' : '30 jours');
    
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Nettoyer les journaux ?',
      message: `Voulez-vous vraiment supprimer les journaux d'activité de plus de ${periodLabel} ? Cette action est irréversible.`,
      confirmLabel: 'Nettoyer',
      cancelLabel: 'Annuler',
      onConfirm: async () => {
        setAlertModal(prev => ({ ...prev, open: false }));
        try {
          const token = sessionStorage.getItem('token');
          const response = await fetch('/api/settings/maintenance', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
            },
            body: JSON.stringify({ action: 'clear_logs', period: cleanupPeriod })
          });
          const data = await response.json();
          if (data.success) {
            setAlertModal({ open: true, type: 'success', title: 'Succès', message: data.message });
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          setAlertModal({ open: true, type: 'error', title: 'Erreur', message: err.message });
        }
      }
    });
  };

  const handleResetDatabase = async () => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: '⚠️ ACTION CRITIQUE ⚠️',
      message: 'Voulez-vous vraiment RÉINITIALISER toute la base de données ? Cela effacera toutes les ventes, mouvements et paiements. Les articles et le stock actuel seront conservés.',
      confirmLabel: 'OUI, TOUT VIDER',
      cancelLabel: 'NON, ANNULER',
      onConfirm: async () => {
        setAlertModal(prev => ({ ...prev, open: false }));
        try {
          const token = sessionStorage.getItem('token');
          const response = await fetch('/api/settings/reset-database', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
            }
          });
          const data = await response.json();
          if (data.success) {
            setAlertModal({ 
              open: true, 
              type: 'success', 
              title: 'Base Réinitialisée', 
              message: 'L\'historique a été vidé avec succès. L\'application va redémarrer.' 
            });
            setTimeout(() => window.location.reload(), 2000);
          } else {
            throw new Error(data.error);
          }
        } catch (err) {
          setAlertModal({ open: true, type: 'error', title: 'Erreur Fatale', message: err.message });
        }
      }
    });
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 1024 * 1024) { // Limite 1MB
        setAlertModal({ open: true, type: 'error', title: 'Fichier trop volumineux', message: 'Le logo ne doit pas dépasser 1 Mo' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, logo: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleStampUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB
        setAlertModal({ open: true, type: 'error', title: 'Fichier trop volumineux', message: 'Le cachet ne doit pas dépasser 500 Ko' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, stampImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB
        setAlertModal({ open: true, type: 'error', title: 'Fichier trop volumineux', message: 'La signature ne doit pas dépasser 500 Ko' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, signatureImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBLStampUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setAlertModal({ open: true, type: 'error', title: 'Fichier trop volumineux', message: 'Le cachet ne doit pas dépasser 500 Ko' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, blStampImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleBLSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500 * 1024) {
        setAlertModal({ open: true, type: 'error', title: 'Fichier trop volumineux', message: 'La signature ne doit pas dépasser 500 Ko' });
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, blSignatureImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="page">Chargement...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Paramètres</h1>
          <p>Configurez les informations et préférences de votre application</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))' }}>
          
          {/* Informations Entreprise */}
          <div className="content-card">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="stat-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
                <Building2 size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Informations de l'Entreprise</h3>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <div style={{ 
                  width: '100px', 
                  height: '100px', 
                  borderRadius: '8px', 
                  border: '2px dashed var(--border)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-light)'
                }}>
                  {settings.logo ? (
                    <img src={settings.logo} alt="Logo preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Building2 size={32} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                {settings.logo && (
                  <button 
                    type="button" 
                    onClick={() => setSettings({ ...settings, logo: '' })}
                    style={{
                      position: 'absolute',
                      top: '-10px',
                      right: '-10px',
                      backgroundColor: 'var(--danger)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                    title="Supprimer le logo"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">Logo de l'entreprise</label>
                <input type="file" accept="image/*" className="form-control" onChange={handleLogoUpload} />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Format recommandé: Carré ou paysage, max 1 Mo.</p>
              </div>
            </div>
            
            <div className="form-group">
              <label className="form-label">Nom de l'entreprise</label>
              <input type="text" className="form-control" value={settings.companyName || ''} onChange={e => setSettings({...settings, companyName: e.target.value})} required />
            </div>
            
            <div className="form-group">
              <label className="form-label">Adresse</label>
              <textarea className="form-control" rows="2" value={settings.address || ''} onChange={e => setSettings({...settings, address: e.target.value})}></textarea>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">RCCM</label>
                <input type="text" className="form-control" value={settings.rccm || ''} onChange={e => setSettings({...settings, rccm: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">NIF / IFU</label>
                <input type="text" className="form-control" value={settings.nif || ''} onChange={e => setSettings({...settings, nif: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Boîte Postale (BP)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: BP 1245 Bobo-dioulasso" 
                value={settings.bp || ''} 
                onChange={e => setSettings({...settings, bp: e.target.value})} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Division / Direction</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: Division des Grandes Entreprises" 
                value={settings.division || ''} 
                onChange={e => setSettings({...settings, division: e.target.value})} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Régime Fiscal</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: Réel Normal d'Imposition" 
                value={settings.taxSystem || ''} 
                onChange={e => setSettings({...settings, taxSystem: e.target.value})} 
              />
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Téléphone</label>
                <input type="text" className="form-control" value={settings.phone || ''} onChange={e => setSettings({...settings, phone: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input type="email" className="form-control" value={settings.email || ''} onChange={e => setSettings({...settings, email: e.target.value})} />
              </div>
            </div>
            
            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">NIF / IFU</label>
                <input type="text" className="form-control" value={settings.nif || ''} onChange={e => setSettings({...settings, nif: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">RCCM</label>
                <input type="text" className="form-control" value={settings.rccm || ''} onChange={e => setSettings({...settings, rccm: e.target.value})} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Site Web</label>
              <input type="text" className="form-control" placeholder="www.exemple.com" value={settings.website || ''} onChange={e => setSettings({...settings, website: e.target.value})} />
            </div>
          </div>

          {/* Préférences Impression & Globales */}
          <div className="content-card">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="stat-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                <Printer size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Impression & Devises</h3>
            </div>

            <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Symbole Monétaire (ex: FCFA, $)</label>
                <input type="text" className="form-control" value={settings.currency || ''} onChange={e => setSettings({...settings, currency: e.target.value})} />
              </div>

              <div className="form-group">
                <label className="form-label">Taux de TVA (%)</label>
                <input type="number" onKeyDown={(e) => { if(e.key.length === 1 && !/^[0-9.]$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }} min="0" 
                  step="0.01"
                  className="form-control" 
                  value={settings.tvaRate || 18} 
                  onChange={e => setSettings({...settings, tvaRate: parseFloat(e.target.value) || 0})} 
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Format de reçu par défaut</label>
              <select className="form-control" value={settings.receiptFormat || 'A4'} onChange={e => setSettings({...settings, receiptFormat: e.target.value})}>
                <option value="A4">A4 (Standard)</option>
                <option value="A5">A5 (Moyen)</option>
                <option value="Thermique">Ticket Thermique (80mm)</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', margin: 0, width: '100%' }}>
                <input 
                  type="checkbox" 
                  checked={!!settings.roundAmounts} 
                  onChange={e => setSettings({...settings, roundAmounts: e.target.checked})} 
                  style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                />
                <div>
                  <span style={{ fontWeight: 'bold', display: 'block', fontSize: '0.95rem' }}>Supprimer automatiquement les décimales des montants</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Exemple : 2500.88 CFA sera affiché 2500 CFA sur les impressions</span>
                </div>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Message de pied de page (Reçus Thermiques)</label>
              <textarea className="form-control" rows="2" placeholder="Merci de votre confiance..." value={settings.footerMessage || ''} onChange={e => setSettings({...settings, footerMessage: e.target.value})}></textarea>
            </div>
          </div>

          {/* Configuration du Pied de Page (Universel - Bandeau Rouge) */}
          <div className="content-card">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="stat-icon" style={{ backgroundColor: '#fef2f2', color: '#b91c1c' }}>
                <Globe size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Pied de Page Universel (Bandeau Rouge)</h3>
            </div>
            
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              Ces informations apparaîtront dans le bandeau rouge en bas de tous vos documents (BC, BL, Factures).
            </p>

            <div className="form-group">
              <label className="form-label">Ligne 1 : Identifiants & Régime Fiscal</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: NS AUTO - RCCM ... - IFU ... - RNI - Direction des Moyennes Entreprises" 
                value={settings.footerLine1 || ''} 
                onChange={e => setSettings({...settings, footerLine1: e.target.value})} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ligne 2 : Adresses & Téléphones</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: 01 BP 1245 Bobo Dioulasso 01 - Secteur 05 - Tél: +226 ..." 
                value={settings.footerLine2 || ''} 
                onChange={e => setSettings({...settings, footerLine2: e.target.value})} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ligne 3 : Contacts Numériques (Email / Web)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: E-mail : contact@nsauto.com - Site web : www.nsauto.com" 
                value={settings.footerLine3 || ''} 
                onChange={e => setSettings({...settings, footerLine3: e.target.value})} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Ligne 4 : Informations Bancaires (RIB)</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: IB bank 001193300101 / ECOBANK N°281753286301 - 74" 
                value={settings.footerLine4 || ''} 
                onChange={e => setSettings({...settings, footerLine4: e.target.value})} 
              />
            </div>

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <div className="form-group">
                <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Préfixe Titre BC (par défaut)</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="ex: BON DE COMMANDE N°NSA-CFAO" 
                  value={settings.bcTitlePrefix || ''} 
                  onChange={e => setSettings({...settings, bcTitlePrefix: e.target.value})} 
                />
              </div>
            </div>
          </div>

          {/* Signatures & Cachet Section */}
          <div className="content-card">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="stat-icon" style={{ backgroundColor: '#eff6ff', color: '#3b82f6' }}>
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Signatures & Cachet (Bons de Commande)</h3>
            </div>

            <div className="form-group">
              <label className="form-label">Nom du Superviseur / Signataire</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: Guy Roland TONDE"
                value={settings.supervisorName || ''} 
                onChange={e => setSettings({...settings, supervisorName: e.target.value})} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Titre / Fonction</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="ex: Superviseur Général"
                value={settings.supervisorTitle || ''} 
                onChange={e => setSettings({...settings, supervisorTitle: e.target.value})} 
              />
            </div>

            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
              <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Signataire - Bordereau de Livraison (BL)</h4>
              <div className="form-group">
                <label className="form-label">Nom du Signataire BL</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="ex: KARFA M Ismael TRAORE"
                  value={settings.blSupervisorName || ''} 
                  onChange={e => setSettings({...settings, blSupervisorName: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Titre / Fonction BL</label>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="ex: Responsable Logistique"
                  value={settings.blSupervisorTitle || ''} 
                  onChange={e => setSettings({...settings, blSupervisorTitle: e.target.value})} 
                />
              </div>

              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Titre par défaut (Bordereau BL)</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="ex: BORDEREAU NSA-" 
                    value={settings.blTitlePrefix || ''} 
                    onChange={e => setSettings({...settings, blTitlePrefix: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
              {/* Stamp Upload */}
              <div>
                <label className="form-label">Cachet (Image PNG)</label>
                <div style={{ 
                  height: '100px', 
                  borderRadius: '8px', 
                  border: '2px dashed var(--border)', 
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc',
                  position: 'relative'
                }}>
                  {settings.stampImage ? (
                    <img src={settings.stampImage} alt="Cachet" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div className="text-muted" style={{ fontSize: '10px' }}>Aucun cachet</div>
                  )}
                  {settings.stampImage && (
                    <button type="button" onClick={() => setSettings({...settings, stampImage: ''})} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer' }}>×</button>
                  )}
                </div>
                <input type="file" accept="image/*" className="form-control" style={{ fontSize: '12px' }} onChange={handleStampUpload} />
              </div>

              {/* Signature Upload */}
              <div>
                <label className="form-label">Signature (Image PNG)</label>
                <div style={{ 
                  height: '100px', 
                  borderRadius: '8px', 
                  border: '2px dashed var(--border)', 
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  backgroundColor: '#f8fafc',
                  position: 'relative'
                }}>
                  {settings.signatureImage ? (
                    <img src={settings.signatureImage} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div className="text-muted" style={{ fontSize: '10px' }}>Aucune signature</div>
                  )}
                  {settings.signatureImage && (
                    <button type="button" onClick={() => setSettings({...settings, signatureImage: ''})} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer' }}>×</button>
                  )}
                </div>
                <input type="file" accept="image/*" className="form-control" style={{ fontSize: '12px' }} onChange={handleSignatureUpload} />
              </div>
            </div>

            {/* BL Specific Images */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '2px solid var(--primary-light)' }}>
              <h4 style={{ margin: '0 0 1.5rem 0', fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Cachet & Signature Spécifiques au BL</h4>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                {/* BL Stamp Upload */}
                <div>
                  <label className="form-label">Cachet BL (Image PNG)</label>
                  <div style={{ 
                    height: '100px', borderRadius: '8px', border: '2px dashed var(--border)', marginBottom: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#f0f9ff', position: 'relative'
                  }}>
                    {settings.blStampImage ? (
                      <img src={settings.blStampImage} alt="Cachet BL" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div className="text-muted" style={{ fontSize: '10px' }}>Aucun cachet BL</div>
                    )}
                    {settings.blStampImage && (
                      <button type="button" onClick={() => setSettings({...settings, blStampImage: ''})} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer' }}>×</button>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="form-control" style={{ fontSize: '12px' }} onChange={handleBLStampUpload} />
                </div>

                {/* BL Signature Upload */}
                <div>
                  <label className="form-label">Signature BL (Image PNG)</label>
                  <div style={{ 
                    height: '100px', borderRadius: '8px', border: '2px dashed var(--border)', marginBottom: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#f0f9ff', position: 'relative'
                  }}>
                    {settings.blSignatureImage ? (
                      <img src={settings.blSignatureImage} alt="Signature BL" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <div className="text-muted" style={{ fontSize: '10px' }}>Aucune signature BL</div>
                    )}
                    {settings.blSignatureImage && (
                      <button type="button" onClick={() => setSettings({...settings, blSignatureImage: ''})} style={{ position: 'absolute', top: 5, right: 5, backgroundColor: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer' }}>×</button>
                    )}
                  </div>
                  <input type="file" accept="image/*" className="form-control" style={{ fontSize: '12px' }} onChange={handleBLSignatureUpload} />
                </div>
              </div>
            </div>
          </div>

          {/* Séquences de Numérotation */}
          <div className="content-card">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="stat-icon" style={{ backgroundColor: '#fef3c7', color: '#d97706' }}>
                <Settings size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Séquences de Numérotation</h3>
            </div>
            
            <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Personnalisez le format des numéros de vos documents. Utilisez : 
              <code style={{ backgroundColor: '#eee', padding: '2px 4px', margin: '0 4px', borderRadius: '4px' }}>{'{ID}'}</code>, 
              <code style={{ backgroundColor: '#eee', padding: '2px 4px', margin: '0 4px', borderRadius: '4px' }}>{'{DATE}'}</code>, 
              <code style={{ backgroundColor: '#eee', padding: '2px 4px', margin: '0 4px', borderRadius: '4px' }}>{'{YEAR}'}</code>, 
              <code style={{ backgroundColor: '#eee', padding: '2px 4px', margin: '0 4px', borderRadius: '4px' }}>{'{CLIENT}'}</code>.
            </p>

            <div className="form-group">
              <label className="form-label">Format BC</label>
              <input type="text" className="form-control" placeholder="ex: BC-{ID}-{DATE}" value={settings.bcNumberFormat || ''} onChange={e => setSettings({...settings, bcNumberFormat: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Format BL</label>
              <input type="text" className="form-control" placeholder="ex: BL-{ID}-{DATE}" value={settings.blNumberFormat || ''} onChange={e => setSettings({...settings, blNumberFormat: e.target.value})} />
            </div>
          </div>

          {/* Maintenance & Sécurité */}
          <div className="content-card">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div className="stat-icon" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                <Shield size={20} />
              </div>
              <h3 style={{ margin: 0 }}>Maintenance & Sécurité</h3>
            </div>

            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Gérez la sauvegarde de vos données et l'entretien du système. Ces actions sont réservées aux administrateurs.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Sauvegarde Complète</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Télécharger toute la base de données (JSON)</div>
                </div>
                <button type="button" onClick={handleBackup} className="btn btn-secondary">
                  <Download size={18} /> Télécharger
                </button>
              </div>

              <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>Nettoyage des Journaux</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Supprimer l'historique d'activité ancien</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select 
                    className="form-control" 
                    style={{ width: 'auto', height: '38px' }}
                    value={cleanupPeriod}
                    onChange={(e) => setCleanupPeriod(e.target.value)}
                  >
                    <option value="1">Plus de 1 jour</option>
                    <option value="7">Plus de 7 jours</option>
                    <option value="30">Plus de 30 jours</option>
                  </select>
                  <button type="button" onClick={handleClearLogs} className="btn btn-danger-outline" style={{ border: '1px solid var(--danger)', color: 'var(--danger)', height: '38px' }}>
                    <Trash2 size={18} /> Nettoyer
                  </button>
                </div>
              </div>

              <div style={{ padding: '1.25rem', border: '2px solid rgba(239, 68, 68, 0.2)', backgroundColor: 'rgba(239, 68, 68, 0.02)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} /> RÉINITIALISATION TOTALE
                  </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Effacer tout l'historique (Ventes, Mouvements, etc.) tout en gardant vos articles et stocks.
                  </div>
                </div>
                <button type="button" onClick={handleResetDatabase} className="btn btn-danger" style={{ whiteSpace: 'nowrap' }}>
                  <Database size={18} /> Réinitialiser la Base
                </button>
              </div>
            </div>
          </div>

          {/* Gestion des Partenaires Virtuels */}
          <div className="content-card" style={{ gridColumn: '1 / -1' }}>
            <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="stat-icon" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                  <Globe size={20} />
                </div>
                <h3 style={{ margin: 0 }}>Magasins Virtuels (Contrats)</h3>
              </div>
              <button type="button" className="btn btn-primary" onClick={() => { setEditingPartner({}); setIsPartnerModalOpen(true); }}>
                <Plus size={18} /> Ajouter un Magasin
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Adresse / Contact</th>
                    <th>BC Prefix</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {p.logo && <img src={p.logo} alt="" style={{ height: '24px', objectFit: 'contain' }} />}
                          {p.name}
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{p.address || 'N/A'}<br/><span className="text-muted">{p.phone || p.email}</span></td>
                      <td><code style={{ fontSize: '0.8rem' }}>{p.bc_prefix}</code></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditingPartner(p); setIsPartnerModalOpen(true); }}>Modifier</button>
                          {p.name !== 'CFAO' && (
                            <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => deletePartner(p.id)}>Supprimer</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {partners.length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }} className="text-muted">Aucun magasin virtuel configuré.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {user?.role === 'admin' && (
          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ padding: '0 3rem', height: '50px', fontSize: '1.1rem', fontWeight: '600' }}>
              <Save size={20} /> {isSubmitting ? 'Enregistrement...' : 'Enregistrer tous les paramètres'}
            </button>
          </div>
        )}
      </form>

      <AlertModal 
        isOpen={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        confirmLabel={alertModal.confirmLabel}
        cancelLabel={alertModal.cancelLabel}
        onConfirm={alertModal.onConfirm}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
      />

      {/* Modal Partenaire */}
      {isPartnerModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3>{editingPartner?.id ? 'Modifier le Magasin' : 'Ajouter un Magasin'}</h3>
              <button className="btn-close" onClick={() => setIsPartnerModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handlePartnerSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto', padding: '1rem' }}>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Nom du Partenaire *</label>
                  <input type="text" name="name" className="form-control" defaultValue={editingPartner?.name || ''} required />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Adresse</label>
                  <input type="text" name="address" className="form-control" defaultValue={editingPartner?.address || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Téléphone</label>
                  <input type="text" name="phone" className="form-control" defaultValue={editingPartner?.phone || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" name="email" className="form-control" defaultValue={editingPartner?.email || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Boîte Postale (BP)</label>
                  <input type="text" name="bp" className="form-control" defaultValue={editingPartner?.bp || ''} placeholder="Ex: 01 BP 23 Ouaga 01, Burkina Faso" />
                </div>
                <div className="form-group">
                  <label className="form-label">Préfixe BC</label>
                  <input type="text" name="bc_prefix" className="form-control" defaultValue={editingPartner?.bc_prefix || 'BON DE COMMANDE N°NSA-CFAO'} />
                </div>
                <div className="form-group">
                  <label className="form-label">Texte En-tête (Document)</label>
                  <input type="text" name="header_text" className="form-control" defaultValue={editingPartner?.header_text || ''} placeholder="Ex: NS AUTO (par défaut)" />
                </div>
                <div className="form-group">
                  <label className="form-label">RCCM Partenaire</label>
                  <input type="text" name="rccm" className="form-control" defaultValue={editingPartner?.rccm || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">NIF / IFU Partenaire</label>
                  <input type="text" name="nif" className="form-control" defaultValue={editingPartner?.nif || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Mon Code Client (chez eux)</label>
                  <input type="text" name="my_client_code" className="form-control" defaultValue={editingPartner?.my_client_code || ''} placeholder="Ex: CLC 03977" />
                </div>

                <div className="form-group">
                  <label className="form-label">Superviseur BC</label>
                  <input type="text" name="supervisor_name" className="form-control" defaultValue={editingPartner?.supervisor_name || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Titre Superviseur BC</label>
                  <input type="text" name="supervisor_title" className="form-control" defaultValue={editingPartner?.supervisor_title || ''} />
                </div>

                <div className="form-group">
                  <label className="form-label">Signataire BL</label>
                  <input type="text" name="bl_supervisor_name" className="form-control" defaultValue={editingPartner?.bl_supervisor_name || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label">Titre Signataire BL</label>
                  <input type="text" name="bl_supervisor_title" className="form-control" defaultValue={editingPartner?.bl_supervisor_title || ''} />
                </div>

                {/* Personnalisation des colonnes */}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #eee', paddingTop: '1.5rem', marginTop: '1rem' }}>
                  <h4 style={{ fontSize: '0.95rem', color: '#2563eb', marginBottom: '1.5rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Libellés des Colonnes (Personnalisation)</h4>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* Colonnes BC */}
                    <div>
                      <h5 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1e40af', backgroundColor: '#eff6ff', padding: '6px 10px', borderRadius: '4px', borderLeft: '3px solid #1e40af' }}>Colonnes Bon de Commande (BC)</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 1 (N°)</label>
                          <input type="text" name="bc_col_no" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_no || 'N°'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 2 (Site)</label>
                          <input type="text" name="bc_col_site" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_site || 'Site'} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 3 (Désignation)</label>
                          <input type="text" name="bc_col_desc" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_desc || 'Désignation / Article'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 4 (Code)</label>
                          <input type="text" name="bc_col_code" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_code || 'Code'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 5 (Référence)</label>
                          <input type="text" name="bc_col_ref" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_ref || 'Ref. CFAO'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 6 (Qté)</label>
                          <input type="text" name="bc_col_qty" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_qty || 'Qté'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 7 (P. HTVA)</label>
                          <input type="text" name="bc_col_price" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_price || 'Prix HTVA (F. CFA)'} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 8 (Total HTVA)</label>
                          <input type="text" name="bc_col_total" className="form-control form-control-sm" defaultValue={editingPartner?.bc_col_total || 'Total HTVA (F. CFA)'} />
                        </div>
                      </div>
                    </div>

                    {/* Colonnes BL */}
                    <div>
                      <h5 style={{ fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '1rem', color: '#b91c1c', backgroundColor: '#fef2f2', padding: '6px 10px', borderRadius: '4px', borderLeft: '3px solid #b91c1c' }}>Colonnes Bordereau (BL)</h5>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 1 (N°)</label>
                          <input type="text" name="bl_col_no" className="form-control form-control-sm" defaultValue={editingPartner?.bl_col_no || 'N°'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 2 (Site)</label>
                          <input type="text" name="bl_col_site" className="form-control form-control-sm" defaultValue={editingPartner?.bl_col_site || 'Site'} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 3 (Désignation)</label>
                          <input type="text" name="bl_col_desc" className="form-control form-control-sm" defaultValue={editingPartner?.bl_col_desc || 'Désignation / Article'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 4 (Code)</label>
                          <input type="text" name="bl_col_code" className="form-control form-control-sm" defaultValue={editingPartner?.bl_col_code || 'Code'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 5 (Référence)</label>
                          <input type="text" name="bl_col_ref" className="form-control form-control-sm" defaultValue={editingPartner?.bl_col_ref || 'Réf. CFAO'} />
                        </div>
                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '0.7rem' }}>Col 6 (Qté)</label>
                          <input type="text" name="bl_col_qty" className="form-control form-control-sm" defaultValue={editingPartner?.bl_col_qty || 'Qté'} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Logos & Signatures */}
                <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #eee', paddingTop: '1rem', marginTop: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '1rem' }}>Logos & Signatures (Spécifiques au Partenaire)</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    {/* Partner Logo */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Logo Partenaire</label>
                      <div style={{ height: '80px', border: '1px dashed #ccc', borderRadius: '4px', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {editingPartner?.logo ? <img src={editingPartner.logo} alt="" style={{ maxHeight: '100%' }} /> : <span style={{ fontSize: '10px', color: '#999' }}>Aucun</span>}
                      </div>
                      <input type="file" accept="image/*" style={{ fontSize: '11px' }} onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setEditingPartner({ ...editingPartner, logo: reader.result });
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </div>

                    {/* BC Stamp */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Cachet BC</label>
                      <div style={{ height: '80px', border: '1px dashed #ccc', borderRadius: '4px', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {editingPartner?.stamp_image ? <img src={editingPartner.stamp_image} alt="" style={{ maxHeight: '100%' }} /> : <span style={{ fontSize: '10px', color: '#999' }}>Par défaut</span>}
                      </div>
                      <input type="file" accept="image/*" style={{ fontSize: '11px' }} onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setEditingPartner({ ...editingPartner, stamp_image: reader.result });
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </div>

                    {/* BC Signature */}
                    <div>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>Signature BC</label>
                      <div style={{ height: '80px', border: '1px dashed #ccc', borderRadius: '4px', marginBottom: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {editingPartner?.signature_image ? <img src={editingPartner.signature_image} alt="" style={{ maxHeight: '100%' }} /> : <span style={{ fontSize: '10px', color: '#999' }}>Par défaut</span>}
                      </div>
                      <input type="file" accept="image/*" style={{ fontSize: '11px' }} onChange={(e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setEditingPartner({ ...editingPartner, signature_image: reader.result });
                          reader.readAsDataURL(file);
                        }
                      }} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPartnerModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
