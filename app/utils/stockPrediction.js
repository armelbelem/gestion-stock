/**
 * Calcule la vitesse de vente quotidienne et prédit la rupture de stock.
 * @param {string} articleId - L'ID de l'article
 * @param {Array} sales - Liste de toutes les ventes
 * @param {number} currentStock - Stock actuel de l'article
 * @returns {Object} - { daysRemaining, status, dailyVelocity }
 */
export const calculateStockOutPrediction = (articleId, sales, currentStock) => {
  if (!sales || sales.length === 0 || currentStock <= 0) {
    return { daysRemaining: 0, status: 'critical', dailyVelocity: 0 };
  }

  // 1. Filtrer les ventes pour cet article sur les 30 derniers jours
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let totalSold = 0;
  sales.forEach(sale => {
    const saleDate = new Date(sale.date);
    if (saleDate >= thirtyDaysAgo && sale.status !== 'annulée') {
      const item = sale.items?.find(i => i.articleId === articleId);
      if (item) {
        totalSold += item.quantity;
      }
    }
  });

  // 2. Calculer la vitesse quotidienne (moyenne mobile)
  const dailyVelocity = parseFloat((totalSold / 30).toFixed(2));

  if (dailyVelocity === 0) {
    return { daysRemaining: Infinity, status: 'stable', dailyVelocity: 0 };
  }

  // 3. Estimer les jours restants
  const daysRemaining = Math.floor(currentStock / dailyVelocity);

  // 4. Déterminer le statut de risque
  let status = 'stable';
  if (daysRemaining <= 3) status = 'critical';
  else if (daysRemaining <= 7) status = 'warning';

  return { daysRemaining, status, dailyVelocity };
};
