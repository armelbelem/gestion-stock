import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [rows] = await db.query(`
      SELECT t.*, a.name as articleName, 
             s1.name as fromStoreName, s2.name as toStoreName,
             u.username as operatorName
      FROM transfers t
      JOIN articles a ON t.articleId = a.id
      JOIN stores s1 ON t.fromStoreId = s1.id
      JOIN stores s2 ON t.toStoreId = s2.id
      JOIN users u ON t.userId = u.id
      ORDER BY t.date DESC
    `);
    return NextResponse.json(rows);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { articleId, fromStoreId, toStoreId, quantity, notes } = await request.json();
  if (parseInt(quantity) <= 0) {
    return NextResponse.json({ error: "La quantité doit être supérieure à 0" }, { status: 400 });
  }
  const id = uuidv4();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [sourceInv] = await connection.query(
      'SELECT IFNULL(quantity, 0) as quantity FROM inventory WHERE storeId = ? AND articleId = ? FOR UPDATE', 
      [fromStoreId, articleId]
    );
    const availableQty = sourceInv.length > 0 ? sourceInv[0].quantity : 0;
    if (availableQty < quantity) throw new Error(`Stock insuffisant dans le magasin source (Disponible: ${availableQty}, Demandé: ${quantity})`);
    await connection.query('UPDATE inventory SET quantity = quantity - ? WHERE storeId = ? AND articleId = ?', [quantity, fromStoreId, articleId]);
    const [destInv] = await connection.query('SELECT id FROM inventory WHERE storeId = ? AND articleId = ?', [toStoreId, articleId]);
    if (destInv.length === 0) {
      await connection.query('INSERT INTO inventory (id, storeId, articleId, quantity) VALUES (?, ?, ?, ?)', [uuidv4(), toStoreId, articleId, quantity]);
    } else {
      await connection.query('UPDATE inventory SET quantity = quantity + ? WHERE storeId = ? AND articleId = ?', [quantity, toStoreId, articleId]);
    }
    await connection.query('INSERT INTO transfers (id, articleId, fromStoreId, toStoreId, quantity, userId, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, articleId, fromStoreId, toStoreId, quantity, auth.user.id, notes || null]);
    await logAction(auth.user.id, fromStoreId, 'Transfert de stock', { articleId, toStoreId, quantity });
    await connection.commit();
    return NextResponse.json({ id, success: true }, { status: 201 });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 400 });
  } finally { connection.release(); }
}
