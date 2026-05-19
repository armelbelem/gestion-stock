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
        SUM(coi.quantity) as totalQuantity,
        SUM(coi.quantity * coi.purchasePrice) as totalHT,
        SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 2 MONTH THEN coi.quantity ELSE 0 END) as qty2Months,
        SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 3 MONTH THEN coi.quantity ELSE 0 END) as qty3Months,
        SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 6 MONTH THEN coi.quantity ELSE 0 END) as qty6Months,
        p.name as partnerName
      FROM contract_order_items coi
      JOIN contract_orders co ON coi.orderId = co.id
      LEFT JOIN contract_partners p ON co.partner_id = p.id
      WHERE co.status = 'termine'
    `;
    const params = [];

    if (partnerId && partnerId !== 'all') {
      query += ` AND co.partner_id = ? `;
      params.push(partnerId);
    }

    // Regrouper par description, référence et prix unitaire
    query += ` GROUP BY coi.description, coi.refCfao, coi.code, coi.purchasePrice, p.name`;
    query += ` ORDER BY totalQuantity DESC`; // Trier par quantité totale vendue par défaut

    const [rows] = await db.query(query, params);
    
    // Calculer la TVA, le TTC et la rotation
    const consolidatedRows = rows.map(item => {
      const ht = Number(item.totalHT);
      const tva = ht * (globalTvaRate / 100);
      const totalQuantity = Number(item.totalQuantity);
      
      // Déterminer la rotation (forte, moyenne, faible)
      let rotation = 'Faible';
      let rotationColor = 'var(--info)'; // bleu
      if (totalQuantity >= 50) {
        rotation = 'Forte';
        rotationColor = 'var(--success)'; // vert
      } else if (totalQuantity >= 15) {
        rotation = 'Moyenne';
        rotationColor = 'var(--warning)'; // jaune
      }

      return {
        code: item.code || '',
        refCfao: item.refCfao || '',
        description: item.description,
        unitPrice: Number(item.unitPrice),
        totalQuantity,
        totalHT: ht,
        tvaRate: globalTvaRate,
        tvaAmount: tva,
        totalTTC: ht + tva,
        qty2Months: Number(item.qty2Months),
        qty3Months: Number(item.qty3Months),
        qty6Months: Number(item.qty6Months),
        rotation,
        rotationColor,
        partnerName: item.partnerName || ''
      };
    });

    return NextResponse.json(consolidatedRows);
  } catch (err) {
    console.error("[CONTRACT REPORTS PRODUCTS GET ERROR]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
