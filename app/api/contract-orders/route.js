import { NextResponse } from 'next/server';
import db from '../../lib/db';
import { authenticateToken, isAdmin } from '../../lib/auth';
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
  
  const storeId = getStoreConstraint(auth.user, requestedStoreId);

  try {
    let query = `
      SELECT co.*, c.name as clientName, s.name as supplierName 
      FROM contract_orders co
      LEFT JOIN clients c ON co.clientId = c.id
      LEFT JOIN fournisseurs s ON co.supplierId = s.id
      WHERE 1=1
    `;
    const params = [];

    if (storeId) {
      query += ` AND co.storeId = ? `;
      params.push(storeId);
    }

    if (startDate && endDate) {
      query += ` AND co.createdAt BETWEEN ? AND ? `;
      params.push(`${startDate} 00:00:00`, `${endDate} 23:59:59`);
    }

    if (partnerId) {
      query += ` AND co.partner_id = ? `;
      params.push(partnerId);
    }

    query += ` ORDER BY co.createdAt DESC`;

    const [rows] = await db.query(query, params);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Créer un nouveau dossier (Demande au magasin virtuel)
export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json();
  const { clientId, supplierId, items, notes, partnerId } = body;

  if (!partnerId) return NextResponse.json({ error: 'Partner ID requis' }, { status: 400 });

  const storeId = auth.user.role === 'admin' && body.storeId ? body.storeId : auth.user.storeId;
  if (!storeId) return NextResponse.json({ error: 'Aucun magasin défini pour cet utilisateur' }, { status: 400 });

  const id = uuidv4();
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // 0. Get next order number per partner
    const [numRows] = await connection.query('SELECT MAX(orderNumber) as lastNum FROM contract_orders WHERE partner_id = ? AND storeId = ?', [partnerId, storeId]);
    const nextNum = (numRows[0]?.lastNum || 0) + 1;

    // 1. Créer l'en-tête du dossier
    await connection.query(
      'INSERT INTO contract_orders (id, clientId, supplierId, notes, status, attachment, orderNumber, partner_id, storeId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, clientId, supplierId, notes, 'demande', body.attachment || null, nextNum, partnerId, storeId]
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
