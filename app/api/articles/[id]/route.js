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
    await connection.query(
      'UPDATE articles SET code = ?, name = ?, price = ?, minStock = ?, barcode = ? WHERE id = ?',
      [code || null, name, price || 0, minStock || 0, barcode || null, articleId]
    );
    await logAction(auth.user.id, null, 'Modification article', { id: articleId, name });
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
