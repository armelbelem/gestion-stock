import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { searchParams } = new URL(request.url);
    const hasPage = searchParams.has('page');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    const search = searchParams.get('search') || searchParams.get('searchTerm') || '';
    const category = searchParams.get('category') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    let baseQuery = ' FROM documents WHERE 1=1';
    let params = [];

    if (category && category !== 'Tous') {
      baseQuery += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      baseQuery += ' AND (name LIKE ? OR notes LIKE ?)';
      const likeTerm = `%${search}%`;
      params.push(likeTerm, likeTerm);
    }

    if (startDate) {
      baseQuery += ' AND uploadedAt >= ?';
      params.push(startDate + ' 00:00:00');
    }
    if (endDate) {
      baseQuery += ' AND uploadedAt <= ?';
      params.push(endDate + ' 23:59:59');
    }

    if (!hasPage) {
      const [rows] = await db.query('SELECT * ' + baseQuery + ' ORDER BY uploadedAt DESC', params);
      return NextResponse.json(rows);
    }

    const countSql = 'SELECT COUNT(*) as total ' + baseQuery;
    const [countRows] = await db.query(countSql, params);
    const totalItems = countRows[0]?.total || 0;

    const dataSql = 'SELECT * ' + baseQuery + ` ORDER BY uploadedAt DESC LIMIT ${limit} OFFSET ${offset}`;
    const [rows] = await db.query(dataSql, params);

    return NextResponse.json({
      data: rows,
      pagination: {
        total: totalItems,
        page: page,
        limit: limit,
        totalPages: Math.ceil(totalItems / limit)
      }
    });
  } catch (err) {
    console.error('[API DOCUMENTS GET ERROR]', err);
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

    // Sécurité serveur : Limite à 5 Mo
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Le fichier dépasse la limite de 5 Mo' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExt = path.extname(file.name).toLowerCase();
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.xlsx', '.txt', '.zip'];
    
    if (!allowedExtensions.includes(fileExt)) {
      return NextResponse.json({ 
        error: `Type de fichier non autorisé (${fileExt}). Extensions acceptées : ${allowedExtensions.join(', ')}` 
      }, { status: 400 });
    }

    const fileName = `${uuidv4()}${fileExt}`;
    const relativePath = `/uploads/documents/${fileName}`;
    const absolutePath = path.join(process.cwd(), 'public', 'uploads', 'documents', fileName);
    const dirPath = path.dirname(absolutePath);

    // Créer le dossier s'il n'existe pas (nécessaire car ignoré dans .gitignore)
    try {
      await mkdir(dirPath, { recursive: true });
    } catch (e) {
      console.warn('[DOCUMENTS POST] Failed to ensure directory exists:', e.message);
    }

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
