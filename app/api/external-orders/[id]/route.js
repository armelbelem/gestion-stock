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
      const saleId = uuidv4();
      
      let totalAmount = 0;
      for (const item of items) {
        totalAmount += item.quantity * item.sellPrice;
      }
      
      const amount = amountPaid || 0;
      const status = amount >= totalAmount ? 'payé' : (amount > 0 ? 'partiel' : 'en_attente');

      const [fyRows] = await connection.query("SELECT * FROM fiscal_years WHERE status = 'active'");
      const activeYear = fyRows[0];

      await connection.query(
        'INSERT INTO sales (id, clientId, userId, totalAmount, discount, amountPaid, paymentType, status, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [saleId, order.clientId, auth.user.id, totalAmount, 0, amount, paymentType || 'complet', status, new Date().toISOString(), order.storeId, activeYear?.id || null]
      );
      
      for (const item of items) {
        await connection.query('INSERT INTO sale_items (id, saleId, articleId, description, quantity, unitPrice) VALUES (?, ?, ?, ?, ?, ?)', 
          [uuidv4(), saleId, null, item.description, item.quantity, item.sellPrice]);
      }
        
      if (amount > 0) {
        await connection.query('INSERT INTO payments (id, saleId, amount, date, storeId) VALUES (?, ?, ?, ?, ?)', 
          [uuidv4(), saleId, amount, new Date().toISOString(), order.storeId]);
      }

      await connection.query("UPDATE external_orders SET status = 'termine', saleId = ? WHERE id = ?", [saleId, id]);
      await logAction(auth.user.id, order.storeId, 'Vente commande externe', { orderId: id, saleId });
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
