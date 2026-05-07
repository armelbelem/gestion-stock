import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;

  try {
    const [rows] = await db.query('SELECT * FROM contract_special_docs WHERE id = ?', [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 });
    
    const doc = rows[0];
    doc.items = typeof doc.items === 'string' ? JSON.parse(doc.items || '[]') : (doc.items || []);
    
    return NextResponse.json(doc);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = params;
  console.log('Tentative de suppression du document spécial ID:', id);

  try {
    const [result] = await db.query('DELETE FROM contract_special_docs WHERE id = ?', [id]);
    console.log('Résultat suppression:', result);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erreur API suppression:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const { attachment } = body;

  try {
    await db.query('UPDATE contract_special_docs SET attachment = ? WHERE id = ?', [attachment, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
