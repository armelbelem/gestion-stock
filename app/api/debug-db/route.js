import db from '../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const [cols] = await db.query('SHOW COLUMNS FROM contract_partners');
    return NextResponse.json({
      database: db.pool.config.connectionConfig.database,
      user: db.pool.config.connectionConfig.user,
      host: db.pool.config.connectionConfig.host,
      columns: cols.map(c => c.Field)
    });
  } catch (err) {
    return NextResponse.json({ error: err.message });
  }
}
