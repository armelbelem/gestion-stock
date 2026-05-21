import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken, hasPermission } from '../../lib/auth';
import { getStoreConstraint } from '../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  
  if (!hasPermission(auth.user, 'admin', 'logs')) {
    return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 50;
  const offset = (page - 1) * limit;
  const searchTerm = searchParams.get('searchTerm') || '';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const requestedStoreId = searchParams.get('storeId');
  
  const storeId = getStoreConstraint(auth.user, requestedStoreId);
  
  let baseQuery = " FROM logs l LEFT JOIN users u ON l.userId = u.id LEFT JOIN stores s ON l.storeId = s.id WHERE 1=1";
  let params = [];

  if (storeId) {
    baseQuery += ' AND l.storeId = ?';
    params.push(storeId);
  }

  if (searchTerm) {
    baseQuery += ' AND (l.action LIKE ? OR u.username LIKE ? OR l.details LIKE ?)';
    const likeTerm = "%" + searchTerm + "%";
    params.push(likeTerm, likeTerm, likeTerm);
  }

  if (startDate && endDate) {
    baseQuery += ' AND l.timestamp BETWEEN ? AND ?';
    params.push(startDate + " 00:00:00", endDate + " 23:59:59");
  }

  try {
    // 1. Count total
    const countSql = "SELECT COUNT(*) as total " + baseQuery;
    const [countRows] = await db.query(countSql, params);
    const totalItems = countRows[0]?.total || 0;

    // 2. Data
    // Utilisation directe des entiers limit/offset interpolés pour contourner les bugs de liaison de paramètres de certaines configurations MySQL de production.
    const dataSql = "SELECT l.*, u.username, s.name as storeName " + baseQuery + ` ORDER BY l.timestamp DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.query(dataSql, params);

    const result = {
      data: rows,
      pagination: {
        total: totalItems,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalItems / limit)
      }
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error('[API LOGS ERROR]', err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
