/**
 * Utility to export data as CSV and trigger a download in the browser.
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Array of header names [ { key: 'id', label: 'ID' }, ... ]
 * @param {string} filename - Name of the file to download
 */
export const exportToCSV = (data, headers, filename) => {
  if (!data || data.length === 0) return;

  // 1. Create CSV header row
  const headerRow = headers.map(h => `"${h.label}"`).join(';');
  
  // 2. Create CSV data rows
  const dataRows = data.map(item => {
    return headers.map(h => {
      let value = item[h.key] ?? '';
      // Escape double quotes and handle multi-line strings
      value = String(value).replace(/"/g, '""');
      return `"${value}"`;
    }).join(';');
  });

  // 3. Combine header and data with BOM for Excel UTF-8 support
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\n');
  
  // 4. Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
