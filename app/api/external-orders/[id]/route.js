import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const id = params.id || (await params).id; 
  const { action, amountPaid, paymentType } = await request.json();

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.query('SELECT * FROM external_orders WHERE id = ?', [id]);
    const order = orders[0];
    if (!order) throw new Error('Commande introuvable');
    if (order.status !== 'en_attente') throw new Error('Commande déjà traitée');

    const [items] = await connection.query('SELECT * FROM external_order_items WHERE externalOrderId = ?', [id]);

    if (action === 'vendre') {
      const amount = amountPaid || 0;
      // On ne crée plus de record dans 'sales'. 
      // On met juste à jour la commande spéciale avec le montant encaissé et le statut.
      await connection.query(
        "UPDATE external_orders SET status = 'termine', amountPaid = ?, paymentType = ? WHERE id = ?", 
        [amount, paymentType || 'complet', id]
      );
      
      // Si un paiement a été fait, on peut toujours le tracer dans une table de paiements dédiée ou via un champ
      // Pour l'instant, on se base sur external_orders.amountPaid
      
      await logAction(auth.user.id, order.storeId, 'Validation commande externe', { orderId: id });
    } else if (action === 'annuler') {
      await connection.query("UPDATE external_orders SET status = 'annule' WHERE id = ?", [id]);
      await logAction(auth.user.id, order.storeId, 'Annulation commande externe', { orderId: id });
    }

    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { connection.release(); }
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
