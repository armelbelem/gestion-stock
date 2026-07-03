import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken } from '../../lib/auth';
import { getStoreConstraint, logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    // Récupérer l'exercice actif
    const [fyRows] = await db.query("SELECT id FROM fiscal_years WHERE status = 'active'");
    const activeYearId = fyRows[0]?.id;
    const storeId = getStoreConstraint(auth.user, request.nextUrl.searchParams.get('storeId'));
    const search = request.nextUrl.searchParams.get('search') || '';
    const type = request.nextUrl.searchParams.get('type') || '';
    const articleId = request.nextUrl.searchParams.get('articleId') || '';
    const startDate = request.nextUrl.searchParams.get('startDate') || '';
    const endDate = request.nextUrl.searchParams.get('endDate') || '';

    const isPaginated = request.nextUrl.searchParams.has('page');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let conditions = [];
    let params = [];
    
    if (activeYearId) {
      conditions.push('m.fiscalYearId = ?');
      params.push(activeYearId);
    } else {
      conditions.push('1=0');
    }

    if (storeId) { 
      conditions.push('m.storeId = ?'); 
      params.push(storeId); 
    }

    if (type) {
      conditions.push('m.type = ?');
      params.push(type);
    }

    if (articleId) {
      conditions.push('m.articleId = ?');
      params.push(articleId);
    }

    if (startDate) {
      conditions.push('m.date >= ?');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      conditions.push('m.date <= ?');
      params.push(`${endDate} 23:59:59`);
    }

    if (search) {
      conditions.push('(a.name LIKE ? OR a.code LIKE ? OR m.notes LIKE ?)');
      const searchPat = `%${search}%`;
      params.push(searchPat, searchPat, searchPat);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    let totalPages = 1;
    if (isPaginated) {
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM mouvements m JOIN articles a ON m.articleId = a.id LEFT JOIN stores s ON m.storeId = s.id ${whereClause}`,
        params
      );
      total = countResult[0].total;
      totalPages = Math.ceil(total / limit);
    }

    const queryParams = [...params];
    if (isPaginated) queryParams.push(limit, offset);

    let query = `SELECT m.*, a.name as articleName, a.code as articleCode, a.barcode as articleBarcode, a.price as articlePrice, s.name as storeName FROM mouvements m JOIN articles a ON m.articleId = a.id LEFT JOIN stores s ON m.storeId = s.id ${whereClause} ORDER BY m.date DESC ${isPaginated ? 'LIMIT ? OFFSET ?' : ''}`;
    
    const [mouv] = await db.query(query, queryParams);

    if (isPaginated) {
      return NextResponse.json({ data: mouv, pagination: { total, totalPages, page, limit } });
    }
    return NextResponse.json(mouv);
  } catch (err) { 
    console.error('[MOUVEMENTS GET ERROR]', err);
    return NextResponse.json({ error: err.message, details: err.stack }, { status: 500 }); 
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (auth.user.role === 'vendeur' || auth.user.role === 'vendeurs') {
    return NextResponse.json({ error: 'Accès interdit : Mode lecture seule.' }, { status: 403 });
  }

  const { articleId, type, quantity, notes, supplierId, storeId: bodyStoreId } = await request.json();
  if (parseInt(quantity) <= 0) {
    return NextResponse.json({ error: "La quantité doit être supérieure à 0" }, { status: 400 });
  }
  const movId = uuidv4();
  
  const [fyRows] = await db.query("SELECT * FROM fiscal_years WHERE status = 'active'");
  const activeYear = fyRows[0];
  if (!activeYear) return NextResponse.json({ error: "Action impossible : Aucun exercice fiscal n'est ouvert. Veuillez ouvrir un exercice pour les mouvements de stock." }, { status: 400 });
  
  const storeId = (auth.user.role === 'admin' || auth.user.role === 'gestionnaire') ? (bodyStoreId || auth.user.storeId) : auth.user.storeId;
  if (!storeId) return NextResponse.json({ error: "Magasin non spécifié" }, { status: 400 });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      'INSERT INTO mouvements (id, articleId, type, quantity, date, notes, supplierId, fiscalYearId, storeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [movId, articleId, type, quantity, new Date().toISOString(), notes || null, supplierId || null, activeYear?.id || null, storeId]
    );
    
    const [inv] = await connection.query('SELECT * FROM inventory WHERE storeId = ? AND articleId = ? FOR UPDATE', [storeId, articleId]);
    if (inv.length === 0) {
      await connection.query('INSERT INTO inventory (id, storeId, articleId, quantity) VALUES (?, ?, ?, ?)', 
        [uuidv4(), storeId, articleId, type === 'IN' ? quantity : -quantity]);
    } else {
      const op = type === 'IN' ? '+' : '-';
      await connection.query(`UPDATE inventory SET quantity = quantity ${op} ? WHERE storeId = ? AND articleId = ?`, [quantity, storeId, articleId]);
    }

    await logAction(auth.user.id, storeId, `Mouvement Stock ${type}`, { articleId, quantity });
    await connection.commit();
    return NextResponse.json({ id: movId, success: true }, { status: 201 });
  } catch (err) { 
    await connection.rollback(); 
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  } finally { connection.release(); }
}
