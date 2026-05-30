import db from '../../lib/db';
import { authenticateToken, hasPermission } from '../../lib/auth';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Sécurité serveur : Seuls ceux qui ont droit de voir les coûts peuvent voir les stats financières globales
  if (!hasPermission(auth.user, 'stock', 'view_cost_price')) {
    return NextResponse.json({ error: "Accès refusé aux statistiques financières" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const partnerId = searchParams.get('partnerId');

  let dateFilter = '';
  let partnerFilter = '';
  let params = [];
  
  if (startDate && endDate) {
    dateFilter = ' AND DATE(o.createdAt) BETWEEN ? AND ? ';
    params.push(startDate, endDate);
  }

  if (partnerId) {
    partnerFilter = ' AND o.partner_id = ? ';
  }

  // Helper function to get combined params for each query
  const getQueryParams = () => {
    const qParams = [...params];
    if (partnerId) qParams.push(partnerId);
    return qParams;
  };

  try {
    // 1. Total par partenaire (TTC utilisant le taux archivé dans chaque dossier)
    const [partnerTotals] = await db.query(`
      SELECT 
        p.name as partnerName,
        SUM(o.contractAmount * (1 + o.tva_rate / 100)) as totalAmount,
        COUNT(o.id) as orderCount
      FROM contract_partners p
      LEFT JOIN contract_orders o ON p.id = o.partner_id ${dateFilter} ${partnerFilter} AND o.status != 'annule'
      GROUP BY p.id, p.name
    `, getQueryParams());

    // 2. Évolution mensuelle par partenaire (TTC)
    const [monthlyEvolution] = await db.query(`
      SELECT 
        p.name as partnerName,
        DATE_FORMAT(o.createdAt, '%Y-%m') as month,
        SUM(o.contractAmount * (1 + o.tva_rate / 100)) as totalAmount
      FROM contract_partners p
      JOIN contract_orders o ON p.id = o.partner_id
      WHERE o.status != 'annule' ${dateFilter} ${partnerFilter}
      GROUP BY p.id, p.name, month
      ORDER BY month ASC
    `, getQueryParams());

    // 3. Articles les plus commandés par partenaire (TTC)
    const [topArticles] = await db.query(`
      SELECT 
        p.name as partnerName,
        oi.description,
        SUM(oi.quantity) as totalQuantity,
        SUM(oi.quantity * oi.purchasePrice * (1 + o.tva_rate / 100)) as totalValue
      FROM contract_partners p
      JOIN contract_orders o ON p.id = o.partner_id
      JOIN contract_order_items oi ON o.id = oi.orderId
      WHERE o.status != 'annule' ${dateFilter} ${partnerFilter}
      GROUP BY p.id, p.name, oi.description
      ORDER BY p.name, totalQuantity DESC
    `, getQueryParams());

    // 4. Répartition par client final (TTC)
    const [clientDistribution] = await db.query(`
      SELECT 
        c.name as clientName,
        SUM(o.contractAmount * (1 + o.tva_rate / 100)) as totalAmount
      FROM clients c
      JOIN contract_orders o ON c.id = o.clientId
      WHERE o.status != 'annule' ${dateFilter} ${partnerFilter}
      GROUP BY c.id, c.name
      ORDER BY totalAmount DESC
    `, getQueryParams());

    // 5. Temps moyen de traitement par partenaire (en heures)
    const [avgProcessingTime] = await db.query(`
      SELECT 
        p.name as partnerName,
        AVG(TIMESTAMPDIFF(HOUR, o.createdAt, h.createdAt)) as avgHours
      FROM contract_partners p
      JOIN contract_orders o ON p.id = o.partner_id
      JOIN contract_order_history h ON o.id = h.orderId
      WHERE h.newStatus = 'termine' AND o.status != 'annule' ${dateFilter} ${partnerFilter}
      GROUP BY p.id, p.name
    `, getQueryParams());

    console.log('Stats params:', getQueryParams());
    console.log('partnerTotals rows:', partnerTotals.length, partnerTotals);
    console.log('monthlyEvolution rows:', monthlyEvolution.length);
    console.log('topArticles rows:', topArticles.length);

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
