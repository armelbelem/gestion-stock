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
  try {
    const [existing] = await db.query('SELECT id FROM deliveries WHERE order_id = ? LIMIT 1', [orderId]);
    
    if (existing && existing.length > 0) {
      await db.query(
        'UPDATE deliveries SET bl_number = ?, items = ? WHERE order_id = ?',
        [blNumber, JSON.stringify(items), orderId]
      );
      return NextResponse.json({ success: true, id: existing[0].id }, { status: 200 });
    } else {
      const id = uuidv4();
      await db.query(
        'INSERT INTO deliveries (id, order_id, bl_number, items) VALUES (?, ?, ?, ?)',
        [id, orderId, blNumber, JSON.stringify(items)]
      );
      await logAction(auth.user.id, auth.user.storeId, 'Impression BL', { orderId, blNumber });
      return NextResponse.json({ success: true, id }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  try {
    await db.query('DELETE FROM deliveries WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
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
