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
    const { searchParams } = request.nextUrl;
    const storeId = getStoreConstraint(auth.user, searchParams.get('storeId'));
    const search = searchParams.get('search') || '';
    // Si 'page' n'est pas fourni, mode rétrocompatibilité (retourne un tableau simple)
    const isPaginated = searchParams.has('page');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let whereConditions = [];
    let params = [];

    // Filtre par magasin
    if (storeId) {
      whereConditions.push('a.id IN (SELECT articleId FROM inventory WHERE storeId = ?)');
      params.push(storeId);
    }

    // Exclure les articles sans prix (ex: 0 FCFA) si demandé (utile pour la création de ventes)
    if (searchParams.get('excludeZeroPrice') === 'true') {
      whereConditions.push('a.price > 0');
    }

    // Filtre recherche (insensible aux tirets, espaces de début/fin ou du milieu)
    if (search) {
      const trimmedSearch = search.trim();
      const cleanSearch = trimmedSearch.replace(/[\s-]/g, '');
      whereConditions.push(
        `(a.name LIKE ? 
         OR REPLACE(REPLACE(a.code, '-', ''), ' ', '') LIKE ? 
         OR REPLACE(REPLACE(a.barcode, '-', ''), ' ', '') LIKE ?)`
      );
      const searchPattern = `%${trimmedSearch}%`;
      const cleanSearchPattern = `%${cleanSearch}%`;
      params.push(searchPattern, cleanSearchPattern, cleanSearchPattern);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Requête de comptage total (uniquement en mode paginé)
    let total = 0;
    let totalPages = 1;
    if (isPaginated) {
      const [countResult] = await db.query(
        `SELECT COUNT(*) as total FROM articles a ${whereClause}`,
        params
      );
      total = countResult[0].total;
      totalPages = Math.ceil(total / limit);
    }

    // Requête principale
    const queryParams = [];
    if (storeId) queryParams.push(storeId); // for the inventory subquery in SELECT
    queryParams.push(...params); // for the whereClause
    if (isPaginated) queryParams.push(limit, offset);

    const [articles] = await db.query(`
      SELECT a.id, a.code, a.name, a.price, a.minStock, a.barcode, a.storeId, a.createdAt,
             COALESCE((
                 SELECT SUM(quantity) 
                 FROM inventory i 
                 WHERE i.articleId = a.id
                 ${storeId ? 'AND i.storeId = ?' : ''}
             ), 0) as currentStock,
             COALESCE((
                 SELECT SUM(si.quantity) 
                 FROM sale_items si 
                 JOIN sales s3 ON si.saleId = s3.id 
                 WHERE si.articleId = a.id 
                 AND s3.date >= DATE_SUB(NOW(), INTERVAL 30 DAY) 
                 AND s3.status != 'annulée'
             ), 0) as soldLast30Days
      FROM articles a
      ${whereClause}
      ORDER BY a.name ASC
      ${isPaginated ? 'LIMIT ? OFFSET ?' : ''}
    `, queryParams);

    const cleanedArticles = articles.map(art => {
      const cleaned = { ...art };
      cleaned.isZeroPrice = (parseFloat(art.price) <= 0);
      if (auth.user.role === 'vendeur' || auth.user.role === 'vendeurs') {
        cleaned.price = '***';
      }
      return cleaned;
    });

    // Mode paginé : retourne { data, pagination }
    // Mode simple (rétrocompatibilité) : retourne un tableau directement
    if (isPaginated) {
      return NextResponse.json({
        data: cleanedArticles,
        pagination: { total, totalPages, page, limit }
      });
    }
    return NextResponse.json(cleanedArticles);
  } catch (err) { 
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  }
}


export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seul l'admin ou un gérant peut créer des articles
  if (auth.user.role !== 'admin' && auth.user.role !== 'gestionnaire') {
    return NextResponse.json({ error: 'Accès interdit : Administrateur ou Gérant requis pour créer des articles' }, { status: 403 });
  }

  const { code, name, price, currentStock, minStock, barcode, storeId: bodyStoreId } = await request.json();

  if (parseFloat(price) < 0 || parseInt(currentStock) < 0 || parseInt(minStock) < 0) {
    return NextResponse.json({ error: 'Le prix, le stock et le seuil d\'alerte ne peuvent pas être négatifs' }, { status: 400 });
  }

  let storeId = bodyStoreId || auth.user.storeId;

  if (!storeId && (auth.user.role === 'admin' || auth.user.role === 'gestionnaire')) {
    const [stores] = await db.query('SELECT id FROM stores LIMIT 1');
    if (stores.length > 0) storeId = stores[0].id;
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query('INSERT INTO articles (code, name, price, currentStock, minStock, barcode, storeId) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [code || null, name, price || 0, currentStock || 0, minStock || 0, barcode || null, storeId]);
    const artId = result.insertId;
    await connection.query('INSERT INTO inventory (id, storeId, articleId, quantity, minStock) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), storeId, artId, currentStock || 0, minStock || 0]);
    await logAction(auth.user.id, storeId, 'Création article', { name, initialStock: currentStock });
    await connection.commit();
    return NextResponse.json({ id: artId, name }, { status: 201 });
  } catch (err) { 
    await connection.rollback(); 
    return NextResponse.json({ error: err.message }, { status: 500 }); 
  } finally { connection.release(); }
}
