'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { Calendar, Lock, Unlock, Download, AlertTriangle, FileText, Trash2 } from 'lucide-react';
import AlertModal from '../../components/AlertModal';

export default function ExercicesPage() {
  const [exercises, setExercises] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const [showNewForm, setShowNewForm] = useState(false);
  const [newEx, setNewEx] = useState({ name: `Exercice ${new Date().getFullYear()}`, startDate: new Date().toISOString().split('T')[0] });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const exData = await storage.get('fiscal-years');
      const repData = await storage.get('annual-reports');
      setExercises(exData || []);
      setReports(repData || []);
    } catch (error) {
      console.error("Error loading exercises data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await storage.create('fiscal-years', newEx);
      setShowNewForm(false);
      await loadData();
      showAlert('success', 'Succès', 'Nouvel exercice ouvert.');
    } catch (err) { showAlert('error', 'Erreur', err.message); }
    finally { setLoading(false); }
  };

  const handleCloseYear = () => {
    const active = exercises.find(ex => ex.status === 'active');
    if (!active) return showAlert('error', 'Erreur', 'Aucun exercice actif.');

    showConfirm('Clôturer l\'exercice ?', `La clôture de "${active.name}" archivera les transactions soldées. Continuer ?`, async () => {
      closeAlert();
      setIsClosing(true);
      try {
        await storage.create('fiscal-years/close', {});
        showAlert('success', 'Succès', "L'exercice a été clôturé.");
        await loadData();
      } catch (error) { showAlert('error', 'Erreur', error.message); }
      finally { setIsClosing(false); }
    });
  };

  const activeExercise = exercises.find(ex => ex.status === 'active');
  const pastExercises = exercises.filter(ex => ex.status === 'closed');
  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '-';

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Exercices Fiscaux</h1><p>Clôture annuelle et archivage</p></div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="content-card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Unlock color="var(--success)" /> Exercice Actif</h3>
            {activeExercise ? (
              <button className="btn btn-danger" onClick={handleCloseYear} disabled={isClosing}>{isClosing ? 'Clôture...' : 'Clôturer l\'Année'}</button>
            ) : (
              <button className="btn btn-primary" onClick={() => setShowNewForm(true)}>Ouvrir un Nouvel Exercice</button>
            )}
          </div>

          {showNewForm && (
            <div style={{ marginBottom: '1.5rem', padding: '1.5rem', border: '1px solid var(--primary)', borderRadius: '8px', backgroundColor: '#f9f9ff' }}>
              <h4 style={{ marginTop: 0 }}>Démarrer un nouvel exercice</h4>
              <form onSubmit={handleCreate} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>Nom de l'exercice</label>
                  <input className="input" value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} placeholder="Ex: Exercice 2026" required />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px' }}>Date de début</label>
                  <input type="date" className="input" value={newEx.startDate} onChange={e => setNewEx({...newEx, startDate: e.target.value})} required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={loading}>Valider</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowNewForm(false)}>Annuler</button>
              </form>
            </div>
          )}

          {activeExercise ? (
            <div style={{ padding: '1rem', backgroundColor: 'var(--primary-light)', borderRadius: '8px', display: 'flex', gap: '2rem' }}>
              <div><div className="text-muted">Nom</div><strong>{activeExercise.name}</strong></div>
              <div><div className="text-muted">Ouvert le</div><strong>{formatDate(activeExercise.startDate)}</strong></div>
              <div style={{ marginLeft: 'auto' }}><span className="badge badge-success">OUVERT</span></div>
            </div>
          ) : !showNewForm && <div className="badge-warning" style={{ padding: '1rem', borderRadius: '8px' }}>Aucun exercice actif. Veuillez en ouvrir un pour enregistrer des ventes.</div>}

          <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '0.9rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} /> Rappel :</div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              <li>Les ventes soldées seront archivées.</li>
              <li>Les créances clients sont reportées.</li>
              <li>Un bilan PDF sera généré.</li>
            </ul>
          </div>
        </div>

        <div className="content-card">
          <h3>Bilans PDF</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '1rem' }}>
            {reports.length === 0 ? <p className="text-muted">Aucun bilan.</p> : reports.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <FileText color="var(--danger)" />
                <div style={{ flex: 1 }}><strong>{r.yearName}</strong><div style={{ fontSize: '0.75rem' }}>{formatDate(r.createdAt)}</div></div>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => {
                    const token = sessionStorage.getItem('token');
                    if (!token) {
                      showAlert('error', 'Erreur', 'Votre session a expiré. Veuillez vous reconnecter.');
                      return;
                    }
                    window.open(`/exercices/print/${r.id}`, '_blank');
                  }}
                  title="Télécharger le PDF"
                >
                  <Download size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: '2.5rem' }}>Historique</h3>
      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead><tr><th>Nom</th><th>Ouverture</th><th>Fermeture</th><th>Statut</th><th>Ventes</th></tr></thead>
            <tbody>
              {pastExercises.map(ex => (
                <tr key={ex.id}>
                  <td><strong>{ex.name}</strong></td>
                  <td>{formatDate(ex.startDate)}</td>
                  <td>{formatDate(ex.endDate)}</td>
                  <td><span className="badge badge-secondary">CLOS</span></td>
                  <td>-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
