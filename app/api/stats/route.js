import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken, hasPermission } from '../../lib/auth';
import { getStoreConstraint } from '../../lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (!hasPermission(auth.user, 'finances', 'view')) {
    return NextResponse.json({ error: 'Accès interdit : Permissions insuffisantes' }, { status: 403 });
  }
  const user = auth.user;

  try {
    const storeId = getStoreConstraint(user, request.nextUrl.searchParams.get('storeId'));
    
    // Get active fiscal year
    const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];
    
    // 1. Basic counts setup
    let articlesCountQuery = 'SELECT COUNT(*) as `count` FROM articles a';
    let articlesCountParams = [];
    if (storeId) {
      articlesCountQuery += ' JOIN inventory i ON i.articleId = a.id WHERE i.storeId = ?';
      articlesCountParams.push(storeId);
    }

    // 2. Stock Value setup
    let stockQuery = 'SELECT SUM(i.quantity * a.price) as `totalValue` FROM inventory i JOIN articles a ON i.articleId = a.id';
    let stockParams = [];
    if (storeId) { stockQuery += ' WHERE i.storeId = ?'; stockParams.push(storeId); }

    // 3. Low Stock Articles setup
    let lowStockQuery = 'SELECT a.id, a.code, a.name, a.currentStock, a.minStock FROM articles a WHERE a.currentStock <= a.minStock';
    let lowStockParams = [];
    if (storeId) {
      lowStockQuery = 'SELECT a.id, a.code, a.name, i.quantity as `currentStock`, a.minStock FROM articles a JOIN inventory i ON i.articleId = a.id WHERE i.storeId = ? AND i.quantity <= a.minStock';
      lowStockParams.push(storeId);
    }

    // 4. Mouvements count (this month) setup
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    let mouvementsQuery = 'SELECT COUNT(*) as `count` FROM mouvements WHERE DATE(date) >= ?';
    let mouvementsParams = [startOfMonth];
    if (storeId) { mouvementsQuery += ' AND storeId = ?'; mouvementsParams.push(storeId); }

    // Execute basic queries in parallel to avoid async waterfall
    const [
      [articlesRow],
      [stockRow],
      [lowStockArticles],
      [mouvRow]
    ] = await Promise.all([
      db.query(articlesCountQuery, articlesCountParams),
      db.query(stockQuery, stockParams),
      db.query(lowStockQuery, lowStockParams),
      db.query(mouvementsQuery, mouvementsParams)
    ]);

    const totalArticles = articlesRow[0].count;
    const totalStockValue = stockRow[0].totalValue || 0;
    const mouvementsCount = mouvRow[0].count;

    if (!activeYear) {
      return NextResponse.json({ 
        hasActiveYear: false,
        totalArticles, totalStockValue, lowStockArticles, mouvementsCount,
        totalRevenue: 0, revenuePhysical: 0, purchaseVirtual: 0, salesHistory: [], topArticles: [], topClients: [], unpaidSales: []
      });
    }

    // 5. Revenue setup
    const fyId = activeYear.id;
    let revenueQuery = `SELECT 
        SUM(CASE WHEN (storeId != "CFAO" OR storeId IS NULL) THEN totalAmount ELSE 0 END) as \`physical\`,
        SUM(CASE WHEN storeId = "CFAO" THEN totalAmount ELSE 0 END) as \`virtual\`
       FROM sales WHERE fiscalYearId = ? AND status != "annulée"`;
    let revenueParams = [fyId];
    if (storeId) { revenueQuery += ' AND storeId = ?'; revenueParams.push(storeId); }

    // 6. Unpaid Sales setup
    let unpaidQuery = `SELECT s.id, c.name as clientName, s.totalAmount, s.amountPaid, s.date 
                       FROM sales s 
                       LEFT JOIN clients c ON s.clientId = c.id 
                       WHERE s.fiscalYearId = ? AND s.status NOT IN ("payé", "annulée")`;
    let unpaidParams = [fyId];
    if (storeId) { unpaidQuery += ' AND s.storeId = ?'; unpaidParams.push(storeId); }

    // 7. Top Articles setup
    let topArtQuery = `SELECT a.name, SUM(si.quantity) as \`qty\`, SUM(si.quantity * si.unitPrice) as \`revenue\`
       FROM sale_items si
       JOIN sales s ON si.saleId = s.id
       JOIN articles a ON si.articleId = a.id
       WHERE s.fiscalYearId = ? AND s.status != "annulée"`;
    let topArtParams = [fyId];
    if (storeId) { topArtQuery += ' AND s.storeId = ?'; topArtParams.push(storeId); }
    topArtQuery += ' GROUP BY a.id, a.name ORDER BY qty DESC LIMIT 30';

    // 8. Top Clients setup
    let topCliQuery = `SELECT c.name as \`name\`, COUNT(*) as \`orders\`, SUM(s.totalAmount) as \`spent\`
       FROM sales s
       JOIN clients c ON s.clientId = c.id
       WHERE s.fiscalYearId = ? AND s.status != "annulée"`;
    let topCliParams = [fyId];
    if (storeId) { topCliQuery += ' AND s.storeId = ?'; topCliParams.push(storeId); }
    topCliQuery += ' GROUP BY c.id, c.name ORDER BY spent DESC LIMIT 5';

    // 9. Sales History setup (7 days, executed concurrently using Promise.all)
    const historyPromises = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayQuery = `SELECT SUM(totalAmount) as \`dayTotal\` FROM sales 
         WHERE DATE(date) = ? AND status != "annulée" AND (storeId != "CFAO" OR storeId IS NULL)`;
      let dayParams = [dateStr];
      if (storeId) { dayQuery += ' AND storeId = ?'; dayParams.push(storeId); }
      
      historyPromises.push(
        db.query(dayQuery, dayParams).then(([dayRow]) => ({
          name: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
          montant: dayRow[0].dayTotal || 0
        }))
      );
    }

    // Execute all fiscal-year statistics and daily history queries concurrently
    const [
      [revenueRow],
      [unpaidSales],
      [topArticlesDetail],
      [topClients],
      salesHistory
    ] = await Promise.all([
      db.query(revenueQuery, revenueParams),
      db.query(unpaidQuery, unpaidParams),
      db.query(topArtQuery, topArtParams),
      db.query(topCliQuery, topCliParams),
      Promise.all(historyPromises)
    ]);

    const revenuePhysical = revenueRow[0].physical || 0;
    const revenueVirtual = revenueRow[0].virtual || 0;

    return NextResponse.json({
      hasActiveYear: true,
      totalArticles,
      totalStockValue,
      lowStockArticles,
      mouvementsCount,
      totalRevenue: revenuePhysical,
      revenuePhysical,
      purchaseVirtual: revenueVirtual,
      unpaidSales,
      topArticles: topArticlesDetail.slice(0, 5).map(a => ({ name: a.name, value: Number(a.qty) || 0 })),
      topArticlesDetail,
      topClients,
      salesHistory
    });
  } catch (err) { 
    console.error('[STATS ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  }
}
