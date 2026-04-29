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
    let query = 'SELECT * FROM clients';
    let params = [];
    if (storeId) { query += ' WHERE storeId = ? OR storeId IS NULL'; params.push(storeId); }
    query += ' ORDER BY createdAt DESC';
    const [clients] = await db.query(query, params);
    return NextResponse.json(clients);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const { name, email, phone, address } = body;
  const clientId = uuidv4();
  const storeId = auth.user.role === 'admin' ? (body.storeId || auth.user.storeId) : auth.user.storeId;
  try {
    await db.query('INSERT INTO clients (id, name, email, phone, address, storeId) VALUES (?, ?, ?, ?, ?, ?)', 
      [clientId, name, email || null, phone || null, address || null, storeId]);
    await logAction(auth.user.id, storeId, 'Création client', { name });
    const [rows] = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
