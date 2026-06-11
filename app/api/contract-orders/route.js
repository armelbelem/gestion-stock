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

    const clientId = searchParams.get('clientId');
    const search = searchParams.get('search') || '';

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
      
      if (clientId) {
        baseQuery += ` AND co.clientId = ? `;
        params.push(clientId);
      }

      if (search) {
        const cleanSearch = search.replace(/^#/, ''); // Remove leading #
        baseQuery += ` AND (
          LPAD(co.orderNumber, 3, '0') LIKE ? 
          OR c.name LIKE ? 
          OR co.id IN (
            SELECT orderId FROM contract_order_items 
            WHERE code LIKE ? 
               OR refCfao LIKE ? 
               OR articleId IN (SELECT id FROM articles WHERE barcode LIKE ?)
          )
        ) `;
        const searchPat = `%${cleanSearch}%`;
        params.push(searchPat, searchPat, searchPat, searchPat, searchPat);
      }

      // 1. Get global stats for pagination and dashboard
      const statsQuery = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN co.status NOT IN ('CLÔTURÉ', 'ANNULÉ') THEN (co.contractAmount * (1 + IFNULL(co.tva_rate, 0) / 100)) ELSE 0 END) as achatsEnCours,
          SUM(CASE WHEN co.status = 'CLÔTURÉ' THEN (co.contractAmount * (1 + IFNULL(co.tva_rate, 0) / 100)) ELSE 0 END) as achatsClotures,
          SUM(CASE WHEN co.status = 'BROUILLON' THEN 1 ELSE 0 END) as enDemande,
          SUM(CASE WHEN co.status NOT IN ('CLÔTURÉ', 'ANNULÉ') AND co.delivery_date IS NOT NULL AND co.delivery_date <= CURDATE() THEN 1 ELSE 0 END) as retardLivraison
        ${baseQuery}
      `;
      const [statsRows] = await db.query(statsQuery, params);
      const totalItems = statsRows[0].total || 0;
      const globalStats = {
        achatsEnCours: statsRows[0].achatsEnCours || 0,
        achatsClotures: statsRows[0].achatsClotures || 0,
        enDemande: statsRows[0].enDemande || 0,
        retardLivraison: statsRows[0].retardLivraison || 0
      };

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

    await connection.query(
      'INSERT INTO contract_orders (id, clientId, notes, status, attachment, orderNumber, partner_id, storeId, tva_rate, delivery_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, clientId, notes, 'BROUILLON', body.attachment || null, nextNum, partnerId, storeId, currentTvaRate, deliveryDate || new Date().toISOString().split('T')[0]]
    );

    // 1b. Enregistrer l'historique initial
    await connection.query(
      'INSERT INTO contract_order_history (orderId, oldStatus, newStatus, userId) VALUES (?, ?, ?, ?)',
      [id, null, 'BROUILLON', auth.user.id]
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
    
    await logAction(auth.user.id, auth.user.storeId, 'Création dossier contrat', { orderId: id, partnerId, orderNumber: nextNum });

    return NextResponse.json({ success: true, id });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    connection.release();
  }
}
