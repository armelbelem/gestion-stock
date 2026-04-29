import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    let months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7);
      let revQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE date LIKE ? AND status != "annulée"';
      let revParams = [monthStr + '%'];
      if (storeId) { revQuery += ' AND storeId = ?'; revParams.push(storeId); }
      const [revRow] = await db.query(revQuery, revParams);
      let cashQuery = 'SELECT SUM(amount) as total FROM payments WHERE date LIKE ?';
      let cashParams = [monthStr + '%'];
      if (storeId) { cashQuery += ' AND storeId = ?'; cashParams.push(storeId); }
      const [cashRow] = await db.query(cashQuery, cashParams);
      months.push({ month: monthStr, revenue: revRow[0].total || 0, cash: cashRow[0].total || 0 });
    }

    let totalRevQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE status != "annulée"';
    let totalRevParams = [];
    if (storeId) { totalRevQuery += ' AND storeId = ?'; totalRevParams.push(storeId); }
    const [totalRevRow] = await db.query(totalRevQuery, totalRevParams);

    let totalPaidQuery = 'SELECT SUM(amountPaid) as total FROM sales WHERE status != "annulée"';
    let totalPaidParams = [];
    if (storeId) { totalPaidQuery += ' AND storeId = ?'; totalPaidParams.push(storeId); }
    const [totalPaidRow] = await db.query(totalPaidQuery, totalPaidParams);

    const totalRevenue = totalRevRow[0].total || 0;
    const totalPaid = totalPaidRow[0].total || 0;
    return NextResponse.json({ months, totalRevenue, totalDebt: totalRevenue - totalPaid });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
