import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Dates de début et de fin requises" }, { status: 400 });
  }

  try {
    // Requête pour récupérer les articles les plus achetés par chaque client sur la période
    const query = `
      SELECT 
        c.id as clientId,
        c.name as clientName,
        a.id as articleId,
        a.name as articleName,
        a.code as articleCode,
        a.barcode as articleBarcode,
        SUM(si.quantity) as totalQuantity,
        SUM(si.quantity * si.unitPrice) as totalAmount
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      JOIN clients c ON s.clientId = c.id
      JOIN articles a ON si.articleId = a.id
      WHERE s.date >= ? AND s.date <= ?
        AND s.status != 'annulée'
        ${storeId ? 'AND s.storeId = ?' : ''}
      GROUP BY c.id, a.id
      ORDER BY c.name ASC, totalQuantity DESC
    `;

    const params = [startDate + 'T00:00:00', endDate + 'T23:59:59'];
    if (storeId) params.push(storeId);

    const [rows] = await db.query(query, params);

    // Grouper par client pour une meilleure exploitation côté client (frontend)
    const groupedData = rows.reduce((acc, row) => {
      if (!acc[row.clientId]) {
        acc[row.clientId] = {
          id: row.clientId,
          name: row.clientName,
          topArticles: []
        };
      }
      acc[row.clientId].topArticles.push({
        id: row.articleId,
        name: row.articleName,
        code: row.articleCode,
        barcode: row.articleBarcode,
        quantity: Number(row.totalQuantity),
        amount: Number(row.totalAmount)
      });
      return acc;
    }, {});

    return NextResponse.json(Object.values(groupedData));
  } catch (err) {
    console.error('Error in top-client-articles API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
