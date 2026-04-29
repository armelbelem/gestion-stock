import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { authenticateToken } from '../../../../lib/auth';
import { logAction } from '../../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: saleId } = await params;
  const { amount, notes } = await request.json();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (sales.length === 0) throw new Error('Vente introuvable');
    const sale = sales[0];
    await connection.query('INSERT INTO payments (id, saleId, amount, date, notes, storeId) VALUES (?, ?, ?, ?, ?, ?)', 
      [uuidv4(), saleId, amount, new Date().toISOString(), notes || null, sale.storeId]);
    const newAmountPaid = sale.amountPaid + parseFloat(amount);
    const status = newAmountPaid >= sale.totalAmount ? 'payé' : 'partiel';
    await connection.query('UPDATE sales SET amountPaid = ?, status = ? WHERE id = ?', [newAmountPaid, status, saleId]);
    await logAction(auth.user.id, sale.storeId, 'Paiement ajouté', { saleId, amount });
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { connection.release(); }
}
