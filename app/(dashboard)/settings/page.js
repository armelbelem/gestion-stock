'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Settings, Save, Building2, Printer, Globe, ShieldCheck, Database, Trash2, Shield, Download } from 'lucide-react';
import { useAuth } from '../../providers';
import AlertModal from '../../components/AlertModal';

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState({
    companyName: '', address: '', phone: '', email: '',
    nif: '', rccm: '', logo: '', currency: 'FCFA',
    footerMessage: '', receiptFormat: 'A4'
  });
  const [cleanupPeriod, setCleanupPeriod] = useState('30');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '' });

  useEffect(() => {
    loadSettings();
  }, []);

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
    if (!confirm(`Voulez-vous vraiment supprimer les journaux d'activité de plus de ${periodLabel} ? Cette action est irréversible.`)) return;
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
                <label className="form-label">NIF</label>
                <input type="text" className="form-control" value={settings.nif || ''} onChange={e => setSettings({...settings, nif: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">RCCM</label>
                <input type="text" className="form-control" value={settings.rccm || ''} onChange={e => setSettings({...settings, rccm: e.target.value})} />
              </div>
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

            <div className="form-group">
              <label className="form-label">Symbole Monétaire (ex: FCFA, $)</label>
              <input type="text" className="form-control" value={settings.currency || ''} onChange={e => setSettings({...settings, currency: e.target.value})} />
            </div>

            <div className="form-group">
              <label className="form-label">Format de reçu par défaut</label>
              <select className="form-control" value={settings.receiptFormat || 'A4'} onChange={e => setSettings({...settings, receiptFormat: e.target.value})}>
                <option value="A4">A4 (Standard)</option>
                <option value="A5">A5 (Moyen)</option>
                <option value="Thermique">Ticket Thermique (80mm)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Message de pied de page (Reçus)</label>
              <textarea className="form-control" rows="3" placeholder="Merci de votre confiance..." value={settings.footerMessage || ''} onChange={e => setSettings({...settings, footerMessage: e.target.value})}></textarea>
            </div>

            {user?.role === 'admin' && (
              <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting} style={{ width: '100%', height: '48px', fontSize: '1rem' }}>
                  <Save size={20} /> {isSubmitting ? 'Enregistrement...' : 'Enregistrer les paramètres'}
                </button>
              </div>
            )}
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
            </div>
          </div>
        </div>
      </form>

      <AlertModal 
        isOpen={alertModal.open}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal({ ...alertModal, open: false })}
      />
    </div>
  );
}
