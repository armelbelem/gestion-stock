import React, { useEffect, useState } from 'react';
import { Check, X, AlertTriangle, Info } from 'lucide-react';

/**
 * AlertModal – Design Premium avec Glassmorphism et adaptatif au thème.
 */
const AlertModal = ({
  isOpen,
  type = 'info',
  title,
  message,
  onClose,
  onConfirm,
  confirmLabel,
  cancelLabel,
}) => {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsRendered(true), 10);
    } else {
      setIsRendered(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const config = {
    success: {
      icon: <Check size={44} strokeWidth={3} />,
      bg: 'rgba(16, 185, 129, 0.15)',
      color: '#10b981',
      buttonBg: '#10b981',
      defaultTitle: 'Succès !',
      defaultConfirm: 'Génial',
    },
    error: {
      icon: <X size={44} strokeWidth={3} />,
      bg: 'rgba(239, 68, 68, 0.15)',
      color: '#ef4444',
      buttonBg: '#ef4444',
      defaultTitle: 'Erreur',
      defaultConfirm: 'Fermer',
    },
    warning: {
      icon: <AlertTriangle size={44} strokeWidth={2.5} />,
      bg: 'rgba(245, 158, 11, 0.15)',
      color: '#f59e0b',
      buttonBg: '#f59e0b',
      defaultTitle: 'Attention',
      defaultConfirm: 'Compris',
    },
    info: {
      icon: <Info size={44} strokeWidth={2.5} />,
      bg: 'rgba(59, 130, 246, 0.15)',
      color: '#3b82f6',
      buttonBg: '#3b82f6',
      defaultTitle: 'Information',
      defaultConfirm: 'OK',
    },
    confirm: {
      icon: <AlertTriangle size={44} strokeWidth={2.5} />,
      bg: 'rgba(245, 158, 11, 0.15)',
      color: '#f59e0b',
      buttonBg: '#f59e0b',
      defaultTitle: 'Confirmation',
      defaultConfirm: 'Confirmer',
    },
  };

  const { icon, bg, color, buttonBg, defaultTitle, defaultConfirm } = config[type] || config.info;
  const isConfirm = type === 'confirm';

  return (
    <div 
      className="alert-modal-overlay" 
      onClick={!isConfirm ? onClose : undefined} 
      style={{ 
        zIndex: 20000, 
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(8px)',
        transition: 'opacity 0.3s ease-out',
        opacity: isRendered ? 1 : 0
      }}
    >
      <div
        className="alert-modal-content"
        style={{ 
          width: '420px', 
          backgroundColor: 'var(--surface)',
          color: 'var(--text-main)',
          borderRadius: '24px', 
          textAlign: 'center', 
          padding: '40px 32px',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          transform: isRendered ? 'scale(1)' : 'scale(0.9)',
          transition: 'transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Animated Icon Ring */}
        <div style={{
          position: 'relative',
          width: '100px',
          height: '100px',
          borderRadius: '50%',
          backgroundColor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
          marginBottom: '8px'
        }}>
          {icon}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: `2px solid ${color}`,
            opacity: 0.3,
            transform: 'scale(1.2)'
          }}></div>
        </div>

        {/* Content Section */}
        <div style={{ width: '100%' }}>
          <h2 style={{ 
            margin: '0 0 12px 0', 
            fontSize: '1.75rem', 
            fontWeight: 800,
            color: 'var(--text-main)',
            letterSpacing: '-0.02em'
          }}>
            {title || defaultTitle}
          </h2>

          <div style={{ 
            fontSize: '1.05rem', 
            lineHeight: '1.6',
            color: 'var(--text-muted)',
            fontWeight: 400
          }}>
            {message}
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', width: '100%', marginTop: '8px' }}>
          {isConfirm && (
            <button 
              style={{ 
                flex: 1,
                padding: '14px 24px', 
                fontSize: '1rem', 
                borderRadius: '16px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'transparent',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'background-color 0.2s'
              }} 
              onClick={onClose}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {cancelLabel || 'Annuler'}
            </button>
          )}
          <button
            style={{ 
              flex: 1,
              padding: '14px 24px', 
              minWidth: '140px',
              backgroundColor: buttonBg, 
              color: 'white', 
              border: 'none',
              fontSize: '1rem',
              fontWeight: 700,
              borderRadius: '16px',
              cursor: 'pointer',
              boxShadow: `0 10px 15px -3px ${buttonBg}55`,
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = `0 15px 20px -5px ${buttonBg}77`;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = `0 10px 15px -3px ${buttonBg}55`;
            }}
            onClick={isConfirm ? onConfirm : onClose}
            autoFocus
          >
            {confirmLabel || defaultConfirm}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AlertModal;
