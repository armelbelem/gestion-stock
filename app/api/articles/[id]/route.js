import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id: articleId } = await params;
  const { code, name, price, minStock, barcode } = await request.json();

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [oldDataRows] = await connection.query('SELECT name, price FROM articles WHERE id = ?', [articleId]);
    const oldData = oldDataRows[0];

    await connection.query(
      'UPDATE articles SET code = ?, name = ?, price = ?, minStock = ?, barcode = ? WHERE id = ?',
      [code || null, name, price || 0, minStock || 0, barcode || null, articleId]
    );

    let logMsg = `Modification article: ${name}`;
    if (oldData && oldData.price !== parseFloat(price)) {
      logMsg = `Changement prix article "${name}": ${oldData.price} -> ${price}`;
    } else if (oldData && oldData.name !== name) {
      logMsg = `Renommage article: "${oldData.name}" -> "${name}"`;
    }

    await logAction(auth.user.id, auth.user.storeId, logMsg, { id: articleId, old: oldData, new: { name, price } });
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  const { id: articleId } = await params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM inventory WHERE articleId = ?', [articleId]);
    await connection.query('DELETE FROM mouvements WHERE articleId = ?', [articleId]);
    await connection.query('DELETE FROM articles WHERE id = ?', [articleId]);
    await logAction(auth.user.id, null, 'Suppression article', { id: articleId });
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) { 
    await connection.rollback(); 
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  } finally { connection.release(); }
}
