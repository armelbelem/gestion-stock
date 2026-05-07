'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, FileText, Download, Trash2, Eye, 
  Upload, X, Filter, Folder, Calendar, File, CheckCircle2
} from 'lucide-react';
import { storage } from '../../lib/storage';
import AlertModal from '../../components/AlertModal';

export default function ArchivesPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Tous');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadData, setUploadData] = useState({ name: '', category: 'Factures', notes: '', file: null });
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const categories = ['Tous', 'Factures', 'Contrats', 'Administratif', 'Rapports', 'Autre'];

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false }));

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents', {
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDocuments(data);
    } catch (err) {
      console.error(err);
      showAlert('error', 'Erreur', 'Impossible de charger les documents');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setUploadData({ ...uploadData, file, name: file.name.split('.')[0] });
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', uploadData.file);
    formData.append('name', uploadData.name);
    formData.append('category', uploadData.category);
    formData.append('notes', uploadData.notes);

    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` },
        body: formData
      });
      if (!res.ok) throw new Error('Échec du téléchargement');
      
      setIsUploadModalOpen(false);
      setUploadData({ name: '', category: 'Factures', notes: '', file: null });
      loadDocuments();
      showAlert('success', 'Succès', 'Document archivé avec succès !');
    } catch (err) {
      showAlert('error', 'Erreur', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (doc.notes && doc.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = categoryFilter === 'Tous' || doc.category === categoryFilter;
    
    const docDate = new Date(doc.uploadedAt);
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;
    if (start) start.setHours(0,0,0,0);
    if (end) end.setHours(23,59,59,999);
    
    const matchesDate = (!start || docDate >= start) && (!end || docDate <= end);
    
    return matchesSearch && matchesCategory && matchesDate;
  });

  const getFileIcon = (type) => {
    if (type?.includes('pdf')) return <FileText className="text-danger" size={24} />;
    if (type?.includes('image')) return <Eye className="text-primary" size={24} />;
    return <File className="text-muted" size={24} />;
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDelete = (id) => {
    setAlertModal({
      open: true,
      type: 'confirm',
      title: 'Supprimer le document ?',
      message: 'Voulez-vous vraiment supprimer définitivement ce document de vos archives ? Cette action est irréversible.',
      onConfirm: async () => {
        closeAlert();
        try {
          const res = await fetch(`/api/documents?id=${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('token')}` }
          });
          if (!res.ok) throw new Error('Échec de la suppression');
          loadDocuments();
          showAlert('success', 'Supprimé', 'Document supprimé avec succès');
        } catch (err) {
          showAlert('error', 'Erreur', err.message);
        }
      }
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Archives Numériques</h1>
          <p>Gestion et stockage de vos documents numérisés</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsUploadModalOpen(true)}>
          <Plus size={16} /> Nouveau Document
        </button>
      </div>

      <div className="content-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0, position: 'relative', flex: '1 1 300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-control" 
              placeholder="Rechercher par nom ou note..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Filter size={18} className="text-muted" />
            <select 
              className="form-control" 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Calendar size={18} className="text-muted" />
            <input 
              type="date" 
              className="form-control" 
              value={dateRange.start} 
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              style={{ width: '150px' }}
            />
            <span className="text-muted">au</span>
            <input 
              type="date" 
              className="form-control" 
              value={dateRange.end} 
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              style={{ width: '150px' }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>Chargement...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {filteredDocs.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', backgroundColor: 'var(--card-bg)', borderRadius: '12px' }}>
              <Folder size={48} className="text-muted" style={{ marginBottom: '1rem' }} />
              <p>Aucun document trouvé.</p>
            </div>
          ) : (
            filteredDocs.map(doc => (
              <div key={doc.id} className="content-card document-card" style={{ padding: '1.5rem', position: 'relative', transition: 'transform 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: 'var(--bg-faint)', borderRadius: '12px' }}>
                    {getFileIcon(doc.fileType)}
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.4rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)' }}>{doc.name}</h3>
                    <span className="badge badge-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>{doc.category}</span>
                  </div>
                </div>
                
                <div style={{ marginTop: '1.25rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <Calendar size={14} />
                    {new Date(doc.uploadedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <File size={14} />
                    {formatSize(doc.fileSize)}
                  </div>
                </div>

                {doc.notes && (
                  <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border-light)', paddingTop: '0.75rem', lineHeight: '1.4' }}>
                    {doc.notes}
                  </p>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                  <button className="btn btn-secondary btn-sm" style={{ flex: 1, padding: '8px 0' }} onClick={() => setPreviewDoc(doc)}>
                    <Eye size={16} /> Voir
                  </button>
                  <a href={doc.filePath} download={doc.name} className="btn btn-secondary btn-sm" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 0' }}>
                    <Download size={16} /> Charger
                  </a>
                  <button className="btn btn-danger-outline btn-sm" style={{ padding: '8px 12px' }} onClick={() => handleDelete(doc.id)} title="Supprimer">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isUploadModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Archiver un document</h3>
              <button className="modal-close" onClick={() => setIsUploadModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <div className="upload-zone" style={{ border: '2px dashed var(--border)', borderRadius: '12px', padding: '2rem', textAlign: 'center', marginBottom: '1.5rem', position: 'relative' }}>
                  <input 
                    type="file" 
                    onChange={handleFileChange} 
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    required 
                  />
                  {uploadData.file ? (
                    <div className="text-success">
                      <CheckCircle2 size={40} style={{ marginBottom: '0.5rem' }} />
                      <p style={{ fontWeight: 600 }}>{uploadData.file.name}</p>
                      <span style={{ fontSize: '0.8rem' }}>{formatSize(uploadData.file.size)}</span>
                    </div>
                  ) : (
                    <div>
                      <Upload size={40} className="text-muted" style={{ marginBottom: '0.5rem' }} />
                      <p>Cliquez ou glissez un fichier ici</p>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>PDF, PNG, JPG supportés</span>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Nom du document</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    required 
                    value={uploadData.name} 
                    onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })} 
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Catégorie</label>
                  <select 
                    className="form-control" 
                    value={uploadData.category} 
                    onChange={(e) => setUploadData({ ...uploadData, category: e.target.value })}
                  >
                    {categories.filter(c => c !== 'Tous').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Notes / Mots-clés</label>
                  <textarea 
                    className="form-control" 
                    rows="2" 
                    value={uploadData.notes} 
                    onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                    placeholder="Ex: Facture CFAO - Mars 2026..."
                  ></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsUploadModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isUploading || !uploadData.file}>
                  {isUploading ? 'Téléchargement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewDoc && (
        <div className="modal-overlay" onClick={() => setPreviewDoc(null)}>
          <div className="modal-content" style={{ maxWidth: '90vw', height: '90vh', padding: 0, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '1rem' }}>
              <h3 style={{ margin: 0 }}>{previewDoc.name}</h3>
              <button className="modal-close" onClick={() => setPreviewDoc(null)}><X size={20} /></button>
            </div>
            <div style={{ flex: 1, backgroundColor: '#f0f0f0', position: 'relative' }}>
              {previewDoc.fileType.includes('pdf') ? (
                <iframe src={previewDoc.filePath} style={{ width: '100%', height: '100%', border: 'none' }}></iframe>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <img src={previewDoc.filePath} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .document-card:hover {
          transform: translateY(-4px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary);
        }
        .upload-zone:hover {
          background-color: var(--bg-faint);
          border-color: var(--primary);
        }
      `}</style>

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
