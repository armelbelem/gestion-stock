import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken } from '../../lib/auth';

// Extensions autorisées (liste blanche stricte)
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx', '.xls', '.xlsx']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 Mo

export async function POST(request) {
  // 🔐 Vérification d'authentification
  const auth = authenticateToken(request);
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // 🔐 Validation de la taille côté serveur
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 5 Mo)' }, { status: 413 });
    }

    // 🔐 Validation de l'extension (liste blanche)
    const ext = extname(file.name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json({ error: `Extension non autorisée : ${ext}` }, { status: 400 });
    }

    // 🔐 Validation du type MIME déclaré
    if (file.type && !ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: `Type de fichier non autorisé : ${file.type}` }, { status: 400 });
    }

    // 🔐 Nom de fichier sécurisé : UUID + extension validée uniquement (pas de path traversal)
    const safeFilename = `${uuidv4()}${ext}`;
    const uploadDir = join(process.cwd(), 'public', 'uploads');

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(join(uploadDir, safeFilename), buffer);

    const url = `/uploads/${safeFilename}`;
    return NextResponse.json({ success: true, url });

  } catch (err) {
    console.error('[UPLOAD ERROR]', err.message);
    return NextResponse.json({ error: 'Erreur lors du téléchargement' }, { status: 500 });
  }
}
