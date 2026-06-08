import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = params.id || (await params).id; 
  const body = await request.json();
  const { action, amountPaid, paymentType, metadata } = body;

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT * FROM external_orders WHERE id = ?', [id]);
    const order = orders[0];
    if (!order) throw new Error('Commande introuvable');
    
    if (action !== 'update_metadata' && order.status !== 'en_attente' && order.status !== 'partiel') {
      throw new Error('Commande déjà traitée');
    }

    const [items] = await connection.query('SELECT * FROM external_order_items WHERE externalOrderId = ?', [id]);

    if (action === 'vendre') {
      const amount = amountPaid || 0;
      await connection.query(
        "UPDATE external_orders SET status = 'termine', amountPaid = ?, paymentType = ? WHERE id = ?", 
        [amount, paymentType || 'complet', id]
      );
      await logAction(auth.user.id, order.storeId, 'Validation commande externe', { orderId: id });
    } else if (action === 'annuler') {
      await connection.query("UPDATE external_orders SET status = 'annule' WHERE id = ?", [id]);
      await logAction(auth.user.id, order.storeId, 'Annulation commande externe', { orderId: id });
    } else if (action === 'update_metadata') {
      await connection.query(
        "UPDATE external_orders SET metadata = ? WHERE id = ?",
        [metadata ? JSON.stringify(metadata) : null, id]
      );
      await logAction(auth.user.id, order.storeId, 'Mise à jour métadonnées commande externe', { orderId: id });
    } else if (action === 'edit') {
      const { clientId, supplierId, items: newItems, metadata: newMeta, deliveryDate } = body;
      
      // Update order details
      await connection.query(
        "UPDATE external_orders SET clientId = ?, supplierId = ?, delivery_date = ?, metadata = ? WHERE id = ?",
        [clientId, supplierId, deliveryDate || null, newMeta ? JSON.stringify(newMeta) : null, id]
      );
      
      // Identify items to delete
      const newItemIds = newItems.map(ni => ni.id).filter(Boolean);
      const itemsToDelete = items.filter(ei => !newItemIds.includes(ei.id));
      
      // Check if any deleted item has deliveries
      for (const item of itemsToDelete) {
        if ((item.quantity_delivered || 0) > 0) {
          throw new Error(`Impossible de supprimer l'article "${item.description}" car il a déjà fait l'objet de livraisons.`);
        }
        await connection.query('DELETE FROM external_order_items WHERE id = ?', [item.id]);
      }
      
      // Update or Insert items
      for (const item of newItems) {
        const qty = parseInt(item.quantity) || 0;
        const price = parseFloat(item.purchasePrice) || 0;
        const sPrice = item.sellPrice !== undefined && item.sellPrice !== null ? parseFloat(item.sellPrice) : price;
        
        if (item.id && items.some(ei => ei.id === item.id)) {
          const match = items.find(ei => ei.id === item.id);
          const delivered = match.quantity_delivered || 0;
          if (qty < delivered) {
            throw new Error(`La quantité commandée pour "${item.description}" ne peut pas être inférieure à la quantité déjà livrée (${delivered}).`);
          }
          await connection.query(
            'UPDATE external_order_items SET description = ?, quantity = ?, purchasePrice = ?, sellPrice = ?, code = ?, ref = ? WHERE id = ?',
            [item.description, qty, price, sPrice, item.code || null, item.ref || null, item.id]
          );
        } else {
          // New item
          await connection.query(
            'INSERT INTO external_order_items (id, externalOrderId, description, quantity, purchasePrice, sellPrice, code, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), id, item.description, qty, price, sPrice, item.code || null, item.ref || null]
          );
        }
      }
      
      // Recalculate order status
      const [updatedItems] = await connection.query(
        'SELECT quantity, quantity_delivered FROM external_order_items WHERE externalOrderId = ?',
        [id]
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
      let newStatus = 'en_attente';
      if (allDelivered && updatedItems.length > 0) {
        newStatus = 'termine';
      } else if (anyDelivered) {
        newStatus = 'partiel';
      }
      
      await connection.query('UPDATE external_orders SET status = ? WHERE id = ?', [newStatus, id]);
      await logAction(auth.user.id, order.storeId, 'Modification commande externe', { orderId: id });
    }

    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { connection.release(); }
}

export async function PATCH(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = params.id || (await params).id;
  const { attachment } = await request.json();

  try {
    const [rows] = await db.query('SELECT metadata FROM external_orders WHERE id = ?', [id]);
    if (rows.length === 0) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 });
    
    let metadata = {};
    if (rows[0].metadata) {
      metadata = typeof rows[0].metadata === 'string' ? JSON.parse(rows[0].metadata) : rows[0].metadata;
    }
    metadata.attachment = attachment;

    await db.query('UPDATE external_orders SET metadata = ? WHERE id = ?', [JSON.stringify(metadata), id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = params.id || (await params).id;
  try {
    await db.query('DELETE FROM external_order_items WHERE externalOrderId = ?', [id]);
    await db.query('DELETE FROM external_orders WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
