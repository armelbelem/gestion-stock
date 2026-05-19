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
        cc.code,
        cc.refCfao,
        cc.name as description,
        cc.purchasePrice as unitPrice,
        COALESCE(SUM(coi.quantity), 0) as totalQuantity,
        COALESCE(SUM(coi.quantity * coi.purchasePrice), 0) as totalHT,
        COALESCE(SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 2 MONTH THEN coi.quantity ELSE 0 END), 0) as qty2Months,
        COALESCE(SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 3 MONTH THEN coi.quantity ELSE 0 END), 0) as qty3Months,
        COALESCE(SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 6 MONTH THEN coi.quantity ELSE 0 END), 0) as qty6Months,
        p.name as partnerName
      FROM contract_catalog cc
      LEFT JOIN contract_partners p ON cc.partner_id = p.id
      LEFT JOIN contract_order_items coi ON (
        (cc.code IS NOT NULL AND cc.code != '' AND coi.code = cc.code) 
        OR 
        (cc.refCfao IS NOT NULL AND cc.refCfao != '' AND coi.refCfao = cc.refCfao)
      )
      LEFT JOIN contract_orders co ON (coi.orderId = co.id AND co.status = 'termine')
      WHERE 1=1
    `;
    const params = [];

    if (partnerId && partnerId !== 'all') {
      query += ` AND cc.partner_id = ? `;
      params.push(partnerId);
    }

    // Regrouper par catalogue
    query += ` GROUP BY cc.id, cc.code, cc.refCfao, cc.name, cc.purchasePrice, p.name`;
    query += ` ORDER BY totalQuantity DESC, cc.name ASC`;

    const [rows] = await db.query(query, params);
    
    // Calculer la TVA, le TTC et la rotation
    const consolidatedRows = rows.map(item => {
      const ht = Number(item.totalHT);
      const tva = ht * (globalTvaRate / 100);
      const totalQuantity = Number(item.totalQuantity);
      
      // Déterminer la rotation (forte, moyenne, faible, aucune)
      let rotation = 'Aucune';
      let rotationColor = '#94a3b8'; // gris neutre pour les produits hors-consommation
      if (totalQuantity >= 50) {
        rotation = 'Forte';
        rotationColor = 'var(--success)'; // vert
      } else if (totalQuantity >= 15) {
        rotation = 'Moyenne';
        rotationColor = 'var(--warning)'; // jaune
      } else if (totalQuantity > 0) {
        rotation = 'Faible';
        rotationColor = 'var(--info)'; // bleu
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
