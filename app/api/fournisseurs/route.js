import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [rows] = await db.query('SELECT * FROM fournisseurs ORDER BY name ASC');
    return NextResponse.json(rows);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { name, email, phone, address, rccm, nif, bp, myClientCode } = await request.json();
  const id = uuidv4();
  try {
    await db.query('INSERT INTO fournisseurs (id, name, email, phone, address, rccm, nif, bp, myClientCode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, email || null, phone || null, address || null, rccm || null, nif || null, bp || null, myClientCode || null]);
    await logAction(auth.user.id, null, 'Création fournisseur', { name });
    const [rows] = await db.query('SELECT * FROM fournisseurs WHERE id = ?', [id]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
