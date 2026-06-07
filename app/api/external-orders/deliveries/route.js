import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  try {
    if (orderId) {
      const [rows] = await db.query(
        'SELECT * FROM external_deliveries WHERE external_order_id = ? ORDER BY created_at DESC',
        [orderId]
      );
      return NextResponse.json(rows);
    }
    const [rows] = await db.query('SELECT * FROM external_deliveries ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { orderId, items } = await request.json();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Fetch order details
    const [orders] = await connection.query('SELECT * FROM external_orders WHERE id = ?', [orderId]);
    const order = orders[0];
    if (!order) throw new Error('Commande introuvable');
    if (order.status === 'termine' || order.status === 'annule') {
      throw new Error('La commande est déjà finalisée ou annulée');
    }

    // 2. Fetch order items
    const [orderItems] = await connection.query('SELECT * FROM external_order_items WHERE externalOrderId = ?', [orderId]);

    // 3. Validation: prevent negative quantities or exceeding remaining quantity
    for (const delItem of items) {
      const delQty = parseInt(delItem.quantity_to_deliver) || 0;
      if (delQty < 0) {
        throw new Error(`La quantité à livrer ne peut pas être négative pour l'article "${delItem.description}".`);
      }
      if (delQty === 0) continue;

      const match = orderItems.find(oi => oi.id === delItem.id);
      if (!match) {
        throw new Error(`L'article "${delItem.description}" ne correspond à aucune ligne de la commande.`);
      }

      const remaining = match.quantity - (match.quantity_delivered || 0);
      if (delQty > remaining) {
        throw new Error(`La quantité à livrer (${delQty}) pour l'article "${delItem.description}" dépasse la quantité restante disponible (${remaining}).`);
      }
    }

    // 4. Generate sequential BL number using the shared document_sequences DAILY key
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dbDate = `${yyyy}-${mm}-${dd}`;
    const formattedDate = `${dd}${mm}-${yyyy}`;
    const dailyKey = `DAILY-BL-${dbDate}`;

    await connection.query(`
      INSERT INTO document_sequences (id, doc_type, doc_date, last_sequence)
      VALUES (?, 'DAILY', ?, 1)
      ON DUPLICATE KEY UPDATE last_sequence = last_sequence + 1
    `, [dailyKey, dbDate]);

    const [dailyRows] = await connection.query(
      'SELECT last_sequence FROM document_sequences WHERE id = ?',
      [dailyKey]
    );
    const sequence = dailyRows[0].last_sequence;
    const paddedSequence = String(sequence).padStart(3, '0');
    const blNumber = `BL-${paddedSequence}-${formattedDate}`;

    // 5. Insert delivery record
    const deliveryId = uuidv4();
    const deliveryItems = items.map(it => ({
      id: it.id,
      description: it.description,
      quantity: parseInt(it.quantity_to_deliver) || 0,
      purchasePrice: parseFloat(it.purchasePrice) || 0,
      sellPrice: parseFloat(it.sellPrice) || 0
    })).filter(it => it.quantity > 0);

    if (deliveryItems.length === 0) {
      throw new Error('Aucun article avec une quantité supérieure à 0 à livrer.');
    }

    await connection.query(
      'INSERT INTO external_deliveries (id, external_order_id, bl_number, items, created_by) VALUES (?, ?, ?, ?, ?)',
      [deliveryId, orderId, blNumber, JSON.stringify(deliveryItems), auth.user.username]
    );

    // 6. Update delivered quantities on items
    for (const delItem of deliveryItems) {
      await connection.query(
        'UPDATE external_order_items SET quantity_delivered = quantity_delivered + ? WHERE id = ?',
        [delItem.quantity, delItem.id]
      );
    }

    // 7. Check if all items are delivered to update order status
    const [updatedItems] = await connection.query(
      'SELECT quantity, quantity_delivered FROM external_order_items WHERE externalOrderId = ?',
      [orderId]
    );

    let allDelivered = true;
    let anyDelivered = false;
    for (const item of updatedItems) {
      if ((item.quantity_delivered || 0) < (item.quantity || 0)) {
        allDelivered = false;
      }
      if ((item.quantity_delivered || 0) > 0) {
        anyDelivered = true;
      }
    }

    let newStatus = order.status;
    if (allDelivered) {
      newStatus = 'termine';
    } else if (anyDelivered) {
      newStatus = 'partiel';
    }

    await connection.query('UPDATE external_orders SET status = ? WHERE id = ?', [newStatus, orderId]);

    await connection.commit();
    await logAction(auth.user.id, order.storeId, 'Livraison Commande Externe', { orderId, blNumber });
    return NextResponse.json({ success: true, id: deliveryId, blNumber, status: newStatus }, { status: 201 });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}
