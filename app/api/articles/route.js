import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { getStoreConstraint, logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    let query = `
      SELECT a.id, a.code, a.name, a.price, a.minStock, a.barcode, a.storeId, a.createdAt,
             s.name as createdInStoreName,
             COALESCE((
               SELECT SUM(quantity) FROM inventory 
               WHERE articleId = a.id 
               ${storeId ? 'AND storeId = ?' : ''}
             ), 0) as currentStock,
             (SELECT JSON_ARRAYAGG(JSON_OBJECT('storeName', s2.name, 'qty', i2.quantity))
              FROM inventory i2 
              JOIN stores s2 ON i2.storeId = s2.id 
              WHERE i2.articleId = a.id) as storeDetails
      FROM articles a
      LEFT JOIN stores s ON a.storeId = s.id
    `;
    let params = [];
    if (storeId) {
      params.push(storeId);
      query += ' WHERE (a.storeId = ? OR a.id IN (SELECT articleId FROM inventory WHERE storeId = ?))';
      params.push(storeId, storeId);
    }
    query += ' ORDER BY a.createdAt DESC';
    const [articles] = await db.query(query, params);
    return NextResponse.json(articles);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { code, name, price, currentStock, minStock, barcode, storeId: bodyStoreId } = await request.json();
  const artId = uuidv4();
  let storeId = bodyStoreId || auth.user.storeId;

  if (!storeId && auth.user.role === 'admin') {
    const [stores] = await db.query('SELECT id FROM stores LIMIT 1');
    if (stores.length > 0) storeId = stores[0].id;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('INSERT INTO articles (id, code, name, price, currentStock, minStock, barcode, storeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [artId, code || null, name, price || 0, currentStock || 0, minStock || 0, barcode || null, storeId]);
    await connection.query('INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), storeId, artId, currentStock || 0, minStock || 0]);
    await logAction(auth.user.id, storeId, 'Création article', { name, initialStock: currentStock });
    await connection.commit();
    return NextResponse.json({ id: artId, name }, { status: 201 });
  } catch (err) { 
    await connection.rollback(); 
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  } finally { connection.release(); }
}
