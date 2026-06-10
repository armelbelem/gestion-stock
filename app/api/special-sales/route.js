import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken, hasPermission } from '../../lib/auth';
import { getStoreConstraint, logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

// GET: Lister les ventes spéciales
export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const requestedStoreId = searchParams.get('storeId');
  const search = searchParams.get('search') || '';

  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 50;
  const offset = (page - 1) * limit;

  const storeId = getStoreConstraint(auth.user, requestedStoreId);

  try {
    let baseQuery = `
      FROM special_sales ss
      WHERE 1=1
    `;
    const params = [];

    if (storeId) {
      baseQuery += ` AND ss.storeId = ? `;
      params.push(storeId);
    }

    if (startDate && endDate) {
      baseQuery += ` AND ss.date BETWEEN ? AND ? `;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    if (search) {
      baseQuery += ` AND (
        ss.clientName LIKE ? 
        OR ss.id IN (
          SELECT specialSaleId FROM special_sale_items 
          WHERE ref LIKE ? OR description LIKE ?
        )
      ) `;
      const searchPat = `%${search}%`;
      params.push(searchPat, searchPat, searchPat);
    }

    // 1. Get stats for pagination & totals
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ss.status = 'termine' THEN ss.totalTTC ELSE 0 END) as totalSalesTTC,
        SUM(CASE WHEN ss.status = 'termine' THEN ss.margin ELSE 0 END) as totalMargin
      ${baseQuery}
    `;
    const [statsRows] = await db.query(statsQuery, params);
    const totalItems = statsRows[0].total || 0;
    const globalStats = {
      totalSalesTTC: statsRows[0].totalSalesTTC || 0,
      totalMargin: statsRows[0].totalMargin || 0
    };

    // 2. Get paginated data
    const dataQuery = `SELECT ss.* ${baseQuery} ORDER BY ss.date DESC, ss.createdAt DESC LIMIT ? OFFSET ?`;
    const [rows] = await db.query(dataQuery, [...params, limit, offset]);

    // Fetch items for each sale
    const salesWithItems = [];
    for (const sale of rows) {
      const [items] = await db.query('SELECT * FROM special_sale_items WHERE specialSaleId = ?', [sale.id]);
      salesWithItems.push({
        ...sale,
        items
      });
    }

    return NextResponse.json({
      data: salesWithItems,
      globalStats,
      pagination: {
        total: totalItems,
        page,
        limit,
        totalPages: Math.ceil(totalItems / limit)
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Enregistrer une nouvelle vente spéciale
export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  // Seuls les admins et gestionnaires peuvent enregistrer
  if (auth.user.role === 'vendeur' || auth.user.role === 'observateur') {
    return NextResponse.json({ error: 'Accès interdit pour ce rôle' }, { status: 403 });
  }

  const body = await request.json();
  const { clientName, items, notes, date, storeId: bodyStoreId } = body;

  if (!clientName) return NextResponse.json({ error: 'Le nom du client est requis' }, { status: 400 });
  if (!items || items.length === 0) return NextResponse.json({ error: 'Au moins un produit est requis' }, { status: 400 });

  // Affectation du magasin : si l'admin spécifie, sinon celui de l'utilisateur ou null (global)
  const storeId = auth.user.storeId !== null && auth.user.storeId !== undefined ? auth.user.storeId : (bodyStoreId || null);

  const id = uuidv4();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Calculer les montants
    let totalHT = 0;
    let totalMargin = 0;

    // Récupérer le taux de TVA actuel des paramètres
    const [settingsRows] = await connection.query('SELECT tvaRate FROM settings LIMIT 1');
    const tvaRate = Number(settingsRows[0]?.tvaRate || 18);

    // 2. Insérer les articles et sommer les totaux
    for (const item of items) {
      const purchasePrice = parseFloat(item.purchasePrice) || 0;
      const sellingPrice = parseFloat(item.sellingPrice) || 0;
      const qty = parseInt(item.quantity) || 1;

      totalHT += (sellingPrice * qty);
      totalMargin += ((sellingPrice - purchasePrice) * qty);

      const itemId = uuidv4();
      await connection.query(
        'INSERT INTO special_sale_items (id, specialSaleId, ref, description, quantity, purchasePrice, sellingPrice) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [itemId, id, item.ref || null, item.description, qty, purchasePrice, sellingPrice]
      );
    }

    const tva = totalHT * (tvaRate / 100);
    const totalTTC = totalHT + tva;

    // 3. Insérer la vente principale
    const saleDate = date ? new Date(date) : new Date();
    await connection.query(
      'INSERT INTO special_sales (id, clientName, date, notes, storeId, totalHT, tva, totalTTC, margin, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, clientName, saleDate, notes || null, storeId, totalHT, tva, totalTTC, totalMargin, 'termine']
    );

    await connection.commit();

    await logAction(auth.user.id, auth.user.storeId, 'Création vente spéciale', { id, clientName, totalTTC });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}
