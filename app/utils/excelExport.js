import * as XLSX from 'xlsx';

/**
 * Exporte des données JSON au format Excel (XLSX) avec une mise en forme professionnelle.
 * @param {Array} data - Tableau d'objets à exporter
 * @param {Array} headers - Définition des colonnes [{key, label}]
 * @param {string} fileName - Nom du fichier
 * @param {Object} options - Options de personnalisation (title, companyName, period)
 */
export const exportToExcel = (data, headers, fileName, options = {}) => {
  if (!data || !data.length) return;

  const { title = "Rapport d'Activité", companyName = "NS AUTO", period = "", summary = null } = options;

  // 1. Préparer l'en-tête du document (AOA - Array of Arrays)
  const headerSection = [
    [companyName.toUpperCase()],
    [title.toUpperCase()],
    [period ? `Période : ${period}` : `Généré le : ${new Date().toLocaleString('fr-FR')}`],
    [] // Ligne vide de séparation
  ];

  // 2. Préparer les données du tableau
  const tableHeaders = headers.map(h => h.label);
  const tableData = data.map(item => 
    headers.map(h => item[h.key] === null || item[h.key] === undefined ? '' : item[h.key])
  );

  // Fusionner tout pour la feuille
  let finalData = [...headerSection, tableHeaders, ...tableData];
  
  // Ajouter une ligne de résumé si présente
  if (summary) {
    finalData.push([]); // Ligne vide avant le total
    finalData.push(summary);
  }

  // 3. Créer la feuille de calcul
  const worksheet = XLSX.utils.aoa_to_sheet(finalData);

  // 4. Configuration des colonnes (Auto-size)
  const colWidths = headers.map((h, i) => {
    const headerLen = h.label.length;
    const maxDataLen = data.reduce((max, row) => {
      const val = row[h.key]?.toString() || "";
      return Math.max(max, val.length);
    }, 0);
    // Prendre en compte aussi la ligne de résumé pour la largeur
    const summaryLen = summary ? (summary[i]?.toString()?.length || 0) : 0;
    return { wch: Math.max(headerLen, maxDataLen, summaryLen) + 4 };
  });
  worksheet['!cols'] = colWidths;

  // 5. Paramètres d'impression (Tentative de forcer Paysage et Ajustement)
  worksheet['!pageSetup'] = { orientation: 'landscape', paperSize: 9 }; // 9 = A4
  worksheet['!printOptions'] = { gridLines: false };
  
  // Demander à Excel d'ajuster le contenu à la largeur de la page
  worksheet['!margins'] = { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 };

  // 6. Créer le classeur
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Rapport");

  // 6. Générer et télécharger
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

