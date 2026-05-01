import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [rows] = await db.query('SELECT * FROM fiscal_years ORDER BY createdAt DESC');
    return NextResponse.json(rows);
  } catch (err) { 
    return NextResponse.json({ error: err.message, details: err.stack }, { status: 500 }); 
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });
  const { name, startDate } = await request.json();
  const id = uuidv4();
  try {
    // Close any currently active year first
    await db.query("UPDATE fiscal_years SET status = 'closed' WHERE status = 'active'");
    await db.query('INSERT INTO fiscal_years (id, name, startDate, status) VALUES (?, ?, ?, ?)',
      [id, name, startDate, 'active']);
    await logAction(auth.user.id, null, 'Création exercice fiscal', { name });
    const [rows] = await db.query('SELECT * FROM fiscal_years WHERE id = ?', [id]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
