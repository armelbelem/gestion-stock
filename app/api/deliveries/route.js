import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');

  try {
    if (orderId) {
      const [rows] = await db.query('SELECT * FROM deliveries WHERE order_id = ? ORDER BY created_at DESC', [orderId]);
      return NextResponse.json(rows);
    }
    const [rows] = await db.query('SELECT * FROM deliveries ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { orderId, blNumber, items } = await request.json();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [orderItems] = await connection.query('SELECT * FROM contract_order_items WHERE orderId = ?', [orderId]);
    const deliveryArticles = items.filter(it => !it.isMetadata);

    // Validation de sécurité : Empêcher les dépassements de quantité et valeurs négatives
    for (const delItem of deliveryArticles) {
      const delQty = parseInt(delItem.quantity) || 0;
      if (delQty < 0) {
        throw new Error(`La quantité à livrer ne peut pas être négative pour l'article "${delItem.description}".`);
      }
      if (delQty === 0) continue;

      const match = orderItems.find(oi => 
        (oi.code && delItem.code === oi.code) ||
        (oi.refCfao && delItem.refCfao === oi.refCfao) ||
        (delItem.description === oi.description)
      );

      if (!match) {
        throw new Error(`L'article "${delItem.description}" ne correspond à aucune ligne du dossier d'origine.`);
      }

      const remaining = match.quantity - (match.delivered_quantity || 0);
      if (delQty > remaining) {
        throw new Error(`La quantité à livrer (${delQty}) pour l'article "${delItem.description}" dépasse la quantité restante disponible (${remaining}).`);
      }
    }

    const deliveryId = uuidv4();
    await connection.query(
      'INSERT INTO deliveries (id, order_id, bl_number, items) VALUES (?, ?, ?, ?)',
      [deliveryId, orderId, blNumber, JSON.stringify(items)]
    );

    for (const delItem of deliveryArticles) {
      const delQty = parseInt(delItem.quantity) || 0;
      if (delQty <= 0) continue;

      const match = orderItems.find(oi => 
        (oi.code && delItem.code === oi.code) ||
        (oi.refCfao && delItem.refCfao === oi.refCfao) ||
        (delItem.description === oi.description)
      );

      if (match) {
        await connection.query(
          'UPDATE contract_order_items SET delivered_quantity = delivered_quantity + ? WHERE id = ?',
          [delQty, match.id]
        );
      }
    }

    const [updatedOrderItems] = await connection.query('SELECT quantity, delivered_quantity FROM contract_order_items WHERE orderId = ?', [orderId]);
    let allDelivered = true;
    let anyDelivered = false;

    for (const oi of updatedOrderItems) {
      const ordered = oi.quantity || 0;
      const delivered = oi.delivered_quantity || 0;

      if (delivered < ordered) {
        allDelivered = false;
      }
      if (delivered > 0) {
        anyDelivered = true;
      }
    }

    let newStatus = 'VALIDÉ';
    if (allDelivered && updatedOrderItems.length > 0) {
      newStatus = 'LIVRÉ';
    } else if (anyDelivered) {
      newStatus = 'PARTIELLEMENT_LIVRÉ';
    }

    const [currentOrder] = await connection.query('SELECT status FROM contract_orders WHERE id = ?', [orderId]);
    const oldStatus = currentOrder[0]?.status || 'BROUILLON';

    if (oldStatus !== newStatus && oldStatus !== 'CLÔTURÉ' && oldStatus !== 'ANNULÉ') {
      await connection.query(
        'UPDATE contract_orders SET status = ? WHERE id = ?',
        [newStatus, orderId]
      );
      await connection.query(
        'INSERT INTO contract_order_history (orderId, oldStatus, newStatus, userId) VALUES (?, ?, ?, ?)',
        [orderId, oldStatus, newStatus, auth.user.id]
      );
    }

    await connection.commit();
    await logAction(auth.user.id, auth.user.storeId, 'Création BL', { orderId, blNumber });
    return NextResponse.json({ success: true, id: deliveryId, newStatus }, { status: 201 });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function DELETE(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const [deliveryRows] = await connection.query('SELECT * FROM deliveries WHERE id = ?', [id]);
    if (deliveryRows.length === 0) {
      throw new Error('Livraison introuvable');
    }
    const delivery = deliveryRows[0];
    const orderId = delivery.order_id;
    const items = typeof delivery.items === 'string' ? JSON.parse(delivery.items) : delivery.items;

    const [orderItems] = await connection.query('SELECT * FROM contract_order_items WHERE orderId = ?', [orderId]);
    const deliveryArticles = items.filter(it => !it.isMetadata);

    for (const delItem of deliveryArticles) {
      const delQty = parseInt(delItem.quantity) || 0;
      if (delQty <= 0) continue;

      const match = orderItems.find(oi => 
        (oi.code && delItem.code === oi.code) ||
        (oi.refCfao && delItem.refCfao === oi.refCfao) ||
        (delItem.description === oi.description)
      );

      if (match) {
        await connection.query(
          'UPDATE contract_order_items SET delivered_quantity = GREATEST(0, delivered_quantity - ?) WHERE id = ?',
          [delQty, match.id]
        );
      }
    }

    await connection.query('DELETE FROM deliveries WHERE id = ?', [id]);

    const [updatedOrderItems] = await connection.query('SELECT quantity, delivered_quantity FROM contract_order_items WHERE orderId = ?', [orderId]);
    let allDelivered = true;
    let anyDelivered = false;

    for (const oi of updatedOrderItems) {
      const ordered = oi.quantity || 0;
      const delivered = oi.delivered_quantity || 0;

      if (delivered < ordered) {
        allDelivered = false;
      }
      if (delivered > 0) {
        anyDelivered = true;
      }
    }

    let newStatus = 'VALIDÉ';
    if (allDelivered && updatedOrderItems.length > 0) {
      newStatus = 'LIVRÉ';
    } else if (anyDelivered) {
      newStatus = 'PARTIELLEMENT_LIVRÉ';
    }

    const [currentOrder] = await connection.query('SELECT status FROM contract_orders WHERE id = ?', [orderId]);
    const oldStatus = currentOrder[0]?.status || 'BROUILLON';

    if (oldStatus !== newStatus && oldStatus !== 'CLÔTURÉ' && oldStatus !== 'ANNULÉ') {
      await connection.query(
        'UPDATE contract_orders SET status = ? WHERE id = ?',
        [newStatus, orderId]
      );
      await connection.query(
        'INSERT INTO contract_order_history (orderId, oldStatus, newStatus, userId) VALUES (?, ?, ?, ?)',
        [orderId, oldStatus, newStatus, auth.user.id]
      );
    }

    await connection.commit();
    await logAction(auth.user.id, auth.user.storeId, 'Suppression BL', { deliveryId: id, orderId });
    return NextResponse.json({ success: true, newStatus });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}

export async function PATCH(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const { attachment } = await request.json();

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  try {
    await db.query('UPDATE deliveries SET attachment = ? WHERE id = ?', [attachment, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { id, blNumber } = await request.json();
    if (!id || !blNumber) return NextResponse.json({ error: 'ID et blNumber requis' }, { status: 400 });

    await db.query('UPDATE deliveries SET bl_number = ? WHERE id = ?', [blNumber, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
