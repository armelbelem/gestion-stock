import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  let dateFilter = '';
  let params = [];
  if (startDate && endDate) {
    dateFilter = ' AND o.createdAt BETWEEN ? AND ? ';
    params = [startDate + ' 00:00:00', endDate + ' 23:59:59'];
  }

  try {
    // 1. Total par partenaire
    const [partnerTotals] = await db.query(`
      SELECT 
        p.name as partnerName,
        SUM(o.contractAmount) as totalAmount,
        COUNT(o.id) as orderCount
      FROM contract_partners p
      LEFT JOIN contract_orders o ON p.id = o.partner_id ${dateFilter}
      GROUP BY p.id, p.name
    `, params);

    // 2. Évolution mensuelle par partenaire
    const [monthlyEvolution] = await db.query(`
      SELECT 
        p.name as partnerName,
        DATE_FORMAT(o.createdAt, '%Y-%m') as month,
        SUM(o.contractAmount) as totalAmount
      FROM contract_partners p
      JOIN contract_orders o ON p.id = o.partner_id
      WHERE 1=1 ${dateFilter}
      GROUP BY p.id, p.name, month
      ORDER BY month ASC
    `, params);

    // 3. Articles les plus commandés par partenaire
    const [topArticles] = await db.query(`
      SELECT 
        p.name as partnerName,
        oi.description,
        SUM(oi.quantity) as totalQuantity,
        SUM(oi.quantity * oi.purchasePrice) as totalValue
      FROM contract_partners p
      JOIN contract_orders o ON p.id = o.partner_id
      JOIN contract_order_items oi ON o.id = oi.order_id
      WHERE 1=1 ${dateFilter}
      GROUP BY p.id, p.name, oi.description
      ORDER BY p.name, totalQuantity DESC
    `, params);

    // 4. Répartition par client final
    const [clientDistribution] = await db.query(`
      SELECT 
        c.name as clientName,
        SUM(o.contractAmount) as totalAmount
      FROM clients c
      JOIN contract_orders o ON c.id = o.client_id
      WHERE 1=1 ${dateFilter}
      GROUP BY c.id, c.name
      ORDER BY totalAmount DESC
    `, params);

    // 5. Temps moyen de traitement par partenaire (en heures)
    const [avgProcessingTime] = await db.query(`
      SELECT 
        p.name as partnerName,
        AVG(TIMESTAMPDIFF(HOUR, o.createdAt, h.createdAt)) as avgHours
      FROM contract_partners p
      JOIN contract_orders o ON p.id = o.partner_id
      JOIN contract_order_history h ON o.id = h.orderId
      WHERE h.newStatus = 'termine' ${dateFilter}
      GROUP BY p.id, p.name
    `, params);

    return NextResponse.json({
      partnerTotals,
      monthlyEvolution,
      topArticles,
      clientDistribution,
      avgProcessingTime
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
