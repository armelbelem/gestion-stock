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
        cat.code,
        cat.refCfao,
        cat.description,
        cat.unitPrice,
        cat.partnerName,
        COALESCE(stats.totalQuantity, 0) as totalQuantity,
        COALESCE(stats.totalHT, 0) as totalHT,
        COALESCE(stats.qty2Months, 0) as qty2Months,
        COALESCE(stats.qty3Months, 0) as qty3Months,
        COALESCE(stats.qty6Months, 0) as qty6Months
      FROM (
        -- 1. Regroupement du catalogue par référence unique
        SELECT 
          COALESCE(NULLIF(cc.refCfao, ''), cc.code) as productRef,
          MAX(cc.code) as code,
          MAX(cc.refCfao) as refCfao,
          MAX(cc.name) as description,
          MAX(cc.purchasePrice) as unitPrice,
          MAX(p.name) as partnerName,
          MAX(cc.partner_id) as partner_id
        FROM contract_catalog cc
        LEFT JOIN contract_partners p ON cc.partner_id = p.id
        GROUP BY COALESCE(NULLIF(cc.refCfao, ''), cc.code)
      ) cat
      LEFT JOIN (
        -- 2. Regroupement des achats réels par référence unique (toutes mines confondues)
        SELECT 
          COALESCE(NULLIF(coi.refCfao, ''), coi.code) as orderProductRef,
          SUM(coi.quantity) as totalQuantity,
          SUM(coi.quantity * coi.purchasePrice) as totalHT,
          SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 2 MONTH THEN coi.quantity ELSE 0 END) as qty2Months,
          SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 3 MONTH THEN coi.quantity ELSE 0 END) as qty3Months,
          SUM(CASE WHEN co.createdAt >= NOW() - INTERVAL 6 MONTH THEN coi.quantity ELSE 0 END) as qty6Months
        FROM contract_order_items coi
        JOIN contract_orders co ON (coi.orderId = co.id AND co.status = 'termine')
        GROUP BY COALESCE(NULLIF(coi.refCfao, ''), coi.code)
      ) stats ON cat.productRef = stats.orderProductRef
      WHERE 1=1
    `;
    const params = [];

    if (partnerId && partnerId !== 'all') {
      query += ` AND cat.partner_id = ? `;
      params.push(partnerId);
    }

    query += ` ORDER BY totalQuantity DESC, cat.description ASC`;

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
