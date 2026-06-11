import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { authenticateToken, isAdmin } from '../../../lib/auth';
import { getStoreConstraint, logAction } from '../../../lib/actions';
import { v4 as uuidv4 } from 'uuid';

// Fonction utilitaire pour vérifier l'accès au dossier
async function checkOrderAccess(orderId, user) {
  const [rows] = await db.query('SELECT * FROM contract_orders WHERE id = ?', [orderId]);
  if (rows.length === 0) return { error: 'Non trouvé', status: 404, order: null };
  const order = rows[0];
  
  const storeId = getStoreConstraint(user, null);
  if (storeId && order.storeId !== storeId) {
    return { error: 'Accès interdit: Ce dossier appartient à un autre magasin', status: 403, order: null };
  }
  return { error: null, order };
}

// GET: Récupérer un dossier avec ses items
export async function GET(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  try {
    const access = await checkOrderAccess(id, auth.user);
    if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
    const order = access.order;

    const [items] = await db.query('SELECT * FROM contract_order_items WHERE orderId = ?', [id]);
    
    // Récupérer l'historique
    const [history] = await db.query(`
      SELECT h.*, u.username as userName 
      FROM contract_order_history h
      LEFT JOIN users u ON h.userId = u.id
      WHERE h.orderId = ? 
      ORDER BY h.createdAt ASC
    `, [id]);
    
    return NextResponse.json({ ...order, items, history });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Mettre à jour le statut ou les détails d'un dossier
export async function PUT(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await request.json();
  const { status, contractAmount, totalAmount, notes, deliveryDate } = body;
  
    let connection;
    try {
      const access = await checkOrderAccess(id, auth.user);
      if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });
      const current = access.order;

      connection = await db.getConnection();
      await connection.beginTransaction();

      let finalStatus = status !== undefined ? status : current.status;
      if (finalStatus === 'termine') finalStatus = 'CLÔTURÉ';
      if (finalStatus === 'annule') finalStatus = 'ANNULÉ';
      if (finalStatus === 'demande') finalStatus = 'BROUILLON';

      const finalNotes = notes !== undefined ? notes : current.notes;
      const finalAttachment = body.attachment !== undefined ? body.attachment : current.attachment;
      const finalDeliveryDate = (deliveryDate !== undefined ? deliveryDate : current.delivery_date) || new Date().toISOString().split('T')[0];
      
      let finalContractAmount = current.contractAmount;
      let finalTotalAmount = current.totalAmount;

      // 1b. Si des items sont fournis, on les met à jour
      if (body.items && Array.isArray(body.items)) {
        // Supprimer les anciens items
        await connection.query('DELETE FROM contract_order_items WHERE orderId = ?', [id]);
        
        let newContractTotal = 0;
        let newTotalAmount = 0;

        for (const item of body.items) {
          const purchasePrice = parseFloat(item.purchasePrice) || 0;
          const sellPrice = parseFloat(item.sellPrice) || 0;
          const qty = parseInt(item.quantity) || 1;

          newContractTotal += (purchasePrice * qty);
          newTotalAmount += (sellPrice * qty);

          await connection.query(
            'INSERT INTO contract_order_items (orderId, articleId, refSite, code, refCfao, description, quantity, purchasePrice, sellPrice) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, item.articleId || null, item.refSite || null, item.code || null, item.refCfao || null, item.description, qty, purchasePrice, sellPrice]
          );
        }
        finalContractAmount = newContractTotal;
        finalTotalAmount = newTotalAmount;
      } else {
        // Sinon on prend les montants fournis ou actuels
        finalContractAmount = contractAmount !== undefined ? contractAmount : current.contractAmount;
        finalTotalAmount = totalAmount !== undefined ? totalAmount : current.totalAmount;
      }

      const margin = (finalTotalAmount || 0) - (finalContractAmount || 0);

      await connection.query(
        'UPDATE contract_orders SET status = ?, contractAmount = ?, totalAmount = ?, margin = ?, notes = ?, attachment = ?, delivery_date = ? WHERE id = ?',
        [finalStatus, finalContractAmount, finalTotalAmount, margin, finalNotes, finalAttachment, finalDeliveryDate, id]
      );

      // 1c. Enregistrer le changement de statut dans l'historique si nécessaire
      if (finalStatus !== current.status) {
        await connection.query(
          'INSERT INTO contract_order_history (orderId, oldStatus, newStatus, userId) VALUES (?, ?, ?, ?)',
          [id, current.status, finalStatus, auth.user.id]
        );
      }

      // 2. Si le statut passe à 'CLÔTURÉ', on enregistre la vente officiellement
      if (finalStatus === 'CLÔTURÉ' && current.status !== 'CLÔTURÉ') {
        const [orderRows] = await connection.query('SELECT * FROM contract_orders WHERE id = ?', [id]);
        const order = orderRows[0];
        const [items] = await connection.query('SELECT * FROM contract_order_items WHERE orderId = ?', [id]);
        
        // Récupérer l'exercice actif pour la vente
        const [fyRows] = await connection.query("SELECT id FROM fiscal_years WHERE status = 'active'");
        const activeYearId = fyRows[0]?.id;

        const saleId = `C-${id.substring(0, 8)}`;
        const tvaRate = Number(order.tva_rate || 18);
        const tvaAmount = Math.round(order.totalAmount * (tvaRate / 100));
        const totalTTC = order.totalAmount + tvaAmount;
        
        // Créer la vente avec tous les champs nécessaires
        await connection.query(
          'INSERT INTO sales (id, clientId, userId, totalAmount, discount, tvaAmount, amountPaid, paymentType, status, dueDate, notes, date, storeId, fiscalYearId) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            saleId, 
            order.clientId, 
            auth.user.id, 
            totalTTC, 
            0, // discount
            tvaAmount, 
            totalTTC, // amountPaid
            'complet', // paymentType
            'payé', // status
            null, // dueDate
            `Vente Magasin Virtuel (Ref: ${id.substring(0,8)})`, 
            new Date().toISOString(),
            0, 
            activeYearId
          ]
        );

        // Ajouter les articles à la vente
        for (const item of items) {
          let realArticleId = null;
          if (item.code || item.refCfao) {
            const [artRows] = await connection.query(
              'SELECT id FROM articles WHERE code = ? OR barcode = ? LIMIT 1',
              [item.code || '', item.refCfao || '']
            );
            if (artRows.length > 0) {
              realArticleId = artRows[0].id;
            }
          }
          await connection.query(
            'INSERT INTO sale_items (id, saleId, articleId, quantity, unitPrice, description) VALUES (?, ?, ?, ?, ?, ?)',
            [uuidv4(), saleId, realArticleId, item.quantity, item.sellPrice, item.description]
          );
        }
      }

      await connection.commit();
      
      const logMsg = finalStatus !== current.status 
        ? `Statut dossier contrat : ${finalStatus}` 
        : 'Modification dossier contrat';
      await logAction(auth.user.id, auth.user.storeId, logMsg, { orderId: id, status: finalStatus });

      return NextResponse.json({ success: true });
    } catch (err) {
      if (connection) await connection.rollback();
      console.error('[CONTRACT ORDER PUT ERROR]', err);
      return NextResponse.json({ error: err.message }, { status: 500 });
    } finally {
      if (connection) connection.release();
    }

}

// DELETE: Supprimer un dossier
export async function DELETE(request, { params }) {
  const auth = authenticateToken(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  if (!isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Action réservée aux administrateurs' }, { status: 403 });
  }

  const { id } = await params;
  try {
    const access = await checkOrderAccess(id, auth.user);
    if (access.error) return NextResponse.json({ error: access.error }, { status: access.status });

    await db.query('DELETE FROM contract_orders WHERE id = ?', [id]);
    await logAction(auth.user.id, auth.user.storeId, 'Suppression dossier contrat', { orderId: id });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
