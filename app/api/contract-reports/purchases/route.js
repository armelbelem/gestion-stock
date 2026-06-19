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
    let orderIdsQuery = `
      SELECT DISTINCT co.id
      FROM contract_orders co
      LEFT JOIN deliveries d ON co.id = d.order_id
      WHERE co.status != 'ANNULÉ'
    `;
    const orderIdsParams = [];

    if (partnerId && partnerId !== 'all') {
      orderIdsQuery += ` AND co.partner_id = ?`;
      orderIdsParams.push(partnerId);
    }

    if (clientId && clientId !== 'all') {
      orderIdsQuery += ` AND co.clientId = ?`;
      orderIdsParams.push(clientId);
    }

    if (status && status !== 'all') {
      orderIdsQuery += ` AND co.status = ?`;
      orderIdsParams.push(status);
    }

    if (startDate && endDate) {
      orderIdsQuery += ` AND (
        (co.createdAt BETWEEN ? AND ?)
        OR (d.created_at BETWEEN ? AND ?)
      )`;
      orderIdsParams.push(
        `${startDate} 00:00:00`, `${endDate} 23:59:59`,
        `${startDate} 00:00:00`, `${endDate} 23:59:59`
      );
    }

    const [orderIdRows] = await db.query(orderIdsQuery, orderIdsParams);
    if (orderIdRows.length === 0) {
      return NextResponse.json([]);
    }
    const orderIds = orderIdRows.map(row => row.id);

    let itemsQuery = `
      SELECT 
        coi.id as itemId,
        coi.orderId,
        coi.code,
        coi.refCfao,
        coi.description,
        coi.purchasePrice,
        coi.quantity as quantityOrdered,
        co.createdAt as orderDate,
        co.status as orderStatus,
        c.name as clientName,
        p.name as partnerName,
        co.partner_id as partnerId,
        co.clientId,
        co.tva_rate as tvaRate,
        CASE 
          WHEN bc.bc_number IS NOT NULL AND bc.bc_number != '' THEN bc.bc_number
          ELSE CONCAT('BC-', LPAD(COALESCE(co.orderNumber, 0), 3, '0'), '-', DATE_FORMAT(COALESCE(co.createdAt, NOW()), '%d%m-%Y'))
        END as bcNumber
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
      WHERE co.id IN (?)
    `;
    const [items] = await db.query(itemsQuery, [orderIds]);

    const [deliveries] = await db.query(
      'SELECT id, order_id, bl_number, items as itemsJson, created_at FROM deliveries WHERE order_id IN (?)',
      [orderIds]
    );

    const enrichedRows = [];

    for (const item of items) {
      const purchasePrice = parseFloat(item.purchasePrice) || 0;
      const originalQtyOrdered = parseInt(item.quantityOrdered) || 0;

      // Find deliveries matching this order
      const orderDeliveries = deliveries.filter(d => d.order_id === item.orderId);

      let qtyDeliveredPrior = 0;
      let qtyDeliveredInPeriod = 0;
      let qtyDeliveredAfter = 0;
      let latestDeliveryDateInPeriod = null;

      for (const del of orderDeliveries) {
        let delItems = [];
        try {
          delItems = del.itemsJson ? (typeof del.itemsJson === 'string' ? JSON.parse(del.itemsJson) : del.itemsJson) : [];
        } catch (e) {
          console.error("Error parsing items for delivery:", del.id, e);
        }

        const deliveryArticles = delItems.filter(it => !it.isMetadata);

        // Find if this article was delivered in this BL
        const match = deliveryArticles.find(da => 
          (item.code && da.code === item.code) ||
          (item.refCfao && (da.refCfao === item.refCfao || da.ref === item.refCfao)) ||
          (da.description === item.description)
        );

        if (match) {
          const qtyDelivered = parseInt(match.quantity) || 0;
          const delDate = new Date(del.created_at);

          if (startDate && endDate) {
            const start = new Date(`${startDate} 00:00:00`);
            const end = new Date(`${endDate} 23:59:59`);

            if (delDate < start) {
              qtyDeliveredPrior += qtyDelivered;
            } else if (delDate > end) {
              qtyDeliveredAfter += qtyDelivered;
            } else {
              qtyDeliveredInPeriod += qtyDelivered;
              if (!latestDeliveryDateInPeriod || delDate > latestDeliveryDateInPeriod) {
                latestDeliveryDateInPeriod = delDate;
              }
            }
          } else {
            qtyDeliveredInPeriod += qtyDelivered;
            if (!latestDeliveryDateInPeriod || delDate > latestDeliveryDateInPeriod) {
              latestDeliveryDateInPeriod = delDate;
            }
          }
        }
      }

      // Check if ordered in period
      let isOrderedInPeriod = true;
      if (startDate && endDate) {
        const orderDate = new Date(item.orderDate);
        const start = new Date(`${startDate} 00:00:00`);
        const end = new Date(`${endDate} 23:59:59`);
        isOrderedInPeriod = orderDate >= start && orderDate <= end;
      }

      // If it was not ordered in the period AND not delivered in the period, we skip it
      if (!isOrderedInPeriod && qtyDeliveredInPeriod === 0) {
        continue;
      }

      const qtyOrdered = isOrderedInPeriod ? originalQtyOrdered : 0;
      const qtyDelivered = qtyDeliveredInPeriod;
      // Remaining is the global remaining for the order up to the end of the period
      const qtyRemaining = Math.max(0, originalQtyOrdered - (qtyDeliveredPrior + qtyDeliveredInPeriod));

      // Use the delivery date if delivered in this period, otherwise the order date
      const displayDate = (qtyDeliveredInPeriod > 0 && latestDeliveryDateInPeriod) ? latestDeliveryDateInPeriod : item.orderDate;

      const totalHTOrdered = qtyOrdered * purchasePrice;
      const totalHTDelivered = qtyDelivered * purchasePrice;
      const totalHTRemaining = qtyRemaining * purchasePrice;

      const tvaRate = parseFloat(item.tvaRate) || 18;
      const tvaMultiplier = 1 + (tvaRate / 100);

      enrichedRows.push({
        orderId: item.orderId,
        bcNumber: item.bcNumber,
        orderDate: displayDate,
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
      });
    }

    // Sort by orderDate desc, then itemId asc
    enrichedRows.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

    return NextResponse.json(enrichedRows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
