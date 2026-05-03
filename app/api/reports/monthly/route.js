import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    // Récupérer l'exercice actif
    const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];
    if (!activeYear) {
      return NextResponse.json({ months: [], totalRevenue: 0, totalDebt: 0 });
    }

    let months = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date();
      d.setDate(1); // Éviter le bug de débordement de mois (ex: 31 mars -> 31 fév)
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().substring(0, 7);
      
      let revQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE date LIKE ? AND status != "annulée" AND fiscalYearId = ?';
      let revParams = [monthStr + '%', activeYear.id];
      if (storeId && storeId !== 'all' && storeId !== '') { 
        revQuery += ' AND storeId = ?'; 
        revParams.push(storeId); 
      }
      const [revRow] = await db.query(revQuery, revParams);

      let cashQuery = `
        SELECT SUM(p.amount) as total 
        FROM payments p
        LEFT JOIN sales s ON p.saleId = s.id
        WHERE p.date LIKE ? AND (s.status IS NULL OR s.status != 'annulée') AND (s.fiscalYearId = ? OR p.fiscalYearId = ?)
      `;
      let cashParams = [monthStr + '%', activeYear.id, activeYear.id];
      if (storeId && storeId !== 'all' && storeId !== '') { 
        cashQuery += ' AND p.storeId = ?'; 
        cashParams.push(storeId); 
      }
      const [cashRow] = await db.query(cashQuery, cashParams);
      
      months.push({ 
        month: monthStr, 
        revenue: Number(revRow[0].total) || 0, 
        cash: Number(cashRow[0].total) || 0 
      });
    }

    let totalRevQuery = 'SELECT SUM(totalAmount) as total FROM sales WHERE status != "annulée" AND fiscalYearId = ?';
    let totalRevParams = [activeYear.id];
    if (storeId && storeId !== 'all' && storeId !== '') { 
      totalRevQuery += ' AND storeId = ?'; 
      totalRevParams.push(storeId); 
    }
    const [totalRevRow] = await db.query(totalRevQuery, totalRevParams);

    let totalPaidQuery = 'SELECT SUM(amountPaid) as total FROM sales WHERE status != "annulée" AND fiscalYearId = ?';
    let totalPaidParams = [activeYear.id];
    if (storeId && storeId !== 'all' && storeId !== '') { 
      totalPaidQuery += ' AND storeId = ?'; 
      totalPaidParams.push(storeId); 
    }
    const [totalPaidRow] = await db.query(totalPaidQuery, totalPaidParams);

    const totalRevenue = Number(totalRevRow[0].total) || 0;
    const totalPaid = Number(totalPaidRow[0].total) || 0;
    return NextResponse.json({ months, totalRevenue, totalPaid, totalDebt: totalRevenue - totalPaid });
  } catch (err) { 
    console.error('[MONTHLY REPORT ERROR]', err);
    return NextResponse.json({ 
      error: err.message, 
      details: err.stack,
      hint: "Vérifiez la structure de la table fiscal_years ou sales" 
    }, { status: 500 }); 
  }
}
