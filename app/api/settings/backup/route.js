import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 });

  try {
    const tables = [
      'articles', 'categories', 'clients', 'external_orders', 'external_order_items', 
      'fiscal_years', 'fournisseurs', 'inventory', 'logs', 'mouvements', 
      'payments', 'sale_items', 'sales', 'stores', 'transfers', 'users', 'settings'
    ];

    const backup = {};

    for (const table of tables) {
      try {
        let rows;
        if (table === 'users') {
          // Sécurité : Ne jamais exporter les hashs de mots de passe
          [rows] = await db.query('SELECT id, username, role, storeId, permissions, createdAt FROM users');
        } else {
          [rows] = await db.query(`SELECT * FROM ${table}`);
        }
        backup[table] = rows;
      } catch (tableErr) {
        console.error(`Error backing up table ${table}:`, tableErr);
        backup[table] = { error: tableErr.message };
      }
    }

    const backupContent = JSON.stringify(backup, null, 2);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_mining_autolog_${timestamp}.json`;

    return new NextResponse(backupContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`
      },
    });
  } catch (err) {
    console.error('[BACKUP GLOBAL ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
