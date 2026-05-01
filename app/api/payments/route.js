import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { getStoreConstraint } from '../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    // Récupérer l'exercice actif
    const [fyRows] = await db.query("SELECT id FROM fiscal_years WHERE status = 'active'");
    const activeYearId = fyRows[0]?.id;
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    const date = request.nextUrl.searchParams.get('date');

    let query = `
      SELECT p.*, s.id as saleId, s.date as saleDate, s.status as saleStatus,
             c.name as clientName, s.id as saleRef
      FROM payments p
      JOIN sales s ON p.saleId = s.id
      LEFT JOIN clients c ON s.clientId = c.id
      WHERE 1=1
    `;
    let params = [];
    
    if (activeYearId) {
      query += ' AND p.fiscalYearId = ?';
      params.push(activeYearId);
    } else {
      query += ' AND 1=0';
    }

    if (date) { query += ' AND p.date LIKE ?'; params.push(date + '%'); }
    if (storeId) { query += ' AND p.storeId = ?'; params.push(storeId); }
    query += ' ORDER BY p.date DESC';
    const [payments] = await db.query(query, params);
    return NextResponse.json(payments);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
