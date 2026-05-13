import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  if (auth.user.role !== 'admin') return NextResponse.json({ error: 'Interdit' }, { status: 403 });

  try {
    // Trouver l'exercice actif
    const [rows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    if (rows.length === 0) {
      return NextResponse.json({ error: "Aucun exercice actif trouvé" }, { status: 404 });
    }

    const activeYear = rows[0];
    const endDate = new Date().toISOString();

    // 1. Calculer les statistiques de clôture (Ventes normales + Commandes spéciales)
    const [salesStats] = await db.query(`
      SELECT 
        SUM(totalAmount) as totalRev,
        SUM(amountPaid) as totalPaid
      FROM sales 
      WHERE fiscalYearId = ? AND status != 'annulée'
    `, [activeYear.id]);

    const revenue = (Number(salesStats[0].totalRev) || 0);
    const paid = (Number(salesStats[0].totalPaid) || 0);
    const debt = revenue - paid;

    // 2. Mettre à jour la base de données
    await db.query("UPDATE fiscal_years SET status = 'closed', endDate = ? WHERE id = ?", [endDate, activeYear.id]);

    await logAction(auth.user.id, null, 'Clôture exercice fiscal', { name: activeYear.name, revenue });
    return NextResponse.json({ 
      success: true, 
      message: "Exercice clôturé avec succès.",
      data: { revenue, paid, debt, name: activeYear.name, startDate: activeYear.startDate, endDate }
    });
  } catch (err) {
    console.error('[CLOSE FY ERROR]', err);
    return NextResponse.json({ 
      error: err.message, 
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    }, { status: 500 });
  }
}
