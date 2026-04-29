import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { Calendar, Lock, Unlock, Download, ChevronRight, AlertTriangle, FileText, CheckCircle, Trash2 } from 'lucide-react';
import AlertModal from '../components/AlertModal';

const Exercices = () => {
  const [exercises, setExercises] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
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
      setExercises(exData);
      setReports(repData);
    } catch (error) {
      console.error("Error loading exercises data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseYear = () => {
    const active = exercises.find(ex => ex.status === 'active');
    if (!active) {
      showAlert('error', 'Erreur', 'Aucun exercice actif à clôturer.');
      return;
    }

    showConfirm(
      'Clôturer l\'exercice ?',
      `Attention : La clôture de "${active.name}" archivera toutes les transactions soldées. Les créances clients seront reportées sur la nouvelle année. Cette opération est irréversible.`,
      async () => {
        closeAlert();
        setIsClosing(true);
        try {
          const response = await storage.create('fiscal-years/close', {});
          showAlert('success', 'Succès', response.message || "L'exercice a été clôturé avec succès.");
          await loadData();
        } catch (error) {
          console.error("Error closing year:", error);
          showAlert('error', 'Erreur', error.message || "Une erreur est survenue lors de la clôture.");
        } finally {
          setIsClosing(false);
        }
      }
    );
  };

  const handleDeleteReport = async (reportId) => {
    showConfirm(
      'Confirmer la suppression',
      'Voulez-vous vraiment supprimer ce bilan de l\'interface ? Le fichier physique dans C:\\GestionStock_Bilans ne sera pas supprimé.',
      async () => {
        try {
          console.log(`Attempting to delete report: ${reportId}`);
          await storage.remove('annual-reports', reportId);
          console.log('Report deleted successfully from backend');
          setReports(prev => prev.filter(r => r.id !== reportId));
          closeAlert();
          showAlert('success', 'Supprimé', 'Le bilan a été supprimé de l\'interface.');
        } catch (err) {
          console.error('Failed to delete report:', err);
          showAlert('error', 'Erreur', `Échec de la suppression : ${err.message}`);
        }
      }
    );
  };

  const activeExercise = exercises.find(ex => ex.status === 'active');
  const pastExercises = exercises.filter(ex => ex.status === 'closed');

  const formatDate = (isoString) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Gestion des Exercices</h1>
          <p>Clôture annuelle et archivage des données</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Active Exercise Card */}
        <div className="content-card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Unlock size={20} color="var(--success)" /> Exercice en Cours
            </h3>
            {activeExercise && (
              <button 
                className="btn btn-danger" 
                onClick={handleCloseYear}
                disabled={isClosing}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isClosing ? 'Clôture...' : <Lock size={16} />} Clôturer l'Année
              </button>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
          ) : activeExercise ? (
            <div style={{ display: 'flex', gap: '3rem', padding: '1rem', backgroundColor: 'var(--primary-light)', borderRadius: '8px' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Nom de l'exercice</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-dark)' }}>{activeExercise.name}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Date d'ouverture</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>{formatDate(activeExercise.startDate)}</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <span className="badge badge-success">OUVERT</span>
              </div>
            </div>
          ) : (
            <div className="alert alert-warning">Aucun exercice actif. Veuillez contacter l'administrateur.</div>
          )}

          <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={16} /> Rappel sur la clôture :
            </div>
            <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
              <li>Les ventes entièrement réglées seront archivées et masquées de la vue actuelle.</li>
              <li>Le stock actuel (quantités et prix) est maintenu.</li>
              <li>Les créances clients (restes à payer) sont automatiquement reportées.</li>
              <li>Un bilan financier PDF sera généré et sauvegardé.</li>
            </ul>
          </div>
        </div>

        {/* Quick Stats or Info */}
        <div className="content-card">
          <h3>Bilans Disponibles</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Rapports PDF générés lors des clôtures</p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {reports.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Aucun bilan généré pour le moment.
              </div>
            ) : (
              reports.map(report => (
                <div key={report.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '1rem', 
                  padding: '0.75rem', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '6px' 
                }}>
                  <div style={{ color: 'var(--danger)' }}><FileText size={24} /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{report.yearName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Généré le {formatDate(report.createdAt)}</div>
                  </div>
                  <button className="btn btn-secondary btn-sm" title="Ouvrir le dossier des bilans" onClick={() => showAlert('info', 'Information', 'Le bilan a été sauvegardé dans C:\\GestionStock_Bilans')}>
                    <Download size={16} />
                  </button>
                  <button className="btn btn-danger btn-sm" title="Supprimer de l'interface" onClick={() => handleDeleteReport(report.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <h3 style={{ marginTop: '2.5rem', marginBottom: '1rem' }}>Historique des Exercices</h3>
      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Ouverture</th>
                <th>Fermeture</th>
                <th>Statut</th>
                <th>Ventes Totales</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pastExercises.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Aucun exercice archivé.
                  </td>
                </tr>
              ) : (
                pastExercises.map(ex => {
                  const report = reports.find(r => r.fiscalYearId === ex.id);
                  const summary = report ? JSON.parse(report.summaryData || '{}') : null;
                  return (
                    <tr key={ex.id}>
                      <td style={{ fontWeight: 600 }}>{ex.name}</td>
                      <td>{formatDate(ex.startDate)}</td>
                      <td>{formatDate(ex.endDate)}</td>
                      <td><span className="badge badge-secondary">CLOS</span></td>
                      <td style={{ fontWeight: 700 }}>
                        {summary ? `${summary.totalSales.toLocaleString('fr-FR')} FCFA` : '-'}
                      </td>
                      <td>
                        <button className="btn btn-secondary btn-sm" disabled>
                          Consulter
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
};

export default Exercices;
