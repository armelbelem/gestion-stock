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
    if (storeId) { 
      query += ' WHERE storeId = ? OR storeId IS NULL OR id IN (SELECT defaultClientId FROM stores WHERE id = ?)'; 
      params.push(storeId, storeId); 
    }
    query += ' ORDER BY createdAt DESC';
    const [clients] = await db.query(query, params);
    return NextResponse.json(clients);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json();
  const { name, email, phone, address, clientCode, rccm, nif, bp } = body;
  const clientId = uuidv4();
  const storeId = (auth.user.role === 'admin' || auth.user.role === 'gestionnaire') ? (body.storeId || auth.user.storeId) : auth.user.storeId;
  try {
    await db.query('INSERT INTO clients (id, name, email, phone, address, storeId, clientCode, rccm, nif, bp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [clientId, name, email || null, phone || null, address || null, storeId, clientCode || null, rccm || null, nif || null, bp || null]);
    await logAction(auth.user.id, storeId, 'Création client', { name, clientCode });
    const [rows] = await db.query('SELECT * FROM clients WHERE id = ?', [clientId]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
