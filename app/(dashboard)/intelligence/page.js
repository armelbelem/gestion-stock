'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  Brain, BarChart3, TrendingUp, AlertTriangle, 
  Info, Users, Package, Calendar, Store, ArrowDownRight, ArrowUpRight, TrendingDown
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts';

export default function IntelligencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadIntelligenceData();
  }, []);

  const loadIntelligenceData = async () => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('selectedStore') || '';
      const res = await storage.get(`reports/intelligence${storeId ? `?storeId=${storeId}` : ''}`);
      setData(res);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des analyses décisionnelles.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="page"><p>Analyse des données en cours...</p></div>;
  if (error) return <div className="page text-danger"><p>{error}</p></div>;

  const pareto80 = data.pareto.filter(a => a.cumulativePercentage <= 81);
  const churnRisks = data.churnRisks;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Intelligence Analytique</h1>
          <p>Analyse décisionnelle et détection de tendances</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Pareto Summary Card */}
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{pareto80.length}</div>
          <div className="stat-label">Articles "Classe A" (80% du CA)</div>
          <div style={{ fontSize: '0.75rem', marginTop: '10px', color: 'var(--text-muted)' }}>
            Ces {pareto80.length} articles génèrent la majorité de vos revenus.
          </div>
        </div>

        {/* Churn Summary Card */}
        <div className="stat-card">
          <div className="stat-value" style={{ color: churnRisks.length > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {churnRisks.length}
          </div>
          <div className="stat-label">Clients en baisse de consommation</div>
          <div style={{ fontSize: '0.75rem', marginTop: '10px', color: 'var(--text-muted)' }}>
            Clients ayant chuté de {'>'}30% par rapport à leur moyenne.
          </div>
        </div>
      </div>

      {/* BLOC DE CONSEILS STRATÉGIQUES */}
      <div className="content-card" style={{ marginTop: '2rem', borderLeft: '5px solid var(--primary)', backgroundColor: 'var(--primary-light)' }}>
        <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Brain size={20} className="text-primary" /> Recommandations Stratégiques
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          <div className="advice-item">
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>🎯 Priorité Stock</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Vos <strong>{pareto80.length} meilleurs articles</strong> génèrent 80% de vos revenus. 
              Vérifiez quotidiennement leur disponibilité. Ne les laissez jamais tomber sous le stock de sécurité.
            </p>
          </div>
          
          <div className="advice-item">
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>📈 Tendance d'Activité</h4>
            {data.seasonality.length >= 2 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {(() => {
                  const last = data.seasonality[data.seasonality.length - 1].revenue;
                  const prev = data.seasonality[data.seasonality.length - 2].revenue;
                  const diff = prev > 0 ? ((last - prev) / prev * 100).toFixed(1) : 0;
                  return last > prev 
                    ? `Votre CA est en hausse de ${diff}% par rapport au mois dernier. Continuez sur cette lancée !`
                    : `Votre CA a baissé de ${Math.abs(diff)}% ce mois-ci. Vérifiez si vos articles vedettes sont bien en stock.`;
                })()}
              </p>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Analyse de tendance en cours (attente de données sur 2 mois).</p>
            )}
          </div>

          <div className="advice-item">
            <h4 style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>🤝 Relation Client</h4>
            {churnRisks.length > 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                <strong>{churnRisks.length} clients importants</strong> réduisent leurs achats. 
                Une relance commerciale est conseillée pour comprendre leurs besoins.
              </p>
            ) : (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Excellente fidélité : aucun client majeur n'a réduit sa consommation ce mois-ci.</p>
            )}
          </div>
        </div>
      </div>

      {/* PRÉVISIONS DE RUPTURE (BURN RATE) */}
      <div className="content-card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingDown size={20} className="text-danger" /> Prévisions de Rupture de Stock (Temps Restant)
        </h3>
        <div className="dashboard-grid">
          {data.stockOut.slice(0, 4).map(item => {
            const isUrgent = item.daysRemaining <= 7;
            const isWarning = item.daysRemaining <= 15;
            return (
              <div key={item.id} className={`stat-card ${isUrgent ? 'alert-pulse' : ''}`} style={{ borderTop: `4px solid ${isUrgent ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--success)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                   <div style={{ fontSize: '0.9rem', fontWeight: 700, maxWidth: '70%' }}>{item.name}</div>
                   <div className={`badge ${isUrgent ? 'badge-danger' : isWarning ? 'badge-warning' : 'badge-success'}`}>
                     {item.daysRemaining} jours
                   </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div>Stock: <strong>{item.currentStock}</strong></div>
                  <div>Vente/jour: <strong>{Number(item.dailyVelocity).toFixed(1)}</strong></div>
                </div>
                {isUrgent && <div style={{ marginTop: '10px', fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 700 }}>⚠️ Ravitaillement urgent !</div>}
              </div>
            );
          })}
        </div>
        {data.stockOut.length === 0 && (
          <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-muted)' }}>Aucune rupture prévue à court terme pour vos articles actifs.</p>
        )}
      </div>

      <div className="row" style={{ display: 'flex', gap: '2rem', marginTop: '2rem', flexWrap: 'wrap' }}>
        {/* Graphique de Pareto */}
        <div className="content-card" style={{ flex: '1 1 600px' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={20} /> Analyse de Pareto (Loi 80/20)
          </h3>
          <div style={{ height: '400px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.pareto.slice(0, 15)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={100} />
                <YAxis yAxisId="left" label={{ value: 'Revenu (FCFA)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} label={{ value: 'Cumul %', angle: 90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="revenue" name="Chiffre d'Affaires" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="cumulativePercentage" name="Pourcentage Cumulé" stroke="var(--danger)" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="alert alert-info" style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
            <Info size={20} />
            <p style={{ fontSize: '0.85rem' }}>
              <strong>Conseil stratégique :</strong> Les articles à gauche sont vos produits critiques. Assurez-vous que leur <strong>stock minimum</strong> est toujours suffisant pour éviter une perte de CA importante.
            </p>
          </div>
        </div>

        {/* Analyse de Saisonnalité */}
        <div className="content-card" style={{ flex: '1 1 400px' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={20} /> Saisonnalité (Tendances Mensuelles)
          </h3>
          <div style={{ height: '400px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.seasonality}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" name="CA Mensuel" stroke="var(--success)" fill="var(--success-light)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alertes Churn Clients */}
      <div className="content-card" style={{ marginTop: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--danger)' }}>
          <AlertTriangle size={20} /> Alerte : Chute de Consommation Client
        </h3>
        {churnRisks.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Moyenne (3 derniers mois)</th>
                  <th>Ce mois-ci</th>
                  <th>Baisse (%)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {churnRisks.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{Math.round(c.avgLast3Months).toLocaleString()} FCFA</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{Math.round(c.currentMonth).toLocaleString()} FCFA</td>
                    <td>
                      <span className="badge badge-danger" style={{ display: 'flex', alignItems: 'center', width: 'fit-content', gap: '4px' }}>
                        <ArrowDownRight size={14} /> {Math.round(c.dropPercentage)}%
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => window.location.href = `/reports/client?clientId=${c.id}`}>
                        Voir Détails
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--success)' }}>
            Tous vos clients conservent un rythme de consommation stable.
          </p>
        )}
      </div>
    </div>
  );
}
