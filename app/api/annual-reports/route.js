import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    // Pour l'instant, on renvoie simplement la liste des exercices clos 
    // en attendant d'avoir un vrai système d'archivage PDF
    const [rows] = await db.query("SELECT id, name as yearName, createdAt FROM fiscal_years WHERE status = 'closed' ORDER BY createdAt DESC");
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ 
      error: err.message, 
      details: err.stack 
    }, { status: 500 });
  }
}
