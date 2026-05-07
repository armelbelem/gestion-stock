import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [rows] = await db.query('SELECT * FROM documents ORDER BY uploadedAt DESC');
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const name = formData.get('name') || file.name;
    const category = formData.get('category') || 'Non classé';
    const notes = formData.get('notes') || '';

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExt = path.extname(file.name);
    const fileName = `${uuidv4()}${fileExt}`;
    const relativePath = `/uploads/documents/${fileName}`;
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', 'documents', fileName);

    await writeFile(absolutePath, buffer);

    const docId = uuidv4();
    await db.query(
      'INSERT INTO documents (id, name, category, filePath, fileType, fileSize, userId, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [docId, name, category, relativePath, file.type, file.size, auth.user.id, notes]
    );

    await logAction(auth.user.id, auth.user.storeId, 'Création document archive', { id: docId, name, category });

    return NextResponse.json({ id: docId, success: true }, { status: 201 });
  } catch (err) {
    console.error('[DOCUMENTS POST ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

    const [rows] = await db.query('SELECT name, filePath FROM documents WHERE id = ?', [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Document non trouvé' }, { status: 404 });

    const { name, filePath } = rows[0];
    const absolutePath = path.join(process.cwd(), 'public', filePath);

    await db.query('DELETE FROM documents WHERE id = ?', [id]);
    
    await logAction(auth.user.id, auth.user.storeId, 'Suppression document archive', { id, name });

    try {
      await unlink(absolutePath);
    } catch (e) {
      console.warn('[DOC DELETE] Could not delete physical file:', e.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
