'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { storage } from '../lib/storage';
import { useAuth } from '../providers';
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [publicSettings, setPublicSettings] = useState(null);
  const router = useRouter();
  const { login } = useAuth();
  
  React.useEffect(() => {
    const fetchBranding = async () => {
      try {
        const response = await fetch('/api/public/settings');
        if (response.ok) {
          const data = await response.json();
          setPublicSettings(data);
        }
      } catch (e) { console.error(e); }
    };
    fetchBranding();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await storage.login(username, password);
      login(data);
      if (data.user.role === 'vendeur' || data.user.role === 'vendeurs') {
        router.push('/sales');
      } else {
        router.push('/');
      }
    } catch (err) {
      setError(err.message || 'Identifiants invalides');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          {publicSettings?.logo ? (
            <img src={publicSettings.logo} alt="Logo" style={{ maxWidth: '140px', marginBottom: '1.5rem', display: 'inline-block' }} />
          ) : (
            <div style={{
              width: '60px',
              height: '60px',
              backgroundColor: 'var(--primary-light)',
              color: 'var(--primary)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.25rem auto'
            }}>
              <Lock size={28} />
            </div>
          )}
          
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
            {publicSettings?.companyName ? (
              <>
                <span style={{color: '#991b1b'}}>{publicSettings.companyName.replace('SARL', 'PART').split(' ').slice(0, 2).join(' ')}</span> {publicSettings.companyName.replace('SARL', 'PART').split(' ').slice(2).join(' ')}
              </>
            ) : (
              <span style={{color: '#991b1b'}}>NS AUTO PART</span>
            )}
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Accédez à votre logiciel</p>
        </div>

        {error && (
          <div className="badge-danger" style={{
            padding: '0.875rem',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.875rem'
          }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Nom d'utilisateur</label>
            <div style={{ position: 'relative' }}>
              <User size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.75rem' }}>
            <label className="form-label">Mot de passe</label>
            <div style={{ position: 'relative' }}>
              <Lock size={18} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="password"
                className="form-control"
                style={{ paddingLeft: '40px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', height: '46px', fontSize: '0.95rem' }}
            disabled={loading}
          >
            {loading ? <Loader2 className="spinner" size={20} /> : 'Se connecter'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          solution ERP V1.1
        </div>
      </div>
    </div>
  );
}
