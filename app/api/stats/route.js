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
    
    // 1. Basic counts
    let articlesCountQuery = 'SELECT COUNT(*) as `count` FROM articles a';
    let articlesCountParams = [];
    if (storeId) {
      articlesCountQuery += ' JOIN inventory i ON i.articleId = a.id WHERE i.storeId = ?';
      articlesCountParams.push(storeId);
    }
    const [articlesRow] = await db.query(articlesCountQuery, articlesCountParams);
    const totalArticles = articlesRow[0].count;

    // 2. Stock Value
    let stockQuery = 'SELECT SUM(i.quantity * a.price) as `totalValue` FROM inventory i JOIN articles a ON i.articleId = a.id';
    let stockParams = [];
    if (storeId) { stockQuery += ' WHERE i.storeId = ?'; stockParams.push(storeId); }
    const [stockRow] = await db.query(stockQuery, stockParams);
    const totalStockValue = stockRow[0].totalValue || 0;

    // 3. Low Stock Articles
    let lowStockQuery = 'SELECT a.id, a.code, a.name, a.currentStock, a.minStock FROM articles a WHERE a.currentStock <= a.minStock';
    let lowStockParams = [];
    if (storeId) {
      lowStockQuery = 'SELECT a.id, a.code, a.name, i.quantity as `currentStock`, a.minStock FROM articles a JOIN inventory i ON i.articleId = a.id WHERE i.storeId = ? AND i.quantity <= a.minStock';
      lowStockParams.push(storeId);
    }
    const [lowStockArticles] = await db.query(lowStockQuery, lowStockParams);

    // 4. Mouvements count (this month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    let mouvementsQuery = 'SELECT COUNT(*) as `count` FROM mouvements WHERE DATE(date) >= ?';
    let mouvementsParams = [startOfMonth];
    if (storeId) { mouvementsQuery += ' AND storeId = ?'; mouvementsParams.push(storeId); }
    const [mouvRow] = await db.query(mouvementsQuery, mouvementsParams);
    const mouvementsCount = mouvRow[0].count;

    if (!activeYear) {
      return NextResponse.json({ 
        hasActiveYear: false,
        totalArticles, totalStockValue, lowStockArticles, mouvementsCount,
        totalRevenue: 0, revenuePhysical: 0, purchaseVirtual: 0, salesHistory: [], topArticles: [], topClients: [], unpaidSales: []
      });
    }

    // 5. Revenue
    const fyId = activeYear.id;
    let revenueQuery = `SELECT 
        SUM(CASE WHEN (storeId != "CFAO" OR storeId IS NULL) THEN totalAmount ELSE 0 END) as \`physical\`,
        SUM(CASE WHEN storeId = "CFAO" THEN totalAmount ELSE 0 END) as \`virtual\`
       FROM sales WHERE fiscalYearId = ? AND status != "annulée"`;
    let revenueParams = [fyId];
    if (storeId) { revenueQuery += ' AND storeId = ?'; revenueParams.push(storeId); }
    const [revenueRow] = await db.query(revenueQuery, revenueParams);
    const revenuePhysical = revenueRow[0].physical || 0;
    const revenueVirtual = revenueRow[0].virtual || 0;

    // 6. Unpaid Sales
    let unpaidQuery = `SELECT s.id, c.name as clientName, s.totalAmount, s.amountPaid, s.date 
                       FROM sales s 
                       LEFT JOIN clients c ON s.clientId = c.id 
                       WHERE s.fiscalYearId = ? AND s.status NOT IN ("payé", "annulée")`;
    let unpaidParams = [fyId];
    if (storeId) { unpaidQuery += ' AND s.storeId = ?'; unpaidParams.push(storeId); }
    const [unpaidSales] = await db.query(unpaidQuery, unpaidParams);

    // 7. Top Articles
    let topArtQuery = `SELECT a.name, SUM(si.quantity) as \`qty\`, SUM(si.quantity * si.unitPrice) as \`revenue\`
       FROM sale_items si
       JOIN sales s ON si.saleId = s.id
       JOIN articles a ON si.articleId = a.id
       WHERE s.fiscalYearId = ? AND s.status != "annulée"`;
    let topArtParams = [fyId];
    if (storeId) { topArtQuery += ' AND s.storeId = ?'; topArtParams.push(storeId); }
    topArtQuery += ' GROUP BY a.id, a.name ORDER BY qty DESC LIMIT 30';
    const [topArticlesDetail] = await db.query(topArtQuery, topArtParams);

    // 8. Top Clients
    let topCliQuery = `SELECT c.name as \`name\`, COUNT(*) as \`orders\`, SUM(s.totalAmount) as \`spent\`
       FROM sales s
       JOIN clients c ON s.clientId = c.id
       WHERE s.fiscalYearId = ? AND s.status != "annulée"`;
    let topCliParams = [fyId];
    if (storeId) { topCliQuery += ' AND s.storeId = ?'; topCliParams.push(storeId); }
    topCliQuery += ' GROUP BY c.id, c.name ORDER BY spent DESC LIMIT 5';
    const [topClients] = await db.query(topCliQuery, topCliParams);

    // 9. Sales History (7 days)
    const salesHistory = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayQuery = `SELECT SUM(totalAmount) as \`dayTotal\` FROM sales 
         WHERE DATE(date) = ? AND status != "annulée" AND (storeId != "CFAO" OR storeId IS NULL)`;
      let dayParams = [dateStr];
      if (storeId) { dayQuery += ' AND storeId = ?'; dayParams.push(storeId); }
      const [dayRow] = await db.query(dayQuery, dayParams);
      salesHistory.push({
        name: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        montant: dayRow[0].dayTotal || 0
      });
    }

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
