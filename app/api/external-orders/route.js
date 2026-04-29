import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { getStoreConstraint, logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  try {
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    let query = `
      SELECT e.id, e.clientId, e.supplierId, e.status, e.saleId, e.date, e.storeId, c.name as clientName, f.name as supplierName
      FROM external_orders e
      LEFT JOIN clients c ON e.clientId = c.id
      LEFT JOIN fournisseurs f ON e.supplierId = f.id
    `;
    let params = [];
    if (storeId) { query += ' WHERE e.storeId = ?'; params.push(storeId); }
    query += ' ORDER BY e.date DESC';
    const [orders] = await db.query(query, params);
    
    // Fetch items for each order
    for (let order of orders) {
      const [items] = await db.query('SELECT * FROM external_order_items WHERE externalOrderId = ?', [order.id]);
      order.items = items;
    }
    
    return NextResponse.json(orders);
  } catch (err) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const { clientId, supplierId, items, storeId: bodyStoreId } = await request.json();
    const orderId = uuidv4();
    const storeId = auth.user.role === 'admin' ? (bodyStoreId || auth.user.storeId) : auth.user.storeId;
    
    await connection.query(
      'INSERT INTO external_orders (id, clientId, supplierId, date, storeId) VALUES (?, ?, ?, ?, ?)',
      [orderId, clientId, supplierId, new Date().toISOString(), storeId]
    );
    
    for (const item of items) {
      await connection.query(
        'INSERT INTO external_order_items (id, externalOrderId, description, quantity, purchasePrice, sellPrice) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), orderId, item.description, item.quantity, item.purchasePrice, item.sellPrice]
      );
    }
    
    await logAction(auth.user.id, storeId, 'Création commande externe multiple', { orderId });
    await connection.commit();
    return NextResponse.json({ id: orderId, success: true }, { status: 201 });
  } catch (err) { 
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  } finally {
    connection.release();
  }
}
