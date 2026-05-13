'use client';

import React, { useState, useEffect } from 'react';
import { storage } from '../../lib/storage';
import { 
  Brain, BarChart3, TrendingUp, AlertTriangle, 
  Info, Users, Package, Calendar, Store, ArrowDownRight, ArrowUpRight, TrendingDown,
  Upload, Download
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts';
import { exportToExcel } from '../../utils/excelExport';

export default function IntelligencePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [stores, setStores] = useState([]);
  const [forecastStoreId, setForecastStoreId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredForecastData = forecastData ? forecastData.filter(row => {
    const term = searchTerm.toLowerCase();
    return (
      (row.name && row.name.toLowerCase().includes(term)) ||
      (row.code && String(row.code).toLowerCase().includes(term)) ||
      (row.reference && String(row.reference).toLowerCase().includes(term))
    );
  }) : null;

  useEffect(() => {
    loadIntelligenceData();
  }, []);

  const loadIntelligenceData = async () => {
    setLoading(true);
    try {
      const storeId = localStorage.getItem('selectedStore') || '';
      const res = await storage.get(`reports/intelligence${storeId ? `?storeId=${storeId}` : ''}`);
      setData(res);
      
      try {
        const storesData = await storage.get('stores');
        setStores(storesData || []);
      } catch (err) {
        console.error("Erreur chargement magasins:", err);
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement des analyses décisionnelles.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    try {
      const storeId = forecastStoreId || localStorage.getItem('selectedStore') || '';
      
      const res = await fetch('/api/reports/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('token')}`
        },
        body: JSON.stringify({ fetchAll: true, storeId })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Erreur lors du calcul des prévisions");
      }

      const forecastResults = await res.json();
      setForecastData(forecastResults);
    } catch (err) {
      console.error(err);
      alert(err.message || "Erreur lors de la génération du rapport.");
    } finally {
      setIsGeneratingAll(false);
    }
  };


  const handleExportForecast = () => {
    if (!forecastData || forecastData.length === 0) return;
    
    const selectedStore = stores.find(s => String(s.id) === String(forecastStoreId));
    const storeName = selectedStore ? selectedStore.name : 'Tous les magasins (Global)';

    const headers = [
      { key: 'code', label: 'Code Article' },
      { key: 'name', label: "Nom de l'article" },
      { key: 'reference', label: 'Référence' },
      { key: 'unitPrice', label: 'Prix Unitaire' },
      { key: 'currentStock', label: 'Stock Disponible' },
      { key: 'qty1m', label: 'Conso. 1 Dernier Mois' },
      { key: 'qty2m', label: 'Conso. 2 Derniers Mois' },
      { key: 'qty3m', label: 'Conso. 3 Derniers Mois' },
      { key: 'qty6m', label: 'Conso. 6 Derniers Mois' },
      { key: 'qty1y', label: 'Conso. 1 An' },
      { key: 'qty2y', label: 'Conso. 2 Ans' },
      { key: 'forecast2m', label: 'Prévision (2 Prochains Mois)' },
      { key: 'abcClass', label: 'Classe ABC' }
    ];

    exportToExcel(forecastData, headers, `Previsions_Reapprovisionnement_${new Date().toISOString().split('T')[0]}`, {
      title: "Prévisions de Réapprovisionnement & Consommation",
      companyName: `NS AUTO - Magasin : ${storeName}`,
      period: "Basé sur l'historique des sorties"
    });
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

      {/* NOUVEAU BLOC: PRÉVISIONS SUR MESURE */}
      <div className="content-card" style={{ marginTop: '2rem', borderTop: '4px solid var(--primary)' }}>
        <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={20} className="text-primary" /> Prévisions de Réapprovisionnement & Analyse de Consommation
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
          Générez un rapport pour l'ensemble du catalogue pour analyser la consommation passée et estimer les besoins pour les 2 prochains mois.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
          
          <div className="store-selector" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Store size={18} className="text-muted" />
            <select 
              className="form-control" 
              style={{ width: '250px', height: '36px', padding: '0 10px' }}
              value={forecastStoreId}
              onChange={(e) => setForecastStoreId(e.target.value)}
              disabled={isGeneratingAll}
            >
              <option value="">Tous les magasins (Global)</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <button 
            className="btn btn-primary" 
            onClick={handleGenerateAll}
            disabled={isGeneratingAll}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {isGeneratingAll ? <span className="spinner"></span> : <BarChart3 size={18} />}
            {isGeneratingAll ? 'Analyse globale en cours...' : 'Générer pour tout le catalogue'}
          </button>

          
          {forecastData && (
            <button className="btn btn-secondary" onClick={handleExportForecast} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={18} /> Exporter le Rapport Final (.xlsx)
            </button>
          )}
        </div>

        {forecastData && forecastData.length > 0 && (
          <>
            <div style={{ marginBottom: '1rem' }}>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Filtrer par nom, code ou référence..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '400px' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.8rem', padding: '0.5rem', backgroundColor: 'var(--bg-light)', borderRadius: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--danger)', borderRadius: '2px' }}></div>
                <strong>Classe A (Critique) :</strong> 80% du CA cumulé
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--primary)', borderRadius: '2px' }}></div>
                <strong>Classe B (Important) :</strong> 15% suivants
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--text-muted)', borderRadius: '2px' }}></div>
                <strong>Classe C (Secondaire) :</strong> Reste du catalogue
              </div>
            </div>

            <div className="table-wrapper" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              <table className="table-sm">
              <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bg-main)', zIndex: 1 }}>
                <tr>
                  <th>Code article</th>
                  <th>Nom de l'article</th>
                  <th>Référence</th>
                  <th>Prix unitaire</th>
                  <th style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>Stock Disp.</th>
                  <th>Consommée (1 mois)</th>
                  <th>Consommée (2 mois)</th>
                  <th>Consommée (3 mois)</th>
                  <th>Consommée (6 mois)</th>
                  <th>Consommée (1 an)</th>
                  <th>Consommée (2 ans)</th>
                  <th style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>Prévision (2 mois)</th>
                  <th style={{ textAlign: 'center' }}>Classe</th>
                </tr>
              </thead>
              <tbody>
                {filteredForecastData.map((row, idx) => (
                  <tr key={idx} style={{ 
                    borderLeft: row.abcClass === 'A' ? '4px solid var(--danger)' : row.abcClass === 'B' ? '4px solid var(--primary)' : 'none',
                    backgroundColor: row.abcClass === 'A' ? 'rgba(220, 38, 38, 0.02)' : row.abcClass === 'B' ? 'rgba(37, 99, 235, 0.02)' : 'inherit'
                  }}>
                    <td style={{ fontWeight: row.abcClass === 'A' ? 'bold' : 'normal' }}>{row.code}</td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.name}>{row.name}</td>
                    <td>{row.reference}</td>
                    <td>{row.unitPrice?.toLocaleString()}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--success)' }}>{row.currentStock}</td>
                    <td>{row.qty1m}</td>
                    <td>{row.qty2m}</td>
                    <td>{row.qty3m}</td>
                    <td>{row.qty6m}</td>
                    <td>{row.qty1y}</td>
                    <td>{row.qty2y}</td>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary)', backgroundColor: 'rgba(var(--primary-rgb), 0.05)' }}>
                      {row.forecast2m}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                       <span className={`badge badge-${row.abcClass === 'A' ? 'danger' : row.abcClass === 'B' ? 'primary' : 'secondary'}`} style={{ minWidth: '70px' }}>
                         Classe {row.abcClass}
                       </span>
                     </td>
                  </tr>
                ))}
                {filteredForecastData.length === 0 && (
                  <tr>
                    <td colSpan="13" style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      Aucun article trouvé pour la recherche "{searchTerm}"
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </>
        )}
        {forecastData && forecastData.length === 0 && (
           <div className="alert alert-warning">Aucun historique trouvé pour les articles importés.</div>
        )}
      </div>
    </div>
  );
}
