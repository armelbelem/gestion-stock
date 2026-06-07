import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken, hasPermission } from '../../../lib/auth';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Vérification des droits serveur
  if (!hasPermission(auth.user, 'stock', 'view_cost_price')) {
    return NextResponse.json({ error: "Accès refusé : Droits insuffisants pour voir les prix" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const partnerId = searchParams.get('partnerId');

  try {
    // Récupérer le taux de TVA actuel des paramètres
    const [settingsRows] = await db.query('SELECT tvaRate FROM settings LIMIT 1');
    const globalTvaRate = Number(settingsRows[0]?.tvaRate || 18);

    let query = `
      SELECT 
        coi.code,
        coi.refCfao,
        coi.description,
        coi.purchasePrice as unitPrice,
        SUM(coi.delivered_quantity) as totalQuantity,
        SUM(coi.delivered_quantity * coi.purchasePrice) as totalHT,
        p.name as partnerName
      FROM contract_order_items coi
      JOIN contract_orders co ON coi.orderId = co.id
      LEFT JOIN contract_partners p ON co.partner_id = p.id
      WHERE co.status = 'CLÔTURÉ'
    `;
    const params = [];

    if (partnerId && partnerId !== 'all') {
      query += ` AND co.partner_id = ? `;
      params.push(partnerId);
    }

    if (startDate && endDate) {
      query += ` AND co.createdAt BETWEEN ? AND ? `;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    // Regrouper par description, référence et prix unitaire
    query += ` GROUP BY coi.description, coi.refCfao, coi.code, coi.purchasePrice, p.name`;
    query += ` ORDER BY coi.description ASC`;

    const [rows] = await db.query(query, params);
    
    // Calculer la TVA et le TTC pour chaque ligne groupée
    const consolidatedRows = rows.map(item => {
      const ht = Number(item.totalHT);
      const tva = ht * (globalTvaRate / 100); 
      return {
        ...item,
        tvaRate: globalTvaRate,
        tvaAmount: tva,
        totalTTC: ht + tva
      };
    });

    return NextResponse.json(consolidatedRows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
