import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const partnerId = searchParams.get('partnerId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let query = 'SELECT * FROM contract_special_docs WHERE 1=1';
    const params = [];

    if (partnerId) {
      query += ' AND partner_id = ?';
      params.push(partnerId);
    }

    if (startDate && endDate) {
      query += ' AND createdAt BETWEEN ? AND ?';
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    query += ' ORDER BY createdAt DESC';
    const [rows] = await db.query(query, params);
    const parsed = rows.map(r => ({
      ...r,
      items: typeof r.items === 'string' ? JSON.parse(r.items || '[]') : (r.items || [])
    }));
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const body = await request.json();
    const { clientName, supplierName, title, items, partnerId } = body;

    if (!partnerId) return NextResponse.json({ error: 'Partner ID requis' }, { status: 400 });

    const id = uuidv4();
    const newDoc = {
      id,
      clientName,
      supplierName,
      title,
      items,
      partner_id: partnerId,
      createdAt: new Date().toISOString()
    };

    await db.query(
      'INSERT INTO contract_special_docs (id, clientName, supplierName, title, items, createdAt, partner_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, clientName, supplierName, title, JSON.stringify(items), newDoc.createdAt, partnerId]
    );

    await logAction(auth.user.id, auth.user.storeId, 'Création document libre', { id, clientName, title });

    return NextResponse.json(newDoc, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  }

  try {
    // 1. Supprimer également l'historique d'en-tête BC lié dans contract_bc_history
    await db.query('DELETE FROM contract_bc_history WHERE order_id = ?', [id]);

    // 2. Supprimer également les bons de livraison (BL) liés dans la table deliveries
    await db.query('DELETE FROM deliveries WHERE order_id = ?', [id]);

    // 3. Supprimer le document libre
    await db.query('DELETE FROM contract_special_docs WHERE id = ?', [id]);

    await logAction(auth.user.id, auth.user.storeId, 'Suppression document libre', { id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

