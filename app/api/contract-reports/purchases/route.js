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
        coi.id as itemId,
        coi.orderId,
        coi.code,
        coi.refCfao,
        coi.description,
        coi.purchasePrice,
        coi.quantity as quantityOrdered,
        coi.delivered_quantity as quantityDelivered,
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
      FROM contract_order_items coi
      JOIN contract_orders co ON coi.orderId = co.id
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
      query += ` AND co.createdAt BETWEEN ? AND ?`;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    query += ` ORDER BY co.createdAt DESC, coi.id ASC`;

    const [rows] = await db.query(query, params);

    const enrichedRows = rows.map(item => {
      const purchasePrice = parseFloat(item.purchasePrice) || 0;
      const qtyOrdered = parseInt(item.quantityOrdered) || 0;
      const qtyDelivered = parseInt(item.quantityDelivered) || 0;
      const qtyRemaining = Math.max(0, qtyOrdered - qtyDelivered);

      const totalHTOrdered = qtyOrdered * purchasePrice;
      const totalHTDelivered = qtyDelivered * purchasePrice;
      const totalHTRemaining = qtyRemaining * purchasePrice;

      const tvaRate = parseFloat(item.tvaRate) || 18;
      const tvaMultiplier = 1 + (tvaRate / 100);

      return {
        orderId: item.orderId,
        bcNumber: item.bcNumber,
        orderDate: item.orderDate,
        orderStatus: item.orderStatus,
        clientName: item.clientName,
        code: item.code || '',
        refCfao: item.refCfao || '',
        description: item.description,
        purchasePrice,
        quantityOrdered: qtyOrdered,
        quantityDelivered: qtyDelivered,
        quantityRemaining: qtyRemaining,
        partnerName: item.partnerName,
        tvaRate,
        totalHTOrdered,
        totalHTDelivered,
        totalHTRemaining,
        totalTTCOrdered: totalHTOrdered * tvaMultiplier,
        totalTTCDelivered: totalHTDelivered * tvaMultiplier,
        totalTTCRemaining: totalHTRemaining * tvaMultiplier
      };
    });

    return NextResponse.json(enrichedRows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
