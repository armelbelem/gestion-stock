/**
 * Simple algorithm to predict stock out based on sales velocity.
 * Velocity = units sold / number of days
 * Days remaining = current stock / velocity
 */

export const calculateStockOutPrediction = (articleId, sales, currentStock, daysToAnalyze = 30) => {
  if (!sales || sales.length === 0 || currentStock <= 0) {
    return { daysRemaining: null, status: 'stable' };
  }

  const now = new Date();
  const startDate = new Date();
  startDate.setDate(now.getDate() - daysToAnalyze);

  let totalSold = 0;

  sales.forEach(sale => {
    const saleDate = new Date(sale.date);
    if (saleDate >= startDate && sale.status !== 'annulée') {
      if (sale.items) {
        const item = sale.items.find(i => i.articleId === articleId);
        if (item) {
          totalSold += item.quantity;
        }
      }
    }
  });

  if (totalSold === 0) {
    return { daysRemaining: Infinity, status: 'stable', dailyVelocity: 0 };
  }

  const dailyVelocity = totalSold / daysToAnalyze;
  const daysRemaining = Math.floor(currentStock / dailyVelocity);

  let status = 'stable';
  if (daysRemaining <= 3) status = 'critical';
  else if (daysRemaining <= 7) status = 'warning';

  return { 
    daysRemaining, 
    status, 
    dailyVelocity: dailyVelocity.toFixed(2),
    totalSoldInPeriod: totalSold
  };
};
