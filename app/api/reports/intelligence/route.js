import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));

  try {
    // 1. ANALYSE DE PARETO (Articles)
    let paretoQuery = `
      SELECT 
        a.id, a.name, a.code,
        SUM(si.quantity * si.unitPrice) as revenue
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      JOIN articles a ON si.articleId = a.id
      WHERE s.status != 'annulée'
      ${storeId ? 'AND s.storeId = ?' : ''}
      GROUP BY a.id
      ORDER BY revenue DESC
    `;
    const [articlesRevenue] = await db.query(paretoQuery, storeId ? [storeId] : []);
    
    const totalRevenue = articlesRevenue.reduce((acc, a) => acc + Number(a.revenue), 0);
    let cumulativeRevenue = 0;
    const paretoData = articlesRevenue.map(a => {
      cumulativeRevenue += Number(a.revenue);
      return {
        ...a,
        percentage: totalRevenue > 0 ? (a.revenue / totalRevenue * 100) : 0,
        cumulativePercentage: totalRevenue > 0 ? (cumulativeRevenue / totalRevenue * 100) : 0
      };
    });

    // 2. ANALYSE DE SAISONNALITÉ (12 derniers mois)
    let seasonalityQuery = `
      SELECT 
        DATE_FORMAT(date, '%Y-%m') as month,
        SUM(totalAmount) as revenue
      FROM sales
      WHERE status != 'annulée'
        AND date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
      ${storeId ? 'AND storeId = ?' : ''}
      GROUP BY month
      ORDER BY month ASC
    `;
    const [seasonalityRaw] = await db.query(seasonalityQuery, storeId ? [storeId] : []);

    // 3. COMPORTEMENT CLIENT (Risque de Churn)
    // Comparer la consommation du mois actuel vs moyenne des 3 derniers mois
    let clientBehaviorQuery = `
      SELECT 
        c.id, c.name,
        SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN s.totalAmount ELSE 0 END) as currentMonth,
        SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 4 MONTH) AND s.date < DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN s.totalAmount ELSE 0 END) / 3 as avgLast3Months
      FROM sales s
      JOIN clients c ON s.clientId = c.id
      WHERE s.status != 'annulée'
      ${storeId ? 'AND s.storeId = ?' : ''}
      GROUP BY c.id
      HAVING avgLast3Months > 1000 -- Uniquement les clients significatifs
    `;
    const [clientBehavior] = await db.query(clientBehaviorQuery, storeId ? [storeId] : []);
    
    const churnRisks = clientBehavior.map(c => ({
      ...c,
      dropPercentage: c.avgLast3Months > 0 ? ((c.avgLast3Months - c.currentMonth) / c.avgLast3Months * 100) : 0
    })).filter(c => c.dropPercentage > 30) // Plus de 30% de baisse
       .sort((a, b) => b.dropPercentage - a.dropPercentage);

    // 4. PRÉVISION DE RUPTURE (Burn Rate) pour le Top 20 des articles
    let burnRateQuery = `
      SELECT 
        a.id, a.name, a.currentStock, a.minStock,
        COALESCE(SUM(si.quantity), 0) / 30 as dailyVelocity
      FROM articles a
      LEFT JOIN sale_items si ON a.id = si.articleId
      LEFT JOIN sales s ON si.saleId = s.id AND s.status != 'annulée' AND s.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ${storeId ? 'WHERE (s.storeId = ? OR s.storeId IS NULL)' : ''}
      GROUP BY a.id
      ORDER BY dailyVelocity DESC
      LIMIT 20
    `;
    const [burnRateRaw] = await db.query(burnRateQuery, storeId ? [storeId] : []);
    
    const stockOutPredictions = burnRateRaw
      .filter(a => a.dailyVelocity > 0) // Uniquement ceux qui se vendent
      .map(a => ({
        ...a,
        daysRemaining: Math.floor(a.currentStock / a.dailyVelocity)
      }))
      .sort((a, b) => a.daysRemaining - b.daysRemaining);

    return NextResponse.json({
      pareto: paretoData,
      seasonality: seasonalityRaw,
      churnRisks: churnRisks,
      stockOut: stockOutPredictions
    });
  } catch (err) {
    console.error('[INTELLIGENCE API ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
