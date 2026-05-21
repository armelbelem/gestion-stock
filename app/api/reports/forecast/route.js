import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { getStoreConstraint } from '../../../lib/actions';

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { articles, storeId: requestedStoreId, fetchAll } = body;
    
    const storeId = getStoreConstraint(auth.user, requestedStoreId);

    if (!fetchAll && (!articles || !Array.isArray(articles) || articles.length === 0)) {
      return NextResponse.json({ error: "Aucun article fourni" }, { status: 400 });
    }

    let identifiers = [];
    if (!fetchAll) {
      identifiers = articles.map(a => String(a).trim()).filter(a => a);
      if (identifiers.length === 0) {
        return NextResponse.json({ error: "Liste d'articles invalide" }, { status: 400 });
      }
    }

    let queryParams = [];
    let whereClause = "WHERE 1=1";

    if (!fetchAll) {
      const placeholders = identifiers.map(() => '?').join(',');
      whereClause += ` AND (a.code IN (${placeholders}) OR a.barcode IN (${placeholders}))`;
    }

    if (storeId) {
      whereClause += ` AND a.id IN (SELECT articleId FROM inventory WHERE storeId = ?)`;
    }

    // Now push parameters in the EXACT order they appear in the query string
    
    // 0. Parameter for LEFT JOIN inventory subquery
    if (storeId) {
      queryParams.push(storeId);
    }

    // 1. Parameter for LEFT JOIN mouvements m ON ... AND m.storeId = ?
    if (storeId) {
      queryParams.push(storeId);
    }
    
    // 2. Parameters for a.code IN (...)
    if (!fetchAll) {
      queryParams.push(...identifiers);
    }
    
    // 3. Parameters for a.barcode IN (...)
    if (!fetchAll) {
      queryParams.push(...identifiers);
    }
    
    // 4. Parameter for a.id IN (SELECT ... storeId = ?)
    if (storeId) {
      queryParams.push(storeId);
    }

    const query = `
      SELECT 
        a.code, 
        a.name, 
        a.barcode as reference, 
        a.price as unitPrice,
        COALESCE(MAX(inv.totalQty), 0) as currentStock,
        COALESCE(SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 1 MONTH) THEN si.quantity ELSE 0 END), 0) as qty1m,
        COALESCE(SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 2 MONTH) THEN si.quantity ELSE 0 END), 0) as qty2m,
        COALESCE(SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 3 MONTH) THEN si.quantity ELSE 0 END), 0) as qty3m,
        COALESCE(SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 6 MONTH) THEN si.quantity ELSE 0 END), 0) as qty6m,
        COALESCE(SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 12 MONTH) THEN si.quantity ELSE 0 END), 0) as qty1y,
        COALESCE(SUM(CASE WHEN s.date >= DATE_SUB(NOW(), INTERVAL 24 MONTH) THEN si.quantity ELSE 0 END), 0) as qty2y
      FROM articles a
      LEFT JOIN (
        SELECT articleId, SUM(quantity) as totalQty 
        FROM inventory 
        ${storeId ? 'WHERE storeId = ?' : ''} 
        GROUP BY articleId
      ) inv ON a.id = inv.articleId
      LEFT JOIN sale_items si ON a.id = si.articleId
      LEFT JOIN sales s ON si.saleId = s.id AND s.status != 'annulée' AND s.status != 'proforma' ${storeId ? 'AND s.storeId = ?' : ''}
      ${whereClause}
      GROUP BY a.id
    `;

    const [results] = await db.query(query, queryParams);

    // Calculate total revenue for ABC classification (based on 1 year)
    const sortedByRevenue = [...results].sort((a, b) => {
      const revA = Number(a.qty1y) * (Number(a.unitPrice) || 0);
      const revB = Number(b.qty1y) * (Number(b.unitPrice) || 0);
      return revB - revA;
    });

    const totalRevenue = sortedByRevenue.reduce((sum, row) => sum + (Number(row.qty1y) * (Number(row.unitPrice) || 0)), 0);
    
    let cumulativeRevenue = 0;
    const abcMap = new Map();

    sortedByRevenue.forEach(row => {
      const revenue = Number(row.qty1y) * (Number(row.unitPrice) || 0);
      cumulativeRevenue += revenue;
      const percentage = totalRevenue > 0 ? (cumulativeRevenue / totalRevenue) * 100 : 100;

      let abcClass = 'C';
      if (percentage <= 80) abcClass = 'A';
      else if (percentage <= 95) abcClass = 'B';
      
      abcMap.set(row.code, abcClass);
    });

    // Process results to add forecasts and ABC class
    const processedResults = results.map(row => {
      // Calculate 6 months monthly average
      const avg6m = row.qty6m / 6;
      
      // Forecast for 2 months
      const forecast2m = Math.ceil(avg6m * 2);

      return {
        code: row.code || '',
        name: row.name || '',
        reference: row.reference || '',
        unitPrice: Number(row.unitPrice) || 0,
        currentStock: Number(row.currentStock) || 0,
        qty1m: Number(row.qty1m),
        qty2m: Number(row.qty2m),
        qty3m: Number(row.qty3m),
        qty6m: Number(row.qty6m),
        qty1y: Number(row.qty1y),
        qty2y: Number(row.qty2y),
        forecast2m: forecast2m,
        abcClass: abcMap.get(row.code) || 'C'
      };
    });

    return NextResponse.json(processedResults);

  } catch (err) {
    console.error('[FORECAST API ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
