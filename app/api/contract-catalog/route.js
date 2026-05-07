import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { logAction } from '../../lib/actions';
import { NextResponse } from 'next/server';

// GET: Lister les articles du catalogue de contrat
export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');
    const partnerId = searchParams.get('partnerId');
    
    let query = 'SELECT * FROM contract_catalog WHERE 1=1';
    const params = [];
    
    if (clientId) {
      query += ' AND (clientId = ? OR clientId IS NULL)';
      params.push(clientId);
    }

    if (partnerId) {
      query += ' AND partner_id = ?';
      params.push(partnerId);
    }
    
    query += ' ORDER BY name ASC';
    const [rows] = await db.query(query, params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Ajouter un article au catalogue de contrat
export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { code, refCfao, name, category, purchasePrice, suggestedSellPrice, clientId, partnerId } = body;

  if (!partnerId) return NextResponse.json({ error: 'Partner ID requis' }, { status: 400 });

  try {
    const [result] = await db.query(
      'INSERT INTO contract_catalog (code, refCfao, name, category, purchasePrice, suggestedSellPrice, clientId, partner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [code, refCfao || null, name, category, purchasePrice, suggestedSellPrice, clientId || null, partnerId]
    );
    
    await logAction(auth.user.id, auth.user.storeId, 'Ajout article catalogue contrat', { name, code });

    return NextResponse.json({ success: true, id: result.insertId });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
