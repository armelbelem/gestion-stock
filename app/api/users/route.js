import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const [users] = await db.query(`
      SELECT u.id, u.username, u.role, u.storeId, s.name as storeName, u.createdAt 
      FROM users u LEFT JOIN stores s ON u.storeId = s.id
    `);
    return NextResponse.json(users);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { username, password, role, storeId } = await request.json();
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const id = uuidv4();
    await db.query('INSERT INTO users (id, username, password, role, storeId) VALUES (?, ?, ?, ?, ?)', 
      [id, username, hashedPassword, role, storeId]);
    await logAction(auth.user.id, auth.user.storeId, 'Création utilisateur', { username, role });
    return NextResponse.json({ id, username, role, storeId }, { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
