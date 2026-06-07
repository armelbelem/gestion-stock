import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken, hasPermission } from '../../../lib/auth';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Check permissions (must have view cost price access to see purchases report)
  if (!hasPermission(auth.user, 'stock', 'view_cost_price')) {
    return NextResponse.json({ error: "Accès refusé : Droits insuffisants pour voir les rapports d'achat." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const partnerId = searchParams.get('partnerId');
  const clientId = searchParams.get('clientId');
  const status = searchParams.get('status');

  try {
    let query = `
      SELECT 
        d.id as deliveryId,
        d.order_id as orderId,
        d.bl_number as blNumber,
        d.created_at as deliveryDate,
        d.items as deliveryItems,
        CASE 
          WHEN bc.bc_number IS NOT NULL AND bc.bc_number LIKE 'BC-%-%-%' THEN bc.bc_number
          ELSE CONCAT('BC-', LPAD(co.orderNumber, 3, '0'), '-', DATE_FORMAT(co.createdAt, '%d%m-%Y'))
        END as bcNumber,
        co.createdAt as orderDate,
        co.status as orderStatus,
        c.name as clientName,
        p.name as partnerName,
        co.partner_id as partnerId,
        co.clientId,
        co.tva_rate as tvaRate
      FROM deliveries d
      JOIN contract_orders co ON d.order_id = co.id
      LEFT JOIN clients c ON co.clientId = c.id
      LEFT JOIN contract_partners p ON co.partner_id = p.id
      LEFT JOIN (
        SELECT order_id, bc_number
        FROM contract_bc_history
        WHERE (order_id, created_at) IN (
          SELECT order_id, MAX(created_at)
          FROM contract_bc_history
          GROUP BY order_id
        )
      ) bc ON bc.order_id = co.id
      WHERE 1=1
    `;
    const params = [];

    if (partnerId && partnerId !== 'all') {
      query += ` AND co.partner_id = ?`;
      params.push(partnerId);
    }

    if (clientId && clientId !== 'all') {
      query += ` AND co.clientId = ?`;
      params.push(clientId);
    }

    if (status && status !== 'all') {
      query += ` AND co.status = ?`;
      params.push(status);
    } else {
      query += ` AND co.status != 'ANNULÉ'`;
    }

    if (startDate && endDate) {
      query += ` AND d.created_at BETWEEN ? AND ?`;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    query += ` ORDER BY d.created_at DESC`;

    const [deliveries] = await db.query(query, params);

    let enrichedRows = [];
    if (deliveries.length > 0) {
      const orderIds = [...new Set(deliveries.map(d => d.orderId))];
      const [orderItems] = await db.query(
        `SELECT id, orderId, code, refCfao, description, purchasePrice, quantity as quantityOrdered, delivered_quantity as quantityDelivered 
         FROM contract_order_items 
         WHERE orderId IN (?)`,
        [orderIds]
      );

      const itemsByOrder = {};
      orderItems.forEach(oi => {
        if (!itemsByOrder[oi.orderId]) {
          itemsByOrder[oi.orderId] = [];
        }
        itemsByOrder[oi.orderId].push(oi);
      });

      deliveries.forEach(del => {
        const rawItems = typeof del.deliveryItems === 'string' ? JSON.parse(del.deliveryItems || '[]') : (del.deliveryItems || []);
        const deliveryArticles = rawItems.filter(it => !it.isMetadata);
        const oItems = itemsByOrder[del.orderId] || [];

        deliveryArticles.forEach(delItem => {
          const qtyDeliveredThisBL = parseInt(delItem.quantity) || 0;
          if (qtyDeliveredThisBL <= 0) return;

          const match = oItems.find(oi => 
            (oi.code && delItem.code === oi.code) ||
            (oi.refCfao && delItem.refCfao === oi.refCfao) ||
            (delItem.description === oi.description)
          );

          const purchasePrice = match ? parseFloat(match.purchasePrice) || 0 : parseFloat(delItem.purchasePrice) || 0;
          const qtyOrdered = match ? parseInt(match.quantityOrdered) || 0 : parseInt(delItem.orderedQuantity) || 0;
          const qtyDeliveredTotal = match ? parseInt(match.quantityDelivered) || 0 : parseInt(delItem.deliveredQuantity) || 0;
          const qtyRemaining = Math.max(0, qtyOrdered - qtyDeliveredTotal);

          const totalHTOrdered = qtyOrdered * purchasePrice;
          const totalHTDelivered = qtyDeliveredThisBL * purchasePrice;
          const totalHTRemaining = qtyRemaining * purchasePrice;

          const tvaRate = parseFloat(del.tvaRate) || 18;
          const tvaMultiplier = 1 + (tvaRate / 100);

          enrichedRows.push({
            orderId: del.orderId,
            bcNumber: del.bcNumber,
            orderDate: del.deliveryDate,
            orderStatus: del.orderStatus,
            clientName: del.clientName,
            code: delItem.code || (match ? match.code : ''),
            refCfao: delItem.refCfao || (match ? match.refCfao : ''),
            description: delItem.description,
            purchasePrice,
            quantityOrdered: qtyOrdered,
            quantityDelivered: qtyDeliveredThisBL,
            quantityRemaining: qtyRemaining,
            partnerName: del.partnerName,
            tvaRate,
            totalHTOrdered,
            totalHTDelivered,
            totalHTRemaining,
            totalTTCOrdered: totalHTOrdered * tvaMultiplier,
            totalTTCDelivered: totalHTDelivered * tvaMultiplier,
            totalTTCRemaining: totalHTRemaining * tvaMultiplier
          });
        });
      });
    }

    return NextResponse.json(enrichedRows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
