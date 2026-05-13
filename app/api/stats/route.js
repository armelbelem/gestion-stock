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
    
    // 1. Stock Value (Toujours calculé, indépendamment de l'exercice)
    let stockQuery = 'SELECT SUM(i.quantity * a.price) as totalValue FROM inventory i JOIN articles a ON i.articleId = a.id';
    let stockParams = [];
    if (storeId) { stockQuery += ' WHERE i.storeId = ?'; stockParams.push(storeId); }
    const [stockRow] = await db.query(stockQuery, stockParams);
    const totalStockValue = stockRow[0].totalValue || 0;

    // Si aucun exercice actif, on renvoie le stock mais 0 en revenus
    if (!activeYear) {
      return NextResponse.json({ 
        totalRevenue: 0, 
        totalStockValue, 
        salesHistory: [] 
      });
    }

    // 2. Revenue (Physical vs Virtual)
    // Physical Revenue (excluding CFAO)
    let physicalQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE fiscalYearId = ? AND status != "annulée" AND (storeId != "CFAO" OR storeId IS NULL)';
    let physicalParams = [activeYear.id];
    if (storeId) { 
      if (storeId === 'CFAO') {
        physicalQuery = 'SELECT 0 as total';
        physicalParams = [];
      } else {
        physicalQuery += ' AND storeId = ?';
        physicalParams.push(storeId);
      }
    }
    const [physicalRow] = await db.query(physicalQuery, physicalParams);
    const revenuePhysical = physicalRow[0].total || 0;

    // Virtual Revenue (CFAO only)
    let virtualQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE fiscalYearId = ? AND status != "annulée" AND storeId = "CFAO"';
    let virtualParams = [activeYear.id];
    if (storeId) {
      if (storeId !== 'CFAO') {
        virtualQuery = 'SELECT 0 as total';
        virtualParams = [];
      } else {
        virtualQuery += ' AND storeId = ?';
        virtualParams.push(storeId);
      }
    }
    const [virtualRow] = await db.query(virtualQuery, virtualParams);
    const revenueVirtual = virtualRow[0].total || 0;

    // 3. Last 7 days sales (Physical only for the chart to keep it clean)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      let dayQuery = 'SELECT SUM(totalAmount) as dayTotal FROM sales WHERE date LIKE ? AND status != "annulée" AND (storeId != "CFAO" OR storeId IS NULL)';
      let dayParams = [dateStr + '%'];
      if (storeId) { 
        if (storeId === 'CFAO') {
          dayQuery = 'SELECT 0 as dayTotal';
          dayParams = [];
        } else {
          dayQuery += ' AND storeId = ?';
          dayParams.push(storeId);
        }
      }
      const [dayRow] = await db.query(dayQuery, dayParams);
      last7Days.push({
        name: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        montant: dayRow[0].dayTotal || 0
      });
    }

    return NextResponse.json({
      totalRevenue: revenuePhysical, // Uniquement le CA Physique
      revenuePhysical,
      purchaseVirtual: revenueVirtual, // Renommé pour refléter qu'il s'agit d'achats
      totalStockValue,
      salesHistory: last7Days
    });
  } catch (err) { 
    console.error('[STATS ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  }
}
