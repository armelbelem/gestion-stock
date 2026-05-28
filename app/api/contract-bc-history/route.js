import db from '../../lib/db';
import { authenticateToken, hasPermission, isManager } from '../../lib/auth';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seuls ceux autorisés à voir les prix peuvent voir l'historique détaillé des BC
  if (!hasPermission(auth.user, 'stock', 'view_cost_price')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get('orderId');
  const partnerId = searchParams.get('partnerId');

  try {
    let query = 'SELECT * FROM contract_bc_history WHERE 1=1';
    const params = [];

    if (orderId) {
      query += ' AND order_id = ?';
      params.push(orderId);
    }

    if (partnerId) {
      query += ' AND partner_id = ?';
      params.push(partnerId);
    }

    query += ' ORDER BY created_at DESC';
    const [rows] = await db.query(query, params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { orderId, bcNumber, title, requestRef, items, partnerId } = await request.json();

  if (!partnerId) return NextResponse.json({ error: 'Partner ID requis' }, { status: 400 });

  try {
    const [existing] = await db.query('SELECT id FROM contract_bc_history WHERE order_id = ? LIMIT 1', [orderId]);
    
    if (existing && existing.length > 0) {
      await db.query(
        'UPDATE contract_bc_history SET bc_number = ?, title = ?, request_ref = ?, items = ?, partner_id = ? WHERE order_id = ?',
        [bcNumber, title, requestRef, JSON.stringify(items), partnerId, orderId]
      );
      return NextResponse.json({ success: true, id: existing[0].id }, { status: 200 });
    } else {
      const id = uuidv4();
      await db.query(
        'INSERT INTO contract_bc_history (id, order_id, bc_number, title, request_ref, items, partner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, orderId, bcNumber, title, requestRef, JSON.stringify(items), partnerId]
      );
      return NextResponse.json({ success: true, id }, { status: 201 });
    }
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!isManager(auth.user)) {
    return NextResponse.json({ error: 'Action réservée aux gestionnaires' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  try {
    await db.query('DELETE FROM contract_bc_history WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!isManager(auth.user)) {
    return NextResponse.json({ error: 'Action réservée aux gestionnaires' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const { attachment } = await request.json();

  if (!id) return NextResponse.json({ error: 'ID requis' }, { status: 400 });

  try {
    await db.query('UPDATE contract_bc_history SET attachment = ? WHERE id = ?', [attachment, id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
