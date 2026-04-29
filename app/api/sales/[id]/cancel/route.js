import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { authenticateToken } from '../../../../lib/auth';
import { logAction } from '../../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id: saleId } = await params;
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [sales] = await connection.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    if (sales.length === 0 || sales[0].status === 'annulée') throw new Error('Vente invalide ou déjà annulée');
    const sale = sales[0];
    const [items] = await connection.query('SELECT * FROM sale_items WHERE saleId = ?', [saleId]);
    for (const item of items) {
      await connection.query('UPDATE inventory SET quantity = quantity + ? WHERE articleId = ? AND storeId = ?', [item.quantity, item.articleId, sale.storeId]);
      await connection.query('INSERT INTO mouvements (id, articleId, type, quantity, date, storeId, notes) VALUES (?, ?, ?, ?, ?, ?, ?)', 
        [uuidv4(), item.articleId, 'IN', item.quantity, new Date().toISOString(), sale.storeId, `Annulation Vente #${saleId.substring(0,8)}`]);
    }
    await connection.query('UPDATE sales SET status = "annulée" WHERE id = ?', [saleId]);
    await logAction(auth.user.id, sale.storeId, 'Annulation vente', { saleId });
    await connection.commit();
    return NextResponse.json({ success: true });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { connection.release(); }
}
