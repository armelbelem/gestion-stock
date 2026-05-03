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
    let query = 'SELECT * FROM categories';
    let params = [];
    if (storeId) { query += ' WHERE storeId = ? OR storeId IS NULL'; params.push(storeId); }
    query += ' ORDER BY createdAt DESC';
    const [cats] = await db.query(query, params);
    return NextResponse.json(cats);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seul l'admin ou un gérant peut créer des catégories
  if (auth.user.role !== 'admin' && auth.user.role !== 'manager') {
    return NextResponse.json({ error: 'Accès interdit : Administrateur ou Gérant requis pour créer des catégories' }, { status: 403 });
  }

  const { name, description } = await request.json();

  const catId = uuidv4();
  const storeId = auth.user.role === 'admin' ? (null) : auth.user.storeId;
  try {
    await db.query('INSERT INTO categories (id, name, description, createdAt, storeId) VALUES (?, ?, ?, ?, ?)', 
      [catId, name, description || null, new Date().toISOString(), storeId]);
    await logAction(auth.user.id, storeId, 'Création catégorie', { name });
    const [rows] = await db.query('SELECT * FROM categories WHERE id = ?', [catId]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
