import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';

export async function GET(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;

  try {
    // 1. Récupérer les infos de l'exercice
    const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE id = ?", [id]);
    const fy = fyRows[0];
    if (!fy) return NextResponse.json({ error: "Exercice non trouvé" }, { status: 404 });

    // 2. Calculer les statistiques
    const [stats] = await db.query(`
      SELECT 
        SUM(totalAmount) as totalRev,
        SUM(amountPaid) as totalPaid
      FROM sales 
      WHERE fiscalYearId = ? AND status != 'annulée'
    `, [id]);

    const revenue = stats[0].totalRev || 0;
    const paid = stats[0].totalPaid || 0;
    const debt = revenue - paid;

    // 3. Statistiques par client
    const [clientStats] = await db.query(`
      SELECT 
        COALESCE(c.name, 'Client Anonyme') as clientName,
        SUM(s.totalAmount) as totalAmount,
        SUM(qi.totalQty) as totalItems
      FROM sales s
      LEFT JOIN clients c ON s.clientId = c.id
      LEFT JOIN (
        SELECT saleId, SUM(quantity) as totalQty FROM sale_items GROUP BY saleId
      ) qi ON s.id = qi.saleId
      WHERE s.fiscalYearId = ? AND s.status != 'annulée'
      GROUP BY s.clientId, c.name
      ORDER BY totalAmount DESC
    `, [id]);

    // 4. Nombre total d'articles vendus
    const [itemStats] = await db.query(`
      SELECT SUM(si.quantity) as totalItems 
      FROM sale_items si
      JOIN sales s ON si.saleId = s.id
      WHERE s.fiscalYearId = ? AND s.status != 'annulée'
    `, [id]);

    return NextResponse.json({
      revenue,
      paid,
      debt,
      totalItems: itemStats[0].totalItems || 0,
      clientStats,
      exercise: fy,
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
