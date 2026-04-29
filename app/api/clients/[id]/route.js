import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  const { name, email, phone, address } = await request.json();
  try {
    await db.query('UPDATE clients SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?', 
      [name, email || null, phone || null, address || null, id]);
    await logAction(auth.user.id, null, 'Modification client', { id, name });
    return NextResponse.json({ success: true });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await params;
  try {
    const [sales] = await db.query('SELECT count(*) as count FROM sales WHERE clientId = ?', [id]);
    if (sales[0].count > 0) throw new Error('Impossible de supprimer : ce client a des ventes enregistrées.');
    await db.query('DELETE FROM clients WHERE id = ?', [id]);
    await logAction(auth.user.id, null, 'Suppression client', { id });
    return NextResponse.json({ success: true });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 400 }); }
}
