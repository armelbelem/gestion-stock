import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [rows] = await db.query('SELECT * FROM settings WHERE id = 1');
    return NextResponse.json(rows[0] || {});
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
