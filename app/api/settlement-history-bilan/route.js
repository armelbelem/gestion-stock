import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    // S'assurer de la présence de la table au cas où
    await db.query(`
      CREATE TABLE IF NOT EXISTS bilan_settlement_history (
        id VARCHAR(50) PRIMARY KEY,
        client_id VARCHAR(255) NOT NULL,
        client_name VARCHAR(255) NOT NULL,
        start_date VARCHAR(10) NOT NULL,
        end_date VARCHAR(10) NOT NULL,
        total_settled DECIMAL(15, 2) NOT NULL,
        user_id VARCHAR(255),
        username VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const [rows] = await db.query('SELECT * FROM bilan_settlement_history ORDER BY created_at DESC LIMIT 100');
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
