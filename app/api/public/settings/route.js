import { NextResponse } from 'next/server';
import db from '../../../lib/db';

export async function GET() {
  try {
    // On ne retourne que les informations publiques : nom et logo
    const [rows] = await db.query('SELECT companyName, logo FROM settings WHERE id = 1');
    return NextResponse.json(rows[0] || {});
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
