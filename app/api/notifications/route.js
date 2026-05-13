import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const notifications = [];

    // 1. STOCKS CRITIQUES
    const [criticalStock] = await db.query(`
      SELECT a.id, a.name, SUM(i.quantity) as totalQty, a.minStock
      FROM articles a
      JOIN inventory i ON a.id = i.articleId
      GROUP BY a.id, a.name, a.minStock
      HAVING totalQty <= a.minStock
    `);
    
    criticalStock.forEach(item => {
      notifications.push({
        id: `stock-${item.id}`,
        type: 'danger',
        title: 'Stock Critique',
        message: `${item.name} (${item.totalQty} restants)`,
        link: '/articles',
        createdAt: new Date().toISOString()
      });
    });

    // 2. DOSSIERS PARTENAIRES EN SOUFFRANCE (> 48h)
    const [lateContractOrders] = await db.query(`
      SELECT id, orderNumber, createdAt, delivery_date
      FROM contract_orders
      WHERE status NOT IN ('termine', 'annule')
      AND (
        createdAt < DATE_SUB(NOW(), INTERVAL 2 DAY)
        OR (delivery_date IS NOT NULL AND delivery_date <= CURDATE())
      )
    `);

    lateContractOrders.forEach(order => {
      const isLateDelivery = order.delivery_date && new Date(order.delivery_date) <= new Date();
      notifications.push({
        id: `contract-${order.id}`,
        type: isLateDelivery ? 'danger' : 'warning',
        title: isLateDelivery ? 'Retard Livraison' : 'Dossier en retard',
        message: isLateDelivery 
          ? `Livraison prévue dépassée pour Dossier #${String(order.orderNumber).padStart(3, '0')}`
          : `Dossier #${String(order.orderNumber).padStart(3, '0')} en attente depuis 2+ jours`,
        link: '/contract-gateway',
        createdAt: order.delivery_date || order.createdAt
      });
    });

    // 3. COMMANDES SPÉCIALES EN ATTENTE (> 48h)
    const [lateExternalOrders] = await db.query(`
      SELECT id, date
      FROM external_orders
      WHERE status = 'en_attente'
      AND date < DATE_SUB(NOW(), INTERVAL 2 DAY)
    `);

    lateExternalOrders.forEach(order => {
      notifications.push({
        id: `external-${order.id}`,
        type: 'info',
        title: 'Commande Spéciale',
        message: `Commande #${order.id.substring(0, 8)} en attente`,
        link: '/external-orders',
        createdAt: order.date
      });
    });

    // Trier par date
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return NextResponse.json(notifications);
  } catch (err) {
    console.error('[NOTIFICATIONS API ERROR]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
