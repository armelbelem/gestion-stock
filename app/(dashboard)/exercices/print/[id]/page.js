'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { storage } from '../../../../lib/storage';
import { Loader2, Printer } from 'lucide-react';

export default function PrintAnnualReport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const reportData = await storage.get(`annual-reports/${id}`);
        setData(reportData);
        // On attend un court instant que le rendu soit fait avant de lancer l'impression
        setTimeout(() => {
          if (reportData && !reportData.error) {
             window.print();
          }
        }, 800);
      } catch (error) {
        console.error("Error loading report:", error);
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '1rem' }}>
      <Loader2 className="spinner" size={40} color="var(--primary)" />
      <p>Génération du bilan en cours...</p>
    </div>
  );

  if (!data || data.error) return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Erreur lors du chargement du bilan</h2>
      <p>{data?.error || "Le bilan n'a pas pu être récupéré."}</p>
      <button className="btn btn-primary" onClick={() => window.close()}>Fermer la fenêtre</button>
    </div>
  );

  const { 
    exercise = {}, 
    revenue = 0, 
    paid = 0, 
    debt = 0, 
    totalItems = 0, 
    clientStats = [] 
  } = data;

  return (
    <div className="print-report" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', backgroundColor: 'white', color: 'black' }}>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; }
          .print-report { padding: 0 !important; width: 100% !important; max-width: 100% !important; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
        }
      `}</style>
      
      <div style={{ textAlign: 'center', borderBottom: '2px solid #333', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>MINING AUTOLOG ERP</h1>
        <p style={{ margin: '5px 0', fontSize: '14px', color: '#666' }}>SYSTÈME DE GESTION DE STOCK ET FINANCES</p>
        <div style={{ marginTop: '1rem', display: 'inline-block', padding: '5px 15px', border: '1px solid #333', borderRadius: '4px', fontWeight: 700 }}>
          BILAN ANNUEL DÉTAILLÉ
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div>
          <div style={{ color: '#666', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Exercice</div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>{exercise.name}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ color: '#666', fontSize: '12px', textTransform: 'uppercase', marginBottom: '4px' }}>Période</div>
          <div style={{ fontWeight: 600 }}>Du {new Date(exercise.startDate).toLocaleDateString()} au {new Date(exercise.endDate).toLocaleDateString()}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
        <div style={{ backgroundColor: '#f0f9ff', padding: '1.5rem', borderRadius: '8px', border: '1px solid #bae6fd' }}>
          <div style={{ color: '#0369a1', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Volume d'activité</div>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{totalItems.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 400 }}>articles vendus</span></div>
        </div>
        <div style={{ backgroundColor: '#f0fdf4', padding: '1.5rem', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <div style={{ color: '#15803d', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Chiffre d'Affaires</div>
          <div style={{ fontSize: '24px', fontWeight: 800 }}>{revenue.toLocaleString()} <span style={{ fontSize: '14px', fontWeight: 400 }}>FCFA</span></div>
        </div>
      </div>

      <div style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ fontSize: '16px', borderBottom: '1px solid #eee', paddingBottom: '8px', marginBottom: '1rem' }}>RÉCAPITULATIF PAR CLIENT</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left' }}>
              <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0' }}>Nom du Client</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'center' }}>Articles Achetés</th>
              <th style={{ padding: '12px', borderBottom: '2px solid #e2e8f0', textAlign: 'right' }}>Montant Total</th>
            </tr>
          </thead>
          <tbody>
            {clientStats.map((c, i) => (
              <tr key={i}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>{c.clientName}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>{c.totalItems || 0}</td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontWeight: 600 }}>{c.totalAmount.toLocaleString()} FCFA</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 800, backgroundColor: '#f8fafc' }}>
              <td style={{ padding: '12px' }}>TOTAL GÉNÉRAL</td>
              <td style={{ padding: '12px', textAlign: 'center' }}>{totalItems.toLocaleString()}</td>
              <td style={{ padding: '12px', textAlign: 'right' }}>{revenue.toLocaleString()} FCFA</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ backgroundColor: '#fef2f2', padding: '1.5rem', borderRadius: '8px', border: '1px solid #fee2e2', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#991b1b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase' }}>Situation des Paiements</div>
            <div style={{ fontSize: '14px', color: '#7f1d1d' }}>Total encaissé : {paid.toLocaleString()} FCFA</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#991b1b', fontSize: '12px', fontWeight: 700 }}>RESTE À RECOUVRER</div>
            <div style={{ fontSize: '24px', fontWeight: 900, color: '#b91c1c' }}>{debt.toLocaleString()} FCFA</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '4rem' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '4rem', fontSize: '14px', fontWeight: 600 }}>Le Comptable / Responsable</div>
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '10px', fontSize: '12px', color: '#666' }}>Signature et Cachet</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '4rem', fontSize: '14px', fontWeight: 600 }}>La Direction</div>
          <div style={{ borderTop: '1px solid #ccc', paddingTop: '10px', fontSize: '12px', color: '#666' }}>Signature et Cachet</div>
        </div>
      </div>

      <div style={{ marginTop: '5rem', textAlign: 'center', fontSize: '11px', color: '#999', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
        Ce document est un bilan financier officiel généré par Mining AutoLog.<br />
        Généré le {new Date().toLocaleString('fr-FR')}
      </div>

      <div className="no-print" style={{ marginTop: '3rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={18} /> Imprimer ce bilan
        </button>
        <button className="btn btn-secondary" onClick={() => window.close()}>
          Fermer la fenêtre
        </button>
      </div>
    </div>
  );
}
