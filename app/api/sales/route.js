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
    const startDate = request.nextUrl.searchParams.get('startDate') || '';
    const endDate = request.nextUrl.searchParams.get('endDate') || '';
    const isPaginated = request.nextUrl.searchParams.has('page');
    const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    let conditions = [];
    let params = [];
    
    // Si on a un exercice actif, on filtre. Sinon on ne montre rien (écran propre après clôture)
    if (activeYearId) {
      conditions.push('s.fiscalYearId = ?');
      params.push(activeYearId);
    } else {
      conditions.push('1=0');
    }

    if (storeId) { 
      conditions.push('s.storeId = ?'); 
      params.push(storeId); 
    } else {
      // Exclure le magasin virtuel par défaut pour ne pas mélanger avec le physique
      conditions.push("(s.storeId != 'CFAO' OR s.storeId IS NULL)");
    }

    if (startDate) {
      conditions.push('s.date >= ?');
      params.push(`${startDate} 00:00:00`);
    }

    if (endDate) {
      conditions.push('s.date <= ?');
      params.push(`${endDate} 23:59:59`);
    }

    if (search) {
      const cleanSearch = search.replace(/^#/, ''); // Remove leading #
      conditions.push('(s.id LIKE ? OR c.name LIKE ? OR s.notes LIKE ?)');
      const searchPat = `%${cleanSearch}%`;
      params.push(searchPat, searchPat, searchPat);
    }

    // Role admin/gestionnaire checking for proforma
    const isManager = auth.user.role === 'admin' || auth.user.role === 'gestionnaire';
    if (!isManager) {
      conditions.push("s.status != 'proforma'");
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let total = 0;
    let totalPages = 1;
    let totalAmountPeriod = 0;

    if (isPaginated) {
      // Pour le Dashboard ou Stats: récupérer le total CA sur cette période
      const [sumResult] = await db.query(
        `SELECT SUM(s.totalAmount) as totalAmount 
         FROM sales s 
         LEFT JOIN clients c ON s.clientId = c.id 
         ${whereClause} AND s.status != 'annulée'`,
        params
      );
      totalAmountPeriod = sumResult[0]?.totalAmount || 0;

      const [countResult] = await db.query(
        `SELECT COUNT(*) as total 
         FROM sales s 
         LEFT JOIN clients c ON s.clientId = c.id 
         ${whereClause}`,
        params
      );
      total = countResult[0].total;
      totalPages = Math.ceil(total / limit);
    }

    const queryParams = [...params];
    if (isPaginated) queryParams.push(limit, offset);

    let query = `
      SELECT s.*, c.name as clientName, c.phone as clientPhone, u.username as sellerName 
      FROM sales s
      LEFT JOIN clients c ON s.clientId = c.id
      LEFT JOIN users u ON s.userId = u.id
      ${whereClause} 
      ORDER BY s.date DESC 
      ${isPaginated ? 'LIMIT ? OFFSET ?' : ''}
    `;

    const [sales] = await db.query(query, queryParams);
    for (let sale of sales) {
      const [items] = await db.query(
        'SELECT si.*, COALESCE(a.name, si.description) as articleName, a.code as articleCode, a.barcode as articleBarcode FROM sale_items si LEFT JOIN articles a ON si.articleId = a.id WHERE si.saleId = ?',
        [sale.id]
      );
      sale.items = items;
    }

    if (isPaginated) {
      return NextResponse.json({
        data: sales,
        pagination: { total, totalPages, page, limit },
        summary: { totalAmountPeriod }
      });
    }
    return NextResponse.json(sales);
  } catch (err) { 
    console.error('[SALES GET ERROR]', err);
    return NextResponse.json({ error: err.message, details: err.stack }, { status: 500 }); 
  }
}

export async function POST(request) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const body = await request.json();
    const { clientId, items, discount, amountPaid, paymentType, dueDate, notes, storeId: bodyStoreId, isProforma, tvaAmount, totalAmount: bodyTotalAmount } = body;
    const saleId = uuidv4();
    const storeId = (auth.user.role === 'admin' || auth.user.role === 'gestionnaire') ? (bodyStoreId || auth.user.storeId) : auth.user.storeId;
    if (!storeId) throw new Error('Aucun magasin sélectionné pour cette vente.');
    
    const [fyRows] = await connection.query("SELECT * FROM fiscal_years WHERE status = 'active'");
    const activeYear = fyRows[0];
    if (!activeYear) throw new Error("Action impossible : Aucun exercice fiscal n'est ouvert. Veuillez ouvrir un exercice pour enregistrer des ventes.");

    let calculatedTotal = 0;
    const isSeller = auth.user.role === 'vendeur' || auth.user.role === 'vendeurs';

    const itemsToInsert = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity) || 0;
      let unitPrice = parseFloat(item.unitPrice);
      
      // Sécurité : Si c'est un vendeur ou si le prix est invalide (ex: '***'), on récupère le vrai prix en base
      if (isSeller || isNaN(unitPrice)) {
        if (item.articleId) {
          const [artRows] = await connection.query('SELECT price FROM articles WHERE id = ?', [item.articleId]);
          unitPrice = artRows.length > 0 ? artRows[0].price : 0;
        } else {
          unitPrice = isNaN(unitPrice) ? 0 : unitPrice;
        }
      }
      
      if (quantity <= 0 && !isProforma) {
        throw new Error(`La quantité pour l'article "${item.description || 'ID: ' + item.articleId}" doit être supérieure à 0.`);
      }
      
      calculatedTotal += quantity * unitPrice;
      
      if (item.articleId) {
        // Si c'est un proforma, on ne déstocke pas
        if (!isProforma) {
          const [inv] = await connection.query('SELECT quantity FROM inventory WHERE articleId = ? AND storeId = ?', [item.articleId, storeId]);
          if (inv.length === 0 || inv[0].quantity < quantity) throw new Error(`Stock insuffisant pour l'article ID ${item.articleId}`);
          await connection.query('UPDATE inventory SET quantity = quantity - ? WHERE articleId = ? AND storeId = ?', [quantity, item.articleId, storeId]);
          await connection.query('INSERT INTO mouvements (id, articleId, type, quantity, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [uuidv4(), item.articleId, 'OUT', quantity, new Date().toISOString(), storeId, activeYear?.id || null]);
        }
      } else {
        if (auth.user.role !== 'admin' && auth.user.role !== 'gestionnaire') throw new Error('Action refusée : Seul un administrateur ou gestionnaire peut saisir des articles hors catalogue.');
      }
      
      itemsToInsert.push({
        id: uuidv4(),
        saleId: saleId,
        articleId: item.articleId || null,
        quantity: quantity,
        unitPrice: unitPrice,
        description: item.description || null
      });
    }
    
    // On utilise le total calculé coté serveur ou celui envoyé par le body s'il contient déjà la TVA
    let safeDiscount = parseFloat(discount) || 0;
    let safeTvaAmount = parseFloat(tvaAmount);
    let safeAmountPaid = parseFloat(amountPaid) || 0;

    // Si c'est un vendeur, on recalcule tout car le front n'a pas les prix réels
    if (isSeller) {
      safeDiscount = 0; // Pas de remise autorisée pour les vendeurs par défaut
      const [settingsRows] = await connection.query('SELECT tvaRate FROM settings LIMIT 1');
      const tvaRate = settingsRows.length > 0 ? (settingsRows[0].tvaRate || 0) : 18;
      safeTvaAmount = Math.round(calculatedTotal * (tvaRate / 100));
    }

    if (isNaN(safeTvaAmount)) safeTvaAmount = 0;
    
    let finalTotal = parseFloat(bodyTotalAmount);
    if (isSeller || isNaN(finalTotal)) {
      finalTotal = calculatedTotal - safeDiscount + safeTvaAmount;
    }
    if (isNaN(finalTotal)) finalTotal = 0;

    const status = isProforma ? 'proforma' : (safeAmountPaid >= finalTotal ? 'payé' : (safeAmountPaid > 0 ? 'partiel' : 'en_attente'));
    
    // 1. Insérer la vente principale d'abord (Parent)
    await connection.query(
      'INSERT INTO sales (id, clientId, userId, totalAmount, discount, tvaAmount, amountPaid, paymentType, status, dueDate, notes, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [saleId, clientId, auth.user.id, finalTotal, safeDiscount, safeTvaAmount, safeAmountPaid, paymentType || 'complet', status, dueDate || null, notes || null, new Date().toISOString(), storeId, activeYear?.id || null]
    );

    // 2. Insérer les articles associés après (Enfants)
    for (const item of itemsToInsert) {
      await connection.query('INSERT INTO sale_items (id, saleId, articleId, quantity, unitPrice, description) VALUES (?, ?, ?, ?, ?, ?)', 
        [item.id, item.saleId, item.articleId, item.quantity, item.unitPrice, item.description]);
    }

    if (!isProforma && amountPaid > 0) {
      await connection.query('INSERT INTO payments (id, saleId, amount, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?)', 
        [uuidv4(), saleId, amountPaid, new Date().toISOString(), storeId, activeYear?.id || null]);
    }
    await logAction(auth.user.id, storeId, isProforma ? 'Nouveau proforma' : 'Nouvelle vente', { saleId, totalAmount: finalTotal });
    await connection.commit();
    return NextResponse.json({ id: saleId, success: true, status: status }, { status: 201 });
  } catch (err) {
    await connection.rollback();
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally { connection.release(); }
}
