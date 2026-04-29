import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { getStoreConstraint, logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    let query = `
      SELECT s.*, c.name as clientName, c.phone as clientPhone, u.username as sellerName 
      FROM sales s
      LEFT JOIN clients c ON s.clientId = c.id
      LEFT JOIN users u ON s.userId = u.id
    `;
    let params = [];
    if (storeId) { query += ' WHERE s.storeId = ?'; params.push(storeId); }
    query += ' ORDER BY s.date DESC';
    const [sales] = await db.query(query, params);
    for (let sale of sales) {
      const [items] = await db.query(
        'SELECT si.*, COALESCE(a.name, si.description) as articleName FROM sale_items si LEFT JOIN articles a ON si.articleId = a.id WHERE si.saleId = ?',
        [sale.id]
      );
      sale.items = items;
    }
    return NextResponse.json(sales);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const body = await request.json();
    const { clientId, items, discount, amountPaid, paymentType, dueDate, notes, storeId: bodyStoreId } = body;
    const saleId = uuidv4();
    const storeId = auth.user.role === 'admin' ? (bodyStoreId || auth.user.storeId) : auth.user.storeId;
    if (!storeId) throw new Error('Aucun magasin sélectionné pour cette vente.');
    
    const [fyRows] = await connection.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];

    let totalAmount = 0;
    for (const item of items) {
      const quantity = parseInt(item.quantity);
      const unitPrice = parseFloat(item.unitPrice);
      totalAmount += quantity * unitPrice;
      const [inv] = await connection.query('SELECT quantity FROM inventory WHERE articleId = ? AND storeId = ?', [item.articleId, storeId]);
      if (inv.length === 0 || inv[0].quantity < quantity) throw new Error(`Stock insuffisant pour l'article ID ${item.articleId}`);
      await connection.query('UPDATE inventory SET quantity = quantity - ? WHERE articleId = ? AND storeId = ?', [quantity, item.articleId, storeId]);
      await connection.query('INSERT INTO mouvements (id, articleId, type, quantity, date, storeId) VALUES (?, ?, ?, ?, ?, ?)', 
        [uuidv4(), item.articleId, 'OUT', quantity, new Date().toISOString(), storeId]);
      await connection.query('INSERT INTO sale_items (id, saleId, articleId, quantity, unitPrice) VALUES (?, ?, ?, ?, ?)', 
        [uuidv4(), saleId, item.articleId, quantity, unitPrice]);
    }
    
    const status = amountPaid >= (totalAmount - discount) ? 'payé' : (amountPaid > 0 ? 'partiel' : 'en_attente');
    await connection.query(
      'INSERT INTO sales (id, clientId, userId, totalAmount, discount, amountPaid, paymentType, status, dueDate, notes, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [saleId, clientId, auth.user.id, totalAmount - (discount || 0), discount || 0, amountPaid || 0, paymentType || 'complet', status, dueDate || null, notes || null, new Date().toISOString(), storeId, activeYear?.id || null]
    );
    if (amountPaid > 0) {
      await connection.query('INSERT INTO payments (id, saleId, amount, date, storeId) VALUES (?, ?, ?, ?, ?)', 
        [uuidv4(), saleId, amountPaid, new Date().toISOString(), storeId]);
    }
    await logAction(auth.user.id, storeId, 'Nouvelle vente', { saleId, totalAmount });
    await connection.commit();
    return NextResponse.json({ id: saleId, success: true }, { status: 201 });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { connection.release(); }
}
