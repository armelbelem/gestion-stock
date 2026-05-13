'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, FileText, Globe, X, Command, ArrowRight, ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { storage } from '../lib/storage';

export default function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef(null);

  // Écouter Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Focus sur l'input à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // Recherche
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [articlesData, ordersData, salesData, bcHistoryData] = await Promise.all([
          storage.get('articles'),
          storage.get('contract-orders'),
          storage.get('sales'),
          storage.get('contract-bc-history')
        ]);

        const articles = Array.isArray(articlesData) ? articlesData : (articlesData?.articles || []);
        const orders = Array.isArray(ordersData) ? ordersData : (ordersData?.orders || []);
        const sales = Array.isArray(salesData) ? salesData : (salesData?.sales || []);
        const bcHistory = Array.isArray(bcHistoryData) ? bcHistoryData : (bcHistoryData?.history || []);

        const q = query.toLowerCase();
        const searchResults = [];

        // Articles
        articles.filter(a => 
          a?.description?.toLowerCase().includes(q) || 
          a?.code?.toLowerCase().includes(q)
        ).slice(0, 5).forEach(a => {
          searchResults.push({
            id: `art-${a.id}`,
            type: 'article',
            title: a.description,
            subtitle: `Code: ${a.code} | Stock: ${a.currentStock}`,
            link: '/articles',
            icon: Package
          });
        });

        // Dossiers (Contract)
        orders.filter(o => 
          o?.orderNumber?.toString().includes(q) || 
          o?.clientName?.toLowerCase().includes(q)
        ).slice(0, 5).forEach(o => {
          searchResults.push({
            id: `ord-${o.id}`,
            type: 'dossier',
            title: `Dossier #${o.orderNumber}`,
            subtitle: `Client: ${o.clientName} | Statut: ${o.status}`,
            link: '/contract-gateway',
            icon: Globe
          });
        });

        // BC History
        bcHistory.filter(bc => 
          bc?.bcNumber?.toLowerCase().includes(q) || 
          bc?.title?.toLowerCase().includes(q)
        ).slice(0, 5).forEach(bc => {
          searchResults.push({
            id: `bc-${bc.id}`,
            type: 'bc',
            title: bc.bcNumber,
            subtitle: bc.title || 'Bon de Commande',
            link: '/contract-gateway',
            icon: FileText
          });
        });

        // Ventes Standards
        sales.filter(s => 
          s?.invoiceNumber?.toString().includes(q) || 
          s?.clientName?.toLowerCase().includes(q)
        ).slice(0, 5).forEach(s => {
          searchResults.push({
            id: `sale-${s.id}`,
            type: 'sale',
            title: `Facture #${s.invoiceNumber}`,
            subtitle: `Client: ${s.clientName} | Total: ${s.totalTTC}`,
            link: '/sales',
            icon: ShoppingCart
          });
        });

        setResults(searchResults);
        setSelectedIndex(0);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (result) => {
    router.push(result.link);
    setIsOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="search-overlay" onClick={() => setIsOpen(false)}>
      <div className="search-palette" onClick={e => e.stopPropagation()}>
        <div className="search-header">
          <Search size={20} className="search-icon" />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Rechercher un article, un dossier, un BC..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="search-kbtip">ESC</div>
        </div>

        <div className="search-body">
          {loading && <div className="search-loading">Recherche en cours...</div>}
          
          {!loading && query && results.length === 0 && (
            <div className="search-empty">Aucun résultat pour "{query}"</div>
          )}

          {!loading && results.length > 0 && (
            <div className="search-results">
              {results.map((res, idx) => (
                <div 
                  key={res.id} 
                  className={`search-result-item ${idx === selectedIndex ? 'active' : ''}`}
                  onClick={() => handleSelect(res)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className={`res-icon-wrapper ${res.type}`}>
                    <res.icon size={18} />
                  </div>
                  <div className="res-info">
                    <div className="res-title">{res.title}</div>
                    <div className="res-subtitle">{res.subtitle}</div>
                  </div>
                  <ArrowRight size={16} className="res-arrow" />
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div className="search-guide">
              <p>Tapez pour rechercher dans tout le système</p>
              <div className="guide-items">
                <span><Package size={14} /> Articles</span>
                <span><Globe size={14} /> Dossiers</span>
                <span><FileText size={14} /> BC</span>
                <span><ShoppingCart size={14} /> Ventes</span>
              </div>
            </div>
          )}
        </div>

        <div className="search-footer">
          <div className="footer-tip">
            <kbd><Command size={12} /> Enter</kbd> pour s'y rendre
          </div>
          <div className="footer-tip">
            <kbd>↑↓</kbd> pour naviguer
          </div>
        </div>
      </div>
    </div>
  );
}
