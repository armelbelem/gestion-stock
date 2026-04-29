/**
 * Exporte des données JSON en format CSV et déclenche le téléchargement.
 * @param {Array} data - Tableau d'objets à exporter
 * @param {Array} headers - Définition des colonnes [{key, label}]
 * @param {string} fileName - Nom du fichier (sans extension)
 */
export const exportToCSV = (data, headers, fileName) => {
  if (!data || !data.length) return;

  // Création de l'en-tête
  const headerRow = headers.map(h => h.label).join(',');
  
  // Création des lignes de données
  const rows = data.map(item => {
    return headers.map(h => {
      const value = item[h.key] === null || item[h.key] === undefined ? '' : item[h.key];
      // Échapper les virgules pour éviter de casser le CSV
      return `"${String(value).replace(/"/g, '""')}"`;
    }).join(',');
  });

  const csvContent = [headerRow, ...rows].join('\n');
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  
  link.click();
  document.body.removeChild(link);
};
