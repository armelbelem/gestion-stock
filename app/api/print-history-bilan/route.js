import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const [rows] = await db.query('SELECT * FROM bilan_client_history ORDER BY created_at DESC LIMIT 100');
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { id, clientId, clientName, period, totalAmount, printData } = body;

  try {
    await db.query(
      `INSERT INTO bilan_client_history (id, client_id, client_name, period, total_amount, print_data) 
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE client_id = VALUES(client_id), client_name = VALUES(client_name), period = VALUES(period), total_amount = VALUES(total_amount), print_data = VALUES(print_data)`,
      [
        id || Date.now().toString(),
        clientId,
        clientName || '',
        period || '',
        totalAmount || 0,
        JSON.stringify(printData || {})
      ]
    );

    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
