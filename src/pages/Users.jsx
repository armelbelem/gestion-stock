import React, { useState, useEffect } from 'react';
import { storage } from '../store/storage';
import { UserPlus, Trash2, Shield, User, Key, CheckCircle, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AlertModal from '../components/AlertModal';

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [stores, setStores] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'vendeur',
    storeId: ''
  });
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
    const data = await storage.get('users');
    setUsers(data);
  };

  const loadStores = async () => {
    const data = await storage.get('stores');
    setStores(data);
    if (data.length > 0 && !formData.storeId) {
      setFormData(prev => ({ ...prev, storeId: data[0].id }));
    }
  };

  const handleOpenModal = () => {
    setFormData({ 
      username: '', 
      password: '', 
      role: 'vendeur', 
      storeId: stores.length > 0 ? stores[0].id : '' 
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password || !formData.storeId) {
      showAlert('error', 'Erreur', "Veuillez remplir tous les champs (y compris le magasin)");
      return;
    }

    setIsSubmitting(true);
    try {
      await storage.create('users', formData);
      showAlert('success', 'Succès', "Utilisateur créé avec succès");
      setIsModalOpen(false);
      loadUsers();
    } catch (error) {
      showAlert('error', 'Erreur', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id) => {
    if (id === currentUser.id) {
      showAlert('error', 'Erreur', "Vous ne pouvez pas supprimer votre propre compte");
      return;
    }

    showConfirm(
      "Confirmation",
      "Êtes-vous sûr de vouloir supprimer cet utilisateur ?",
      async () => {
        closeAlert();
        try {
          await storage.remove('users', id);
          showAlert('success', 'Succès', "Utilisateur supprimé");
          loadUsers();
        } catch (error) {
          showAlert('error', 'Erreur', error.message);
        }
      }
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Gestion des Utilisateurs</h1>
          <p>Gérez les accès Administrateur et Vendeur</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenModal}>
          <UserPlus size={18} /> Nouvel Utilisateur
        </button>
      </div>

      <div className="content-card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Magasin</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div className="avatar" style={{ 
                        width: '32px', 
                        height: '32px', 
                        fontSize: '0.8rem',
                        backgroundColor: u.role === 'admin' ? 'var(--primary)' : 'var(--success)'
                      }}>
                        {u.username[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{u.username}</span>
                      {u.id === currentUser.id && <span className="badge badge-secondary">Vous</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-primary' : 'badge-success'}`}>
                      {u.role === 'admin' ? 'Administrateur' : u.role === 'gestionnaire' ? 'Gestionnaire' : 'Vendeur'}
                    </span>
                  </td>
                  <td>
                    <span className="text-muted" style={{ fontSize: '0.9rem' }}>
                      {u.storeName || 'Magasin inconnu'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="text-danger" 
                        style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        onClick={() => handleDelete(u.id)}
                        disabled={u.id === currentUser.id}
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3><UserPlus size={20} className="text-primary" /> Nouvel Utilisateur</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Nom d'utilisateur</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ paddingLeft: '35px' }}
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    placeholder="Ex: jean_dupont"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <Key size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="password" 
                    className="form-control" 
                    style={{ paddingLeft: '35px' }}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Rôle</label>
                <div style={{ position: 'relative' }}>
                  <Shield size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <select 
                    className="form-control" 
                    style={{ paddingLeft: '35px' }}
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                  >
                    <option value="vendeur">Vendeur</option>
                    <option value="gestionnaire">Gestionnaire de magasin</option>
                    <option value="admin">Administrateur Global</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Magasin d'affectation</label>
                <div style={{ position: 'relative' }}>
                  <CheckCircle size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <select 
                    className="form-control" 
                    style={{ paddingLeft: '35px' }}
                    value={formData.storeId}
                    onChange={(e) => setFormData({...formData, storeId: e.target.value})}
                    required
                  >
                    <option value="" disabled>Sélectionnez un magasin</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Création...' : 'Créer l\'utilisateur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal d'alerte/confirmation */}
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

export default Users;
