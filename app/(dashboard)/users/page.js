'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { UserPlus, Trash2, User, Edit2, X, Search } from 'lucide-react';
import { useAuth } from '../../providers';
import AlertModal from '../../components/AlertModal';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [accessError, setAccessError] = useState(null);
  const [formData, setFormData] = useState({
    username: '', password: '', role: 'vendeur', storeId: 'all'
  });
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [alertModal, setAlertModal] = useState({ open: false, type: 'info', title: '', message: '', onConfirm: null });
  const closeAlert = () => setAlertModal(prev => ({ ...prev, open: false, onConfirm: null }));
  const showAlert = (type, title, message) => setAlertModal({ open: true, type, title, message, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setAlertModal({ open: true, type: 'confirm', title, message, onConfirm });

  useEffect(() => {
    loadUsers();
    loadStores();
  }, []);

  const loadUsers = async () => {
    try {
      setAccessError(null);
      const data = await storage.get('users');
      setUsers(data);
    } catch (err) { 
      setAccessError(err.message);
    }
  };

  const loadStores = async () => {
    try {
      const data = await storage.get('stores');
      setStores(data);
    } catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || (!editingId && !formData.password)) {
      return showAlert('error', 'Erreur', "Champs requis manquants");
    }
    // Convertir 'all' en null pour la BD (NULL = accès tous magasins, compatible avec la FK)
    const dataToSend = { ...formData, storeId: formData.storeId === 'all' ? null : formData.storeId };
    setIsSubmitting(true);
    try {
      if (editingId) {
        await storage.update('users', editingId, dataToSend);
        showAlert('success', 'Succès', "Utilisateur mis à jour !");
      } else {
        await storage.create('users', dataToSend);
        showAlert('success', 'Succès', "Utilisateur créé !");
      }
      setIsModalOpen(false);
      setEditingId(null);
      loadUsers();
    } catch (err) { showAlert('error', 'Erreur', err.message); }
    finally { setIsSubmitting(false); }
  };

  const handleEdit = (u) => {
    setEditingId(u.id);
    setFormData({
      username: u.username,
      password: '', 
      role: u.role,
      storeId: u.storeId === null || u.storeId === undefined ? 'all' : u.storeId
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    if (id === currentUser?.id) return showAlert('error', 'Erreur', "Suppression de soi-même interdite.");
    showConfirm("Confirmation", "Supprimer cet utilisateur ?", async () => {
      closeAlert();
      try {
        await storage.remove('users', id);
        showAlert('success', 'Succès', "Utilisateur supprimé");
        loadUsers();
      } catch (err) { showAlert('error', 'Erreur', err.message); }
    });
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Utilisateurs</h1><p>Gestion des accès et rôles</p></div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData({username:'', password:'', role:'vendeur', storeId: 'all'}); setIsModalOpen(true); }}><UserPlus size={18} /> Nouveau</button>
      </div>

      <div className="toolbar" style={{ marginBottom: '1.5rem' }}>
        <div className="search-input-wrapper" style={{ maxWidth: '350px' }}>
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Rechercher par identifiant..." 
            className="form-control" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <div className="content-card">
        {accessError ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--danger)' }}>
            <h2>Accès Refusé</h2>
            <p>{accessError}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Magasin</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className="avatar" style={{ width: '32px', height: '32px', backgroundColor: u.role === 'admin' ? 'var(--primary)' : 'var(--success)' }}>{u.username[0].toUpperCase()}</div>
                        <strong>{u.username}</strong> {u.id === currentUser?.id && <span className="badge badge-secondary">Moi</span>}
                      </div>
                    </td>
                    <td><span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-success'}`}>{u.role}</span></td>
                    <td>
                      {u.storeId === null || u.storeId === undefined
                        ? <span className="badge badge-secondary" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white' }}>🌐 Tous les magasins</span>
                        : <span className="text-muted">{u.storeName || '-'}</span>
                      }
                    </td>
                    <td style={{ display: 'flex', gap: '1rem' }}>
                      <button onClick={() => handleEdit(u)} className="text-primary" style={{ background: 'none', border: 'none' }} title="Modifier">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(u.id)} disabled={u.id === currentUser?.id} className="text-danger" style={{ background: 'none', border: 'none' }} title="Supprimer">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header"><h3>{editingId ? 'Modifier l\'utilisateur' : 'Nouvel Utilisateur'}</h3><button className="modal-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Identifiant</label><input type="text" className="form-control" required value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} /></div>
                <div className="form-group">
                  <label className="form-label">{editingId ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe'}</label>
                  <input type="password" className="form-control" required={!editingId} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                </div>
                <div className="form-group"><label className="form-label">Rôle</label><select className="form-control" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                  <option value="vendeur">Vendeur</option><option value="gestionnaire">Gestionnaire</option><option value="gestionnaire2">Gestionnaire 2</option><option value="admin">Admin</option><option value="observateur">Observateur</option>
                </select></div>
                <div className="form-group">
                  <label className="form-label">Magasin</label>
                  <select className="form-control" value={formData.storeId ?? 'all'} onChange={e => setFormData({...formData, storeId: e.target.value})}>
                    <option value="all">🌐 Tous les magasins (accès global)</option>
                    {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>{editingId ? 'Mettre à jour' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.open} type={alertModal.type} title={alertModal.title} message={alertModal.message} onClose={closeAlert} onConfirm={alertModal.onConfirm} />
    </div>
  );
}
