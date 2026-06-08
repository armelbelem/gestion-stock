import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [rows] = await db.query(`
      SELECT s.*, c.name as defaultClientName 
      FROM stores s 
      LEFT JOIN clients c ON s.defaultClientId = c.id 
      ORDER BY s.name ASC
    `);
    return NextResponse.json(rows);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  const { name, address, defaultClientId } = await request.json();
  try {
    const [result] = await db.query(
      'INSERT INTO stores (name, address, defaultClientId) VALUES (?, ?, ?)', 
      [name, address || null, defaultClientId || null]
    );
    const id = result.insertId;
    await logAction(auth.user.id, null, 'Création magasin', { name });
    return NextResponse.json({ id, name, address, defaultClientId }, { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
