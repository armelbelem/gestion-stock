import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { getStoreConstraint, logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    let query = 'SELECT m.*, a.name as articleName, s.name as storeName FROM mouvements m JOIN articles a ON m.articleId = a.id LEFT JOIN stores s ON m.storeId = s.id';
    let params = [];
    if (storeId) { query += ' WHERE m.storeId = ?'; params.push(storeId); }
    query += ' ORDER BY m.date DESC';
    const [mouv] = await db.query(query, params);
    return NextResponse.json(mouv);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { articleId, type, quantity, notes, supplierId, storeId: bodyStoreId } = await request.json();
  const movId = uuidv4();
  
  const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
  const activeYear = fyRows[0];
  
  const storeId = auth.user.role === 'admin' ? (bodyStoreId || auth.user.storeId) : auth.user.storeId;
  if (!storeId) return NextResponse.json({ error: "Magasin non spécifié" }, { status: 400 });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      'INSERT INTO mouvements (id, articleId, type, quantity, date, notes, supplierId, fiscalYearId, storeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [movId, articleId, type, quantity, new Date().toISOString(), notes || null, supplierId || null, activeYear?.id || null, storeId]
    );
    
    const [inv] = await connection.query('SELECT * FROM inventory WHERE storeId = ? AND articleId = ?', [storeId, articleId]);
    if (inv.length === 0) {
      await connection.query('INSERT INTO inventory (id, storeId, articleId, quantity) VALUES (?, ?, ?, ?)', 
        [uuidv4(), storeId, articleId, type === 'IN' ? quantity : -quantity]);
    } else {
      const op = type === 'IN' ? '+' : '-';
      await connection.query(`UPDATE inventory SET quantity = quantity ${op} ? WHERE storeId = ? AND articleId = ?`, [quantity, storeId, articleId]);
    }

    await logAction(auth.user.id, storeId, `Mouvement Stock ${type}`, { articleId, quantity });
    await connection.commit();
    return NextResponse.json({ id: movId, success: true }, { status: 201 });
  } catch (err) { 
    await connection.rollback(); 
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  } finally { connection.release(); }
}
