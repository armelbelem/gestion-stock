import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const daysThreshold = parseInt(searchParams.get('days')) || 90; // Par défaut 3 mois (90 jours)
  const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));

  try {
    // Requête pour trouver les articles avec du stock mais sans ventes récentes
    const query = `
      SELECT 
        a.id, 
        a.name, 
        a.code, 
        a.barcode,
        a.price as sellingPrice,
        SUM(i.quantity) as currentStock,
        MAX(s.date) as lastSaleDate,
        DATEDIFF(NOW(), MAX(s.date)) as daysSinceLastSale
      FROM articles a
      INNER JOIN inventory i ON a.id = i.articleId
      LEFT JOIN sale_items si ON a.id = si.articleId
      LEFT JOIN sales s ON si.saleId = s.id AND s.status != 'annulée'
      WHERE 1=1
        ${storeId ? 'AND i.storeId = ?' : ''}
      GROUP BY a.id
      HAVING (currentStock > 0) 
         AND (lastSaleDate IS NULL OR daysSinceLastSale >= ?)
      ORDER BY daysSinceLastSale DESC, currentStock DESC
    `;

    const params = [];
    if (storeId) params.push(storeId);
    params.push(daysThreshold);

    const [rows] = await db.query(query, params);

    // Formater les données pour le frontend
    const formattedRows = rows.map(row => ({
      ...row,
      lastSaleDate: row.lastSaleDate ? new Date(row.lastSaleDate).toLocaleDateString('fr-FR') : 'Jamais vendu',
      daysSinceLastSale: row.lastSaleDate ? row.daysSinceLastSale : '∞',
      totalValue: row.currentStock * row.sellingPrice
    }));

    return NextResponse.json(formattedRows);
  } catch (err) {
    console.error('Error in dead-stock API:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
