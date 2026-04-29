import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [rows] = await db.query('SELECT * FROM stores ORDER BY name ASC');
    return NextResponse.json(rows);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  const { name, address } = await request.json();
  const id = uuidv4();
  try {
    await db.query('INSERT INTO stores (id, name, address) VALUES (?, ?, ?)', [id, name, address || null]);
    await logAction(auth.user.id, null, 'Création magasin', { name });
    return NextResponse.json({ id, name, address }, { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
