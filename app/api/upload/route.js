import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uploadDir = join(process.cwd(), 'public', 'uploads');
    
    // Créer le dossier s'il n'existe pas
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {}

    const filename = `${uuidv4()}_${file.name.replace(/\s+/g, '_')}`;
    const path = join(uploadDir, filename);
    
    await writeFile(path, buffer);
    const url = `/uploads/${filename}`;

    return NextResponse.json({ success: true, url });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
