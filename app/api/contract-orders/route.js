import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken, isAdmin, hasPermission } from '../../lib/auth';
import { getStoreConstraint, logAction } from '../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

// GET: Lister les dossiers du magasin virtuel
export async function GET(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const partnerId = searchParams.get('partnerId');
  const requestedStoreId = searchParams.get('storeId');
  
  const page = parseInt(searchParams.get('page')) || 1;
  const limit = parseInt(searchParams.get('limit')) || 50;
  const offset = (page - 1) * limit;
  
  const storeId = getStoreConstraint(auth.user, requestedStoreId);

  try {
    let baseQuery = `
      FROM contract_orders co
      LEFT JOIN clients c ON co.clientId = c.id
      LEFT JOIN contract_partners p ON co.partner_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (storeId) {
      baseQuery += ` AND co.storeId = ? `;
      params.push(storeId);
    }

    if (startDate && endDate) {
      baseQuery += ` AND co.createdAt BETWEEN ? AND ? `;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    if (partnerId) {
      baseQuery += ` AND co.partner_id = ? `;
      params.push(partnerId);
    }

    // 1. Get total count for pagination
    const [countRows] = await db.query(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const totalItems = countRows[0].total;

    // 2. Get paginated data
    const dataQuery = `SELECT co.*, c.name as clientName, p.name as partnerName ${baseQuery} ORDER BY co.createdAt DESC LIMIT ? OFFSET ?`;
    const [rows] = await db.query(dataQuery, [...params, limit, offset]);

    // Filtrage de sécurité côté serveur
    const filteredRows = rows.map(row => {
      if (!hasPermission(auth.user, 'stock', 'view_cost_price')) {
        // On masque les données sensibles
        return {
          ...row,
          contractAmount: 0,
          margin: 0,
          items: (typeof row.items === 'string' ? JSON.parse(row.items || '[]') : (row.items || [])).map(item => ({
            ...item,
            purchasePrice: 0,
            totalHT: 0
          }))
        };
      }
      return row;
    });

    return NextResponse.json({
      data: filteredRows,
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

// POST: Créer un nouveau dossier (Demande au magasin virtuel)
export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { clientId, items, notes, partnerId, deliveryDate } = body;

  if (!partnerId) return NextResponse.json({ error: 'Partner ID requis' }, { status: 400 });

  // Tous les dossiers de contrats sont désormais "Virtuels" (ID 0) par défaut pour être indépendants des sites physiques
  const storeId = 0;

  const id = uuidv4();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 0. Get next order number per partner
    const [numRows] = await connection.query('SELECT MAX(orderNumber) as lastNum FROM contract_orders WHERE partner_id = ? AND storeId = ?', [partnerId, storeId]);
    const nextNum = (numRows[0]?.lastNum || 0) + 1;

    // 0b. Récupérer le taux de TVA actuel des paramètres
    const [settingsRows] = await connection.query('SELECT tvaRate FROM settings LIMIT 1');
    const currentTvaRate = Number(settingsRows[0]?.tvaRate || 18);

    // 1. Créer l'en-tête du dossier (avec capture du taux de TVA immuable)
    await connection.query(
      'INSERT INTO contract_orders (id, clientId, notes, status, attachment, orderNumber, partner_id, storeId, tva_rate, delivery_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, clientId, notes, 'demande', body.attachment || null, nextNum, partnerId, storeId, currentTvaRate, deliveryDate || null]
    );

    // 1b. Enregistrer l'historique initial
    await connection.query(
      'INSERT INTO contract_order_history (orderId, oldStatus, newStatus, userId) VALUES (?, ?, ?, ?)',
      [id, null, 'demande', auth.user.id]
    );

    // 2. Ajouter les articles
    let totalClient = 0;
    let totalContract = 0;

    for (const item of items) {
      const purchasePrice = parseFloat(item.purchasePrice) || 0;
      const sellPrice = parseFloat(item.sellPrice) || 0;
      const qty = parseInt(item.quantity) || 1;

      totalContract += (purchasePrice * qty);
      totalClient += (sellPrice * qty);

      await connection.query(
        'INSERT INTO contract_order_items (orderId, articleId, refSite, code, refCfao, description, quantity, purchasePrice, sellPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, item.articleId || null, item.refSite || null, item.code || null, item.refCfao || null, item.description, qty, purchasePrice, sellPrice]
      );
    }

    // 3. Mettre à jour les totaux et la marge
    const margin = totalClient - totalContract;
    await connection.query(
      'UPDATE contract_orders SET totalAmount = ?, contractAmount = ?, margin = ? WHERE id = ?',
      [totalClient, totalContract, margin, id]
    );

    await connection.commit();
    
    await logAction(auth.user.id, storeId, 'Création dossier contrat', { orderId: id, partnerId, orderNumber: nextNum });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}
