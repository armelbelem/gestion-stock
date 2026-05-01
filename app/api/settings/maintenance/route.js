import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 });

  const body = await request.json();
  const { action } = body;

  try {
    if (action === 'clear_logs') {
      const { period = 30 } = body;
      const days = parseInt(period);
      // Supprimer les logs de plus de X jours
      const [result] = await db.query("DELETE FROM logs WHERE timestamp < DATE_SUB(NOW(), INTERVAL ? DAY)", [days]);
      await logAction(auth.user.id, auth.user.storeId, `Maintenance : Nettoyage des logs (> ${days}j)`, { deletedCount: result.affectedRows });
      return NextResponse.json({ success: true, message: `${result.affectedRows} logs anciens supprimés.` });
    }

    return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
