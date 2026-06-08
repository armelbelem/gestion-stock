import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  const { name, address, defaultClientId } = await request.json();
  const { id } = await params;
  try {
    await db.query('UPDATE stores SET name = ?, address = ?, defaultClientId = ? WHERE id = ?', [name, address, defaultClientId || null, id]);
    await logAction(auth.user.id, id, 'Modification magasin', { name });
    return NextResponse.json({ success: true });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  const { id } = await params;
  try {
    const [articles] = await db.query('SELECT count(*) as count FROM articles WHERE storeId = ?', [id]);
    if (articles[0].count > 0) throw new Error('Impossible de supprimer : ce magasin contient des articles.');
    await db.query('DELETE FROM stores WHERE id = ?', [id]);
    await logAction(auth.user.id, null, 'Suppression magasin', { id });
    return NextResponse.json({ success: true });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 400 }); }
}
