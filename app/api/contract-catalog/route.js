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
    const search = searchParams.get('search') || '';
    // Si 'page' n'est pas fourni : mode rétrocompatibilité (tableau simple pour modals)
    const isPaginated = searchParams.has('page');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = (page - 1) * limit;

    let conditions = ['1=1'];
    const params = [];

    if (clientId) {
      conditions.push('(clientId = ? OR clientId IS NULL)');
      params.push(clientId);
    }

    if (partnerId) {
      conditions.push('partner_id = ?');
      params.push(partnerId);
    }

    if (search) {
      const cleanSearch = search.replace(/-/g, '');
      conditions.push('(name LIKE ? OR REPLACE(refCfao, \'-\', \'\') LIKE ? OR REPLACE(code, \'-\', \'\') LIKE ?)');
      const pat = `%${search}%`;
      const cleanPat = `%${cleanSearch}%`;
      params.push(pat, cleanPat, cleanPat);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    let total = 0;
    let totalPages = 1;
    if (isPaginated) {
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM contract_catalog ${whereClause}`,
        params
      );
      total = countResult[0].total;
      totalPages = Math.ceil(total / limit);
    }

    const queryParams = [...params];
    if (isPaginated) queryParams.push(limit, offset);

    const [rows] = await db.query(
      `SELECT * FROM contract_catalog ${whereClause} ORDER BY name ASC ${isPaginated ? 'LIMIT ? OFFSET ?' : ''}`,
      queryParams
    );

    if (isPaginated) {
      return NextResponse.json({ data: rows, pagination: { total, totalPages, page, limit } });
    }
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
