import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get('clientId');
  const month = searchParams.get('month'); // 1-12
  const year = searchParams.get('year');
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));

  if (!clientId || !month || !year) {
    return NextResponse.json({ error: "Client, mois et année requis" }, { status: 400 });
  }

  try {
    const monthPattern = `${year}-${month.padStart(2, '0')}%`;

    // Requête pour récupérer les ventes groupées par article pour ce client et ce mois
    const query = `
      SELECT 
        a.code, 
        a.name, 
        si.unitPrice, 
        SUM(si.quantity) as totalQuantity, 
        SUM(si.quantity * si.unitPrice) as totalAmount
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      JOIN articles a ON si.articleId = a.id
      WHERE s.clientId = ? 
        AND s.date LIKE ? 
        AND s.status != 'annulée'
        ${storeId ? 'AND s.storeId = ?' : ''}
      GROUP BY a.id, si.unitPrice
      ORDER BY a.name ASC
    `;

    const params = [clientId, monthPattern];
    if (storeId) params.push(storeId);

    const [rows] = await db.query(query, params);

    // Calcul des totaux généraux
    const summary = rows.reduce((acc, row) => {
      acc.totalQuantity += Number(row.totalQuantity);
      acc.totalAmount += Number(row.totalAmount);
      return acc;
    }, { totalQuantity: 0, totalAmount: 0 });

    return NextResponse.json({
      items: rows,
      summary: summary
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
