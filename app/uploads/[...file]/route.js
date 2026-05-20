import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { stat } from 'fs/promises';

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
};

export async function GET(request, { params }) {
  try {
    const { file } = await params;
    const filePath = join(process.cwd(), 'public', 'uploads', ...file);

    try {
      await stat(filePath);
    } catch (err) {
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = await readFile(filePath);
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Error serving file:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
