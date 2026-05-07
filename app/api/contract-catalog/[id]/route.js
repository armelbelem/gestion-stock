import db from '../../../lib/db';
import { authenticateToken } from '../../../lib/auth';
import { logAction } from '../../../lib/actions';
import { NextResponse } from 'next/server';

export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const { code, refCfao, name, category, purchasePrice, suggestedSellPrice, clientId } = body;

  try {
    await db.query(
      'UPDATE contract_catalog SET code = ?, refCfao = ?, name = ?, category = ?, purchasePrice = ?, suggestedSellPrice = ?, clientId = ? WHERE id = ?',
      [code, refCfao || null, name, category, purchasePrice, suggestedSellPrice, clientId || null, id]
    );

    await logAction(auth.user.id, auth.user.storeId, 'Modification article catalogue contrat', { id, name });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  try {
    await db.query('DELETE FROM contract_catalog WHERE id = ?', [id]);
    await logAction(auth.user.id, auth.user.storeId, 'Suppression article catalogue contrat', { id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
