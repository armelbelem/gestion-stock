import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { getStoreConstraint } from '../../lib/actions';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const user = auth.user;

  try {
    const storeId = getStoreConstraint(user, request.nextUrl.searchParams.get('storeId'));
    
    // Get active fiscal year
    const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];
    if (!activeYear) return NextResponse.json({ totalRevenue: 0, totalStockValue: 0, salesHistory: [] });

    // 1. Revenue
    let salesQuery = 'SELECT SUM(totalAmount) as totalRevenue FROM sales WHERE fiscalYearId = ? AND status != "annulée"';
    let salesParams = [activeYear.id];
    if (storeId) { salesQuery += ' AND storeId = ?'; salesParams.push(storeId); }
    const [salesRow] = await db.query(salesQuery, salesParams);
    
    // 2. Stock Value
    let stockQuery = 'SELECT SUM(i.quantity * a.price) as totalValue FROM inventory i JOIN articles a ON i.articleId = a.id';
    let stockParams = [];
    if (storeId) { stockQuery += ' WHERE i.storeId = ?'; stockParams.push(storeId); }
    const [stockRow] = await db.query(stockQuery, stockParams);

    // 3. Last 7 days sales
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayQuery = 'SELECT SUM(totalAmount) as dayTotal FROM sales WHERE date LIKE ? AND status != "annulée"';
      let dayParams = [dateStr + '%'];
      if (storeId) { dayQuery += ' AND storeId = ?'; dayParams.push(storeId); }
      const [dayRow] = await db.query(dayQuery, dayParams);
      last7Days.push({
        name: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        montant: dayRow[0].dayTotal || 0
      });
    }

    return NextResponse.json({
      totalRevenue: salesRow[0].totalRevenue || 0,
      totalStockValue: stockRow[0].totalValue || 0,
      salesHistory: last7Days
    });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
