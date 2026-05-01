import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { authenticateToken } from '../../../../lib/auth';
import { getStoreConstraint } from '../../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const monthStr = searchParams.get('month'); // YYYY-MM
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));

  if (!monthStr) return NextResponse.json({ error: "Mois requis" }, { status: 400 });

  try {
    // 1. Récupérer les ventes du mois
    const querySales = `SELECT s.*, c.name as clientName 
       FROM sales s LEFT JOIN clients c ON s.clientId = c.id 
       WHERE s.date LIKE ? AND s.status != 'annulée' 
       ${storeId && storeId !== 'all' ? 'AND s.storeId = ?' : ''}
       ORDER BY s.date DESC`;
    
    const paramsSales = storeId && storeId !== 'all' ? [monthStr + '%', storeId] : [monthStr + '%'];
    const [sales] = await db.query(querySales, paramsSales);

    // 2. Récupérer le total encaissé pour ce mois (Hors ventes annulées)
    const queryPayments = `SELECT SUM(p.amount) as total 
       FROM payments p
       LEFT JOIN sales s ON p.saleId = s.id
       WHERE p.date LIKE ? AND (s.status IS NULL OR s.status != 'annulée')
       ${storeId && storeId !== 'all' ? 'AND p.storeId = ?' : ''}`;
    
    const paramsPayments = storeId && storeId !== 'all' ? [monthStr + '%', storeId] : [monthStr + '%'];
    const [paymentsRow] = await db.query(queryPayments, paramsPayments);

    const totalRevenue = sales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
    const totalPaid = Number(paymentsRow[0].total) || 0;

    return NextResponse.json({
      sales: sales,
      revenue: totalRevenue,
      cash: totalPaid
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
