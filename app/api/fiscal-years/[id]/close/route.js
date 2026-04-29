import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { authenticateToken } from '../../../../lib/auth';
import { logAction } from '../../../../lib/actions';

export async function POST(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  const { id } = await params;
  try {
    await db.query("UPDATE fiscal_years SET status = 'closed', endDate = ? WHERE id = ?",
      [new Date().toISOString(), id]);
    await logAction(auth.user.id, null, 'Clôture exercice fiscal', { id });
    return NextResponse.json({ success: true });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
