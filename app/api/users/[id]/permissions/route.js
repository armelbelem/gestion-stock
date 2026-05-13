import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { authenticateToken } from '../../../../lib/auth';
import { logAction } from '../../../../lib/actions';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seul l'admin peut modifier les permissions
  if (auth.user.role !== 'admin') {
    return NextResponse.json({ error: 'Accès interdit : Administrateur requis' }, { status: 403 });
  }

  const { id: userId } = await params;
  const { permissions } = await request.json();

  try {
    await db.query('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(permissions), userId]);
    await logAction(auth.user.id, null, 'Mise à jour permissions', { targetUserId: userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
