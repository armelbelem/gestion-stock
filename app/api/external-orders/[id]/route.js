import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = params.id || (await params).id; 
  const { action, amountPaid, paymentType, metadata } = await request.json();

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
